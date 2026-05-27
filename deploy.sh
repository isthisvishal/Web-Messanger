#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "  Web Messenger — Production Deployment"
echo "  ======================================"
echo ""

command -v docker >/dev/null 2>&1 || error "Docker is required. See https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || error "Docker Compose v2 is required."
command -v openssl >/dev/null 2>&1 || error "openssl is required."

echo -n "  Enter your domain name (e.g. chat.example.com): "
read -r DOMAIN
[[ -z "$DOMAIN" ]] && error "Domain cannot be empty."
[[ "$DOMAIN" =~ ^https?:// ]] && error "Enter domain without http/https prefix."

echo -n "  Enter email for SSL certificate (Let's Encrypt): "
read -r SSL_EMAIL
[[ -z "$SSL_EMAIL" ]] && error "Email cannot be empty."

echo ""
info "Google OAuth (optional — press Enter to skip):"
echo -n "  GOOGLE_CLIENT_ID: "
read -r GOOGLE_CLIENT_ID
if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
  echo -n "  GOOGLE_CLIENT_SECRET: "
  read -r -s GOOGLE_CLIENT_SECRET
  echo ""
else
  GOOGLE_CLIENT_SECRET=""
fi

info "Generating cryptographic secrets..."
if [ -f .env ]; then
  info "Found existing .env file. Preserving existing secrets..."
  SESSION_SECRET=$(grep '^SESSION_SECRET=' .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  SERVER_ENCRYPTION_KEY=$(grep '^SERVER_ENCRYPTION_KEY=' .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  # Extract password from DATABASE_URL: postgresql://web_messenger:PASSWORD@postgres:5432/...
  POSTGRES_PASSWORD=$(grep '^DATABASE_URL=' .env | sed -E 's/.*:\/\/.*:(.*)@.*/\1/' | tr -d '"' | tr -d "'")
  # Extract password from REDIS_URL: redis://:PASSWORD@redis:6379
  REDIS_PASSWORD=$(grep '^REDIS_URL=' .env | sed -E 's/.*:\/\/.*:(.*)@.*/\1/' | tr -d '"' | tr -d "'")
fi

# Generate new secrets if not already set/found
[[ -z "$SESSION_SECRET" ]] && SESSION_SECRET=$(openssl rand -base64 32)
[[ -z "$SERVER_ENCRYPTION_KEY" ]] && SERVER_ENCRYPTION_KEY=$(openssl rand -base64 32)
[[ -z "$POSTGRES_PASSWORD" ]] && POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
[[ -z "$REDIS_PASSWORD" ]] && REDIS_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

info "Writing .env..."
cat > .env << EOF
DATABASE_URL=postgresql://web_messenger:${POSTGRES_PASSWORD}@postgres:5432/web_messenger
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
UPSTASH_REDIS_REST_URL=http://srh:80
UPSTASH_REDIS_REST_TOKEN=${REDIS_PASSWORD}
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
NEXT_PUBLIC_APP_NAME=Web Messenger
NODE_ENV=production
SESSION_SECRET=${SESSION_SECRET}
SERVER_ENCRYPTION_KEY=${SERVER_ENCRYPTION_KEY}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_REDIRECT_URI=https://${DOMAIN}/api/auth/google/callback
WEBAUTHN_RP_NAME=Web Messenger
WEBAUTHN_RP_ID=${DOMAIN}
WEBAUTHN_ORIGIN=https://${DOMAIN}
BEHIND_CLOUDFLARE=false
TRUSTED_PROXY_IPS=
EOF
success ".env written"

info "Writing docker-compose.yml..."
cat > docker-compose.yml << DCEOF
version: '3.9'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      srh:
        condition: service_started
    networks: [wm]
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(\`${DOMAIN}\`)"
      - "traefik.http.routers.app.entrypoints=websecure"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"
      - "traefik.http.services.app.loadbalancer.server.port=3000"

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: web_messenger
      POSTGRES_USER: web_messenger
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [wm]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U web_messenger -d web_messenger"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks: [wm]
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  srh:
    image: hiett/serverless-redis-http:latest
    restart: unless-stopped
    environment:
      - SRH_MODE=env
      - SRH_TOKEN=${REDIS_PASSWORD}
      - SRH_CONNECTION_STRING=redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      redis:
        condition: service_healthy
    networks: [wm]

  traefik:
    image: traefik:v3.0
    restart: unless-stopped
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=${SSL_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    networks: [wm]

volumes:
  postgres_data:
  redis_data:
  letsencrypt:

networks:
  wm:
    driver: bridge
DCEOF
success "docker-compose.yml written"

info "Building Docker image (2-5 minutes)..."
docker compose build --no-cache

info "Starting services..."
docker compose up -d

echo ""
success "Web Messenger deployed successfully!"
echo ""
success "  URL: https://${DOMAIN}"
success "  Register first → that account becomes SUPER_ADMIN"
echo ""
warn "Save these — they won't be shown again:"
warn "  PostgreSQL password: ${POSTGRES_PASSWORD}"
warn "  Redis password:      ${REDIS_PASSWORD}"
echo ""
info "Commands:"
info "  Logs:    docker compose logs -f app"
info "  Stop:    docker compose down"
info "  Update:  git pull && docker compose build && docker compose up -d"
info "  Backup:  docker compose exec postgres pg_dump -U web_messenger web_messenger > backup.sql"

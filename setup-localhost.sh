#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

echo -e "${BLUE}"
echo "  Web Messenger — Localhost Setup & Deployment"
echo "  ============================================"
echo -e "${NC}"

# Check and install Node.js / NPM / Docker
MISSING_DEPS=()
if ! command -v node >/dev/null 2>&1; then MISSING_DEPS+=("nodejs"); fi
if ! command -v npm >/dev/null 2>&1; then MISSING_DEPS+=("npm"); fi
if ! command -v docker >/dev/null 2>&1; then MISSING_DEPS+=("docker.io"); fi
if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then MISSING_DEPS+=("docker-compose"); fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
  info "Missing dependencies: ${MISSING_DEPS[*]}. Installing via apt..."
  sudo apt-get update
  sudo apt-get install -y "${MISSING_DEPS[@]}"
fi

# Ensure Docker service is running
if ! systemctl is-active --quiet docker; then
  info "Starting Docker service..."
  sudo systemctl start docker
  sudo systemctl enable docker
fi

# Ensure user is in docker group (to avoid running docker as sudo in future)
if ! groups $USER | grep &>/dev/null '\bdocker\b'; then
  warn "Adding user $USER to the docker group..."
  sudo usermod -aG docker $USER
  warn "You might need to log out and log back in for docker group changes to take effect."
fi

# Create local .env if it doesn't exist
if [ ! -f .env ]; then
  info "Creating local .env file..."
  cat > .env << EOF
DATABASE_URL="postgresql://web_messenger:local_db_pass@localhost:5432/web_messenger"
REDIS_URL="redis://localhost:6379"
UPSTASH_REDIS_REST_URL="http://localhost:8079"
UPSTASH_REDIS_REST_TOKEN="local_dev_token"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Web Messenger (Local)"
NODE_ENV="development"
SESSION_SECRET="local-development-session-secret-must-be-very-long-and-secure"
SERVER_ENCRYPTION_KEY="local-development-encryption-key-must-be-very-long-and-secure"
WEBAUTHN_RP_NAME="Web Messenger Local"
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_ORIGIN="http://localhost:3000"
BEHIND_CLOUDFLARE=false
TRUSTED_PROXY_IPS=
EOF
  success ".env file created."
fi

# Start local databases/services via Docker Compose
info "Starting PostgreSQL, Redis, and SRH proxy containers..."
# Try 'docker compose' first, fallback to 'docker-compose'
if docker compose version >/dev/null 2>&1; then
  sudo docker compose up -d
else
  sudo docker-compose up -d
fi

# Wait for Postgres to be ready
info "Waiting for PostgreSQL container to start..."
for i in {1..30}; do
  if sudo docker exec web-messanger-postgres-1 pg_isready -U web_messenger -d web_messenger >/dev/null 2>&1 || \
     sudo docker exec messager_web-postgres-1 pg_isready -U web_messenger -d web_messenger >/dev/null 2>&1 || \
     sudo docker exec postgres-1 pg_isready -U web_messenger -d web_messenger >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Install local dependencies
info "Installing npm packages..."
npm install

# Run database migrations
info "Running database migrations locally..."
npx prisma migrate dev --name init

# Run the development server
success "Localhost environment ready! Starting development server on http://localhost:3000..."
npm run dev

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

# Fix Kali Docker APT repository if broken
if [ -f /etc/apt/sources.list.d/docker.list ]; then
  if grep -q "kali-rolling" /etc/apt/sources.list.d/docker.list || grep -q "download.docker.com" /etc/apt/sources.list.d/docker.list; then
    info "Detected broken/unsupported Docker APT repository list. Removing it to fix apt..."
    sudo rm -f /etc/apt/sources.list.d/docker.list
  fi
fi

# Load NVM if it is installed
export NVM_DIR="$HOME/.config/nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  info "Loading NVM from $NVM_DIR..."
  . "$NVM_DIR/nvm.sh"
elif [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  info "Loading NVM from $NVM_DIR..."
  . "$NVM_DIR/nvm.sh"
fi

# Install Node.js v20 if not available
if ! command -v node >/dev/null 2>&1; then
  info "Node.js not found. Installing NVM and Node.js v20..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.config/nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  [ -s "$HOME/.nvm/nvm.sh" ] && { export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh"; }
  
  if command -v nvm >/dev/null 2>&1; then
    nvm install 20
    nvm use 20
    nvm alias default 20
  else
    error "Failed to install NVM. Please install Node.js (v20+) manually."
  fi
fi

# Verify Node and NPM
info "Using Node.js $(node -v) and NPM $(npm -v)"

# Install Docker if missing
MISSING_DEPS=()
if ! command -v docker >/dev/null 2>&1; then
  if apt-cache show docker.io >/dev/null 2>&1; then
    MISSING_DEPS+=("docker.io")
  else
    MISSING_DEPS+=("docker-ce")
  fi
fi

if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
  if apt-cache show docker-compose-plugin >/dev/null 2>&1; then
    MISSING_DEPS+=("docker-compose-plugin")
  elif apt-cache show docker-compose-v2 >/dev/null 2>&1; then
    MISSING_DEPS+=("docker-compose-v2")
  elif apt-cache show docker-compose >/dev/null 2>&1; then
    MISSING_DEPS+=("docker-compose")
  fi
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
  info "Missing Docker packages: ${MISSING_DEPS[*]}. Installing via apt..."
  sudo apt-get update
  sudo apt-get install -y "${MISSING_DEPS[@]}"
fi

# Ensure Docker service is running
if ! systemctl is-active --quiet docker; then
  info "Starting Docker service..."
  sudo systemctl start docker
  sudo systemctl enable docker
fi

# Ensure user is in docker group
if ! groups $USER | grep &>/dev/null '\bdocker\b'; then
  warn "Adding user $USER to the docker group..."
  sudo usermod -aG docker $USER
  warn "You might need to log out and log back in (or run 'newgrp docker') for docker group changes to take effect."
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
# Run docker compose without sudo if possible, otherwise fall back to sudo
if docker compose version >/dev/null 2>&1; then
  docker compose up -d || sudo docker compose up -d
elif docker-compose version >/dev/null 2>&1; then
  docker-compose up -d || sudo docker-compose up -d
else
  error "Neither 'docker compose' nor 'docker-compose' was found."
fi

# Wait for Postgres to be ready
info "Waiting for PostgreSQL container to start..."
POSTGRES_CONTAINER=""
for i in {1..30}; do
  # Find the active postgres container name
  CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep postgres || true)
  if [ -n "$CONTAINER_NAME" ]; then
    if docker exec "$CONTAINER_NAME" pg_isready -U web_messenger -d web_messenger >/dev/null 2>&1; then
      POSTGRES_CONTAINER="$CONTAINER_NAME"
      break
    fi
  fi
  # Fallback to sudo if permission denied
  CONTAINER_NAME_SUDO=$(sudo docker ps --format "{{.Names}}" | grep postgres || true)
  if [ -n "$CONTAINER_NAME_SUDO" ]; then
    if sudo docker exec "$CONTAINER_NAME_SUDO" pg_isready -U web_messenger -d web_messenger >/dev/null 2>&1; then
      POSTGRES_CONTAINER="$CONTAINER_NAME_SUDO"
      break
    fi
  fi
  sleep 2
done

if [ -z "$POSTGRES_CONTAINER" ]; then
  warn "PostgreSQL is taking longer to start or container not found. Proceeding anyway..."
else
  success "PostgreSQL is ready! (Container: $POSTGRES_CONTAINER)"
fi

# Install local dependencies
info "Installing npm packages..."
npm install

# Run database migrations
info "Running database migrations locally..."
npx prisma generate
npx prisma migrate dev --name init || npx prisma db push

# Run the development server
success "Localhost environment ready! Starting development server on http://localhost:3000..."
npm run dev

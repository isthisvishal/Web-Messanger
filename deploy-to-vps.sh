#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

VPS_IP="51.79.191.28"
VPS_USER="root"
VPS_PASS="DuYr4GzP9lgXMR2O"
DOMAIN="web-messenger.isthisvishal.tech"
SSL_EMAIL="admin@isthisvishal.tech"

echo "  Web Messenger — Remote VPS Deployment"
echo "  ======================================"
echo ""

if ! command -v sshpass >/dev/null 2>&1; then
  info "sshpass not found. Attempting to install it..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y sshpass
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y sshpass
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --noconfirm sshpass
  else
    error "Please install 'sshpass' manually and run this script again."
  fi
fi

info "Connecting to VPS at ${VPS_IP}..."

sshpass -p "${VPS_PASS}" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" bash -s << VEOF
set -euo pipefail
echo "=== Operating inside VPS ==="

echo "[VPS] Fixing any broken packages/dependencies..."
apt-get update
apt-get install -f -y


if ! command -v docker >/dev/null 2>&1; then
  echo "[VPS] Installing Docker..."
  apt-get update
  apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

if ! command -v git >/dev/null 2>&1; then
  echo "[VPS] Installing Git..."
  apt-get update
  apt-get install -y git
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "[VPS] Installing OpenSSL..."
  apt-get update
  apt-get install -y openssl
fi

echo "[VPS] Preparing deployment directory..."
if [ -f Web-Messanger/.env ]; then
  echo "[VPS] Backing up existing .env..."
  cp Web-Messanger/.env /tmp/web_messenger_env_backup
fi
rm -rf Web-Messanger
git clone https://github.com/isthisvishal/Web-Messanger.git
if [ -f /tmp/web_messenger_env_backup ]; then
  echo "[VPS] Restoring .env backup..."
  cp /tmp/web_messenger_env_backup Web-Messanger/.env
  rm /tmp/web_messenger_env_backup
fi
cd Web-Messanger

echo "[VPS] Running deploy.sh with automated inputs..."
chmod +x deploy.sh

# Feed FQDN, SSL Email, and blank Google OAuth settings to deploy.sh
./deploy.sh << INPUTSEOF
${DOMAIN}
${SSL_EMAIL}


INPUTSEOF

echo "=== VPS setup finished ==="
VEOF

echo ""
success "Deployment sequence complete!"
success "Your Web Messenger instance is running at: https://${DOMAIN}"
echo ""
warn "Check remote status by running this on your host:"
info "  sshpass -p '${VPS_PASS}' ssh ${VPS_USER}@${VPS_IP} 'cd Web-Messanger && docker compose ps'"

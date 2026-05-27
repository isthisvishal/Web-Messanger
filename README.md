# Web Messenger

> Zero-knowledge end-to-end encrypted messaging. The server never sees your messages.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)

---

## What "zero-knowledge" means here

All encryption and decryption happens exclusively in your browser using the Web Crypto API. The server only ever receives and stores ciphertext — data that is computationally infeasible to decrypt without the user's private key.

- Your messages are encrypted with AES-256-GCM before leaving your device
- Your private encryption key never leaves your browser in plaintext
- Your master key is encrypted with a key derived from your password (PBKDF2, 600k iterations) — the server stores only the encrypted blob
- Even a complete database breach exposes only ciphertext and hashed credentials — no readable messages, no usable keys
- No backdoors — the cryptographic design makes server-side decryption mathematically impossible

## Security Architecture

| Layer | Algorithm | Parameters |
|---|---|---|
| Password hashing | Argon2id | 64MB memory, 3 iterations, 4 parallelism |
| Message encryption | AES-256-GCM | 96-bit random nonce per message |
| Key agreement | ECDH P-256 | Ephemeral per-conversation key exchange |
| Password → key derivation | PBKDF2 | 600,000 iterations, SHA-256 |
| OTP storage | bcrypt | 12 rounds, never stored in plaintext |
| Session tokens | SHA-256 hash | Raw token only in httpOnly cookie |
| IP addresses | SHA-256 hash | Never stored in plaintext |
| OAuth tokens at rest | AES-256-GCM | SERVER_ENCRYPTION_KEY env var |
| SMTP credentials at rest | AES-256-GCM | SERVER_ENCRYPTION_KEY env var |
| Login 2FA | 6-digit OTP | 10-min expiry, 3-attempt limit |
| Passwordless auth | WebAuthn passkeys | Phishing-resistant biometric auth |
| Google OAuth | PKCE + state | Authorization Code Flow, S256 challenge |
| Rate limiting | Redis sliding window | Per-endpoint limits on all auth routes |
| Transport | HTTPS + HSTS | Required in production |

## Cross-Device Key Sync

When you register, a master encryption key is generated in your browser. This key is wrapped (encrypted) using a key derived from your password via PBKDF2. The encrypted key blob is stored on the server.

When you log in on a new device, your browser downloads the encrypted blob and decrypts it locally using your password. The server never participates in the decryption — it only stores the blob. Your password never leaves your device.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+ (or an Upstash account for serverless Redis)
- Google Cloud Console project (for OAuth, optional)

## Quick Start

```bash
git clone https://github.com/isthisvishal/Web-Messanger.git
cd web-messenger
cp .env.example .env
# Edit .env and fill in all required values
npm install
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000. The first registered account automatically becomes SUPER_ADMIN.

## Environment Variables

See `.env.example` for the complete list with descriptions. All variables are required unless marked optional.

Generate secrets with:
```bash
openssl rand -base64 32   # for SESSION_SECRET and SERVER_ENCRYPTION_KEY
```

## Google OAuth Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable the "Google Identity" API
4. Go to Credentials → Create credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Add authorized redirect URI: `https://yourdomain.com/api/auth/google/callback`
7. Copy Client ID and Client Secret to `.env`

## First User = Super Admin

The very first account registered on a fresh installation automatically receives the `SUPER_ADMIN` role. This is enforced atomically in a database transaction — concurrent registrations cannot both claim this role. The super admin can promote/demote other users to `ADMIN` and is the only role that cannot be banned or demoted.

## Admin Panel

Access at `/admin` — requires `ADMIN` or `SUPER_ADMIN` role.

- **Dashboard** — user counts, message stats, SMTP status, recent audit log
- **User management** — search, filter, ban/unban users, promote/demote admins
- **SMTP configuration** — configure outbound email with connection test
- **Email templates** — customize all 6 transactional email templates with live preview

## Deployment to VPS

### Prerequisites on your server
- Docker + Docker Compose v2
- Ports 80 and 443 open in your firewall
- A domain name with DNS A record pointing to your server IP

### One-command deploy
```bash
git clone https://github.com/isthisvishal/Web-Messanger.git
cd web-messenger
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Ask for your domain and Let's Encrypt email
2. Ask for Google OAuth credentials (optional — press enter to skip)
3. Generate all cryptographic secrets automatically
4. Write `.env` and `docker-compose.yml`
5. Build the Docker image
6. Start PostgreSQL, Redis, the app, and Traefik (HTTPS reverse proxy with auto-SSL)
7. Run database migrations

### After deploy
- Register the first account — it becomes SUPER_ADMIN
- Configure SMTP in the admin panel (`/admin/smtp`) to enable email sending
- Set up Google OAuth redirect URI in Google Console to `https://yourdomain.com/api/auth/google/callback`

### Update
```bash
git pull
docker compose build --no-cache
docker compose up -d
```

### Backup
```bash
docker compose exec postgres pg_dump -U web_messenger web_messenger > backup_$(date +%Y%m%d).sql
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

## License

MIT — see [LICENSE](LICENSE).

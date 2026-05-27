# Contributing to Web Messenger

## Development Setup

1. Clone the repository
2. `cp .env.example .env` and fill in all values
3. `npm install`
4. `npx prisma migrate dev`
5. `npm run dev`

## Required Before Every PR

- `npm run lint` — must pass with zero warnings or errors
- `npm run format:check` — must pass
- `npm run build` — must succeed with zero TypeScript errors
- Write or update tests for any new or modified API endpoint

## Code Standards

- TypeScript strict mode — no `any` types without explicit justification
- All API routes must validate every input field with Zod before touching the database
- All API routes that mutate data must have rate limiting applied
- IP addresses must never be stored or logged in plaintext — always hash with `hashIp()`
- OTPs must never be stored in plaintext — always hash with bcrypt
- Never log request bodies — they may contain passwords or tokens
- Never use `dangerouslySetInnerHTML` without DOMPurify sanitization

## Security Review Checklist for New Endpoints

- [ ] Zod validation on all inputs
- [ ] Rate limiting applied
- [ ] Session check before any DB operation
- [ ] Role check for admin endpoints (server-side, never client-side)
- [ ] No plaintext IPs in logs or DB
- [ ] No sensitive data in error messages returned to client

## Branch Naming

- `feat/description` — new features
- `fix/description` — bug fixes
- `sec/description` — security fixes (prefer private disclosure first)
- `docs/description` — documentation only

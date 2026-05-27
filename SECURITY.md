# Security Policy

## Reporting Vulnerabilities

Do NOT open a public GitHub issue for security vulnerabilities.

Use GitHub's private vulnerability reporting feature, or email the maintainer directly.

We aim to acknowledge reports within 48 hours and patch within 14 days.

## Scope

In scope:
- Authentication bypasses or session fixation
- Cryptographic weaknesses in the E2E encryption design
- Cross-site scripting (XSS) or CSRF vulnerabilities
- Rate limit bypasses
- Admin privilege escalation
- Any issue that could expose user message content

Out of scope:
- Self-XSS
- Social engineering attacks
- Vulnerabilities requiring physical device access
- Denial-of-service via legitimate endpoint abuse (report but low priority)

## Security Design

All message encryption/decryption happens client-side using the Web Crypto API.
The server stores only AES-256-GCM ciphertext. A full database breach reveals no readable messages.
See README.md for the complete security architecture.

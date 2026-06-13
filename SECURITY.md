# Security Policy

## Reporting a vulnerability

If you discover a security issue in StrikeScope, please report it responsibly:

- **Email:** [josephedwardscto via LinkedIn](https://www.linkedin.com/in/josephedwardscto/) (no public issue for undisclosed vulns)
- Do not open public GitHub issues for exploitable findings until coordinated disclosure is agreed

Include steps to reproduce, affected version, and impact assessment.

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.3.x (main) | Yes |

## Secrets and credentials

**Never commit:**

- `.env`, `.env.local`, or `server.config.json`
- SQLite databases (`*.db`) or `packages/server/data/uploads/`
- Connection configs containing S3/FTP/SSH/API keys
- Production `JWT_SECRET`, `SERVER_API_KEY`, or Activepieces signing keys

Use [`.env.example`](.env.example) placeholders only. Rotate all keys before any production deployment.

## Production hardening checklist

Before exposing StrikeScope beyond localhost:

1. Set `DEV_MODE=false` (or unset) — **required** for JWT secret enforcement
2. Set strong unique values for `JWT_SECRET`, `SERVER_API_KEY`, and `SERVER_NODE_KEY`
3. Disable default dev seed credentials — change or remove `admin@strikescope.local` password
4. Enable MFA for privileged accounts (`server_admin`, `company_admin`)
5. Terminate TLS at reverse proxy or use bundled HTTPS certs intentionally
6. Restrict CORS via `CORS_ORIGINS` to known admin/field origins
7. Do not expose Dev Studio (`/api/admin/dev-studio`) in production builds
8. Keep Activepieces admin credentials and webhook secrets out of version control

## Dev-only defaults

Local development seeds a `server_admin` user at `admin@strikescope.local` with a documented dev password. **These credentials are not safe for production.**

See [docs/SECURITY-IAM.md](docs/SECURITY-IAM.md) for the full IAM model.

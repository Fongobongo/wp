# Production Secrets for GitHub Actions

Configure these repository secrets before enabling production automation workflows.

## Deploy workflow secrets (`deploy-prod.yml`)
- `PROD_SSH_PRIVATE_KEY`: private key used by GitHub Actions to SSH into VPS.
- `PROD_SSH_HOST`: VPS hostname or IP.
- `PROD_SSH_PORT`: SSH port (usually `22`).
- `PROD_SSH_USER`: deploy user on VPS.
- `PROD_APP_DIR`: absolute path of checked-out repo on VPS.

## Uptime workflow secrets (`uptime-check.yml`)
- `PROD_HEALTHCHECK_URL`: public health URL, for example `https://play.example.com/healthz`.
- `PROD_READINESS_URL`: readiness URL, for example `https://play.example.com/readyz`.
- `PROD_PROTECTED_URL`: protected service URL, for example `https://play.example.com/services/game-data/health`.
- `PROD_BASIC_AUTH_USER`: value matching `BASIC_AUTH_USER` in `infra/prod/.env.prod`.
- `PROD_BASIC_AUTH_PASSWORD`: plaintext password corresponding to configured bcrypt hash.

## VPS-side required file
`infra/prod/.env.prod` must exist on server and include:

```env
DOMAIN=play.example.com
BASIC_AUTH_USER=ops
BASIC_AUTH_PASSWORD_HASH=<bcrypt-hash-with-$-escaped-as-$$>
```

Generate bcrypt hash:

```bash
docker run --rm caddy:2.8-alpine caddy hash-password --plaintext 'your-password'
```

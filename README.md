# WAR PROTOCOL

Web-first tactical PvP prototype implementing the WAR PROTOCOL architecture:

- TypeScript end-to-end monorepo
- React + Phaser web client
- Authoritative battle simulation service over WebSocket
- Dedicated service boundaries for game data, players, matchmaking, battle, and economy
- Data-driven catalog with 25 factions / 750 units
- Docker, Terraform, and CI bootstrap

## Monorepo layout

- `apps/web-client` - React + Phaser browser client
- `services/game-data-service` - `/game-data`
- `services/player-service` - `/auth/*`, `/profile`, `/inventory`, `/loadout/validate`
- `services/matchmaking-service` - `/queue/join`, `/queue/leave`, `/queue/status`
- `services/battle-service` - `WS /match/:id`, `/match/result/ack`, `/internal/matches`
- `services/economy-service` - `/battle-pass`
- `packages/shared-types` - shared domain and API types
- `packages/game-data` - faction/unit generation + loadout validation + synergy
- `packages/battle-engine` - deterministic battle simulator + replay reducer
- `packages/service-runtime` - Fastify runtime with CORS, health, metrics, telemetry hooks
- `infra/terraform` - AWS infra baseline (S3, ElastiCache, RDS)
- `infra/sql/001_init.sql` - baseline PostgreSQL schema

## Design docs for agents

- `AGENTS.md` - mandatory operating context for coding/design agents
- `docs/game-design/MASTER_GDD.md` - canonical game design baseline
- `docs/game-design/FACTIONS_INDEX.md` - faction catalog rules and structure
- `docs/game-design/PROGRESSION_AND_ECONOMY.md` - progression, monetization, Web3/F2P constraints
- `docs/game-design/IMPLEMENTATION_GAP.md` - delta between target design and current code

## Quick start

```bash
npm install
npm run dev:all
```

Services and web app:

- `http://localhost:5173` - web client
- `http://localhost:4001/game-data`
- `http://localhost:4002/profile?playerId=<id>`
- `http://localhost:4003/queue/debug`
- `ws://localhost:4004/match/<matchId>?playerId=<id>`
- `http://localhost:4005/battle-pass?playerId=<id>`

## Useful scripts

```bash
npm run lint
npm run test
npm run build
npm run test:ui
npm run test:ui:prod
npm run dev:web
npm run dev:battle
```

## Headless UI smoke coverage

The repository includes a Playwright smoke suite for the current single-hex web MVP. It verifies:

- drag-and-drop deployment of the reserve unit into the only valid hex;
- rejection of drops outside that hex;
- pixel-based checks that the rendered unit blob stays centered inside the hex polygon.

Run from the repository root:

```bash
npm run test:ui
```

To run the same smoke suite against the public production URL:

```bash
npm run test:ui:prod
```

Artifacts are written to:

- `artifacts/ui/screenshots`
- `artifacts/ui/playwright-report`
- `artifacts/ui/test-results`

## Docker compose

Bring up infra + services + web:

```bash
docker compose up --build
```

## Production Domain Deployment (HTTPS)

This repository includes a production stack for a permanent public domain:
- `docker-compose.prod.yml`
- `Dockerfile.web.prod`
- `infra/prod/Caddyfile`
- `infra/prod/deploy_prod.sh`
- `.github/workflows/deploy-prod.yml`
- `.github/workflows/uptime-check.yml`

### 1. Prerequisites on your VPS

1. Ubuntu/Debian server with public static IP.
2. Docker + Docker Compose plugin installed.
3. Ports `80/tcp` and `443/tcp` open in firewall/security group.
4. DNS `A` record pointing your domain to the VPS IP.

Example:
- `play.example.com -> <your_vps_ip>`

### 2. Set production env

```bash
cp infra/prod/.env.prod.example infra/prod/.env.prod
```

Edit `infra/prod/.env.prod`:

```env
DOMAIN=play.example.com
BASIC_AUTH_USER=ops
BASIC_AUTH_PASSWORD_HASH=<bcrypt_hash>
```

Generate bcrypt hash:

```bash
docker run --rm caddy:2.8-alpine caddy hash-password --plaintext 'strong-password'
```

When placing bcrypt hash into `.env.prod`, escape `$` as `$$`.
Example:

```env
BASIC_AUTH_PASSWORD_HASH=$$2a$$14$$...
```

### 3. Deploy

```bash
bash infra/prod/deploy_prod.sh
```

This starts Caddy as an internal upstream on `127.0.0.1:8080`.

### 4. Configure Nginx as public frontend for one hostname

Run once on VPS:

```bash
bash infra/prod/configure_nginx_proxy.sh
```

What it does:
- installs/enables nginx if missing;
- creates a dedicated vhost for `DOMAIN` only;
- proxies `DOMAIN` traffic to `127.0.0.1:8080` (docker stack);
- if `LE_EMAIL` is set, runs certbot and enables HTTPS redirect.

### 5. Health and readiness endpoints

- Public health: `https://<domain>/healthz`
- Public readiness (checks web client upstream): `https://<domain>/readyz`
- Protected service/metrics routes:
  - `https://<domain>/metrics`
  - `https://<domain>/services/game-data/health`
  - `https://<domain>/services/player/health`
  - `https://<domain>/services/matchmaking/health`
  - `https://<domain>/services/battle/health`
  - `https://<domain>/services/economy/health`

### 6. Auto-deploy on push to main

Configure GitHub repository secrets listed in:
- `infra/prod/SECRETS.md`

Then every push to `main` triggers:
- `.github/workflows/deploy-prod.yml`

### 7. Automated uptime checks

Scheduled checks run every 10 minutes via:
- `.github/workflows/uptime-check.yml`

It validates:
- public health endpoint;
- readiness endpoint;
- one protected service endpoint via HTTP basic auth.

### 8. Update deployment manually

```bash
git pull
bash infra/prod/deploy_prod.sh
```

## Infrastructure

Terraform skeleton is in `infra/terraform`.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
```

Apply SQL schema locally:

```bash
psql postgresql://war:war@localhost:5432/war_protocol -f infra/sql/001_init.sql
```

## Deterministic battle guarantees

- Same `seed + input + balanceVersion` => same event log
- Event replay via `replayBattleFromInitial`
- Idempotent event consumption via `reduceEventsIdempotent`

## Portability path

- Browser: primary target (Vite build)
- Mobile wrapper scaffold: `apps/web-client/capacitor.config.ts`
- Desktop wrapper scaffold: `apps/web-client/src-tauri/tauri.conf.json`

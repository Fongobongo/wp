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
npm run dev:web
npm run dev:battle
```

## Docker compose

Bring up infra + services + web:

```bash
docker compose up --build
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

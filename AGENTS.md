# AGENTS.md

## Purpose
This file defines mandatory context for any coding/design agents working in the `war-protocol` repository.

Primary product objective:
- build a web-first tactical PvP game inspired by War Chest;
- preserve fair, skill-based gameplay;
- scale content to 25 factions and 750 units;
- add Web3 economy as an optional layer, not as gameplay replacement.

## Source of Truth
Before changing code or content, always align with:
1. `docs/game-design/MASTER_GDD.md` - canonical design baseline.
2. `docs/game-design/FACTIONS_INDEX.md` - faction and content structure rules.
3. `docs/game-design/PROGRESSION_AND_ECONOMY.md` - progression, tokenomics, F2P constraints.
4. `docs/game-design/IMPLEMENTATION_GAP.md` - delta between target design and current implementation.
5. `README.md` - runtime architecture and operational setup.

## Repository Communication and Git Rules
1. All repository files and project content must be written in English.
2. Russian is allowed only for direct chat communication with the user, not for files in this repository.
3. After every change, create a separate commit and push immediately.
4. Use GitHub SSH alias `openclaw` for repository operations.
5. Default remote must be `openclaw:Fongobongo/wp.git` unless explicitly changed by the user.

## Deployment Rule
1. After each committed change that affects externally visible behavior, automatically redeploy production via `infra/prod/deploy_prod.sh`.
2. After redeploy, verify `https://play.hadoop21.click/` and `https://play.hadoop21.click/healthz` from the server.
3. Report deployment verification results in the user response.

## UI Verification Rule
1. After each frontend or interaction change, run `npm run test:ui`.
2. When investigating a visual bug reported on production, also run `npm run test:ui:prod`.
3. Review the generated screenshots in `artifacts/ui/screenshots`.
4. Treat a frontend change as incomplete if drag-and-drop smoke coverage, pixel-based visual edge checks, or screenshot generation fails.

## Non-Negotiable Product Rules
1. Gameplay first: blockchain must not reduce gameplay quality.
2. No pay-to-win: paid content must not grant combat power.
3. Ranked PvP must always run on authoritative server simulation.
4. Clients must never determine match outcome.
5. New factions and units must follow the shared role-balance matrix.

## Current Architecture (Must Respect)
- `apps/web-client`: React + Phaser client.
- `services/game-data-service`: game data and balance version delivery.
- `services/player-service`: auth/profile/inventory/loadout validation.
- `services/matchmaking-service`: queue and match pairing.
- `services/battle-service`: prep, lock-in, server simulation, websocket stream.
- `services/economy-service`: battle pass and rewards.
- `packages/game-data`: data-driven catalog and validation.
- `packages/battle-engine`: deterministic simulation and replay.
- `packages/shared-types`: domain and API/event contracts.

## Change Rules
1. Any new mechanic must be documented in `docs/game-design/*` before implementation.
2. Any combat-logic change must:
- preserve determinism;
- include reproducibility/idempotency tests;
- preserve explicit balance versioning (`balanceVersion`).
3. Any economy change must:
- include anti-abuse controls;
- preserve F2P progression viability;
- record monetization risk in docs.
4. New factions/units must be added data-driven, not hardcoded in UI logic.

## Definition of Done for Gameplay Work
1. Updated relevant documents in `docs/game-design/*`.
2. Updated `shared-types` when contracts change.
3. Added/updated tests in `packages/game-data` and/or `packages/battle-engine`.
4. `npm run lint`, `npm run test`, `npm run build` pass.
5. Reconnect/resend paths validated for network-facing changes.

## Delivery Priorities
1. Complete War Chest-like core loop (bag draw, tokens, control points).
2. Raise live PvP reliability to production grade.
3. Expand content pipeline to full 25x30 faction/unit model.
4. Introduce Web3 gradually: ownership/marketplace first, token layer later.

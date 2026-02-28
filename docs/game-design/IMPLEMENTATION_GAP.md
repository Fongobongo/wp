# Implementation Gap: Target Design vs Current Codebase

## 1. Purpose
This document tracks what is already implemented and what must still be delivered to match the target game design.

## 2. Already Implemented
1. Multi-service architecture (game-data, player, matchmaking, battle, economy).
2. React + Phaser web client.
3. Authoritative server-side battle simulation.
4. Deterministic battle engine with event log and replay.
5. Baseline API and websocket flow for live PvP.
6. Infrastructure baseline: Docker, Terraform, CI.

## 3. Not Yet Complete vs GDD
1. Full War Chest-like bag-draw loop is not implemented (bag/tokens/control markers as independent gameplay layer).
2. Unit and ability content is still technical/generated, not full designer-authored production content.
3. Faction asymmetry and signature mechanics are only partially implemented.
4. Production persistence is incomplete (in-memory sections still present in services).
5. Release-grade anti-cheat hardening is incomplete (rate limiting, replay audit, abuse pipeline).
6. Social layer is incomplete (clans, tournaments, cooperative features).
7. Web3 runtime integration is not implemented yet (currently documented as design constraints only).

## 4. Priority Gap Closure
1. Content:
- migrate generated data to curated faction/unit tables;
- define signature ability kits for each faction.
2. Gameplay:
- add map control-point victory conditions;
- add scenario modes and dynamic modifiers.
3. Reliability:
- migrate player/economy/match results to PostgreSQL;
- complete Redis-backed queue reliability and resilient matchmaking.
4. Economy:
- implement seasonal balance loop;
- build safe token/NFT loop with no pay-to-win vectors.

## 5. Vertical Slice Readiness Criteria
Vertical slice is ready when:
1. A player can complete full loop: `login -> roster setup -> live match -> rewards -> progression`.
2. Unit/faction data conforms to `FACTIONS_INDEX.md`.
3. Ranked outcomes are fully independent from client-side computation.
4. Key scenarios are covered by tests (determinism, reconnect, idempotency, loadout validation).

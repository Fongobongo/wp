# WAR PROTOCOL - Master GDD (v0.1)

## 1. High Concept
- Genre: turn-based tactical strategy with semi-automatic battles.
- Core inspiration: War Chest-like loop (limited resources, pre-battle positioning, control points).
- Format: PvP-first, web-first, long-term live game.
- Player fantasy: win as a strategist through composition, positioning, role synergy, and meta reading.

## 2. Core Pillars
1. Strategy over mechanical reaction speed.
2. Strong faction identity and playstyle diversity.
3. Deep progression and long-term goals.
4. Fair balance without pay-to-win.
5. Long-lived meta through live content updates.

## 3. Core Gameplay Loop
1. Select faction and roster.
2. Configure build (progression, talents, gear/artifacts).
3. Position units before battle.
4. Confirm (`lock-in`) and launch semi-auto combat.
5. Receive result, rating impact, and rewards.
6. Rebuild roster and progression plan.

## 4. Tactical Battle Model

### 4.1 Board
- Grid size: 6x8 or 8x8.
- Tile types: standard, elevation, cover, energy zone, trap.

### 4.2 Battle Phases
1. Preparation Phase:
- unit selection;
- formation placement;
- synergy activation;
- lock-in.
2. Initiative Calculation:
- `initiative = base_speed + RNG(0..5) + buffs/debuffs`.
3. Action Phase:
- movement;
- basic attack;
- ability usage;
- passive triggers.
4. Resolution Phase:
- death checks;
- on-death effects;
- round-state refresh.

### 4.3 Damage Types
- Physical: slash, pierce, blunt.
- Magical: fire, ice, lightning, poison, dark, light.
- Special: true damage, percent damage, sacrificial.

### 4.4 Status Effects
- Baseline set: burn, poison, slow, stun, buff, debuff, cleanse.
- All statuses must be explicitly represented in data schemas and replay event logs.

## 5. Unit Roles (Subclasses)
1. Assault - melee breakthrough DPS.
2. Defender - tank/frontline control/protection.
3. Ranger - ranged precision damage.
4. Mage - AoE/control/magical effects.
5. Scout - mobility/flank pressure/initiative edge.
6. Healer - sustain and cleansing.
7. Support - buffs, debuffs, tempo control.

## 6. Faction Content Model
- Target scope: 25 factions.
- Volume: 30 units per faction, total 750 units.
- Role symmetry per faction:
- 6 assault;
- 5 defender;
- 5 ranger;
- 5 mage;
- 3 scout;
- 3 healer;
- 3 support.

## 7. Progression
- Unit tiers: Recruit -> Experienced -> Veteran -> Elite -> Legendary.
- Two progression branches:
- faction branch (identity mechanics);
- role branch (battle function).
- Final node: unique ability that changes tactical behavior, not only raw numbers.

## 8. Metagame
- Constraints: unit cap, energy/cost cap.
- Synergies:
- faction thresholds 3/5/7;
- role thresholds 2/4.
- Season model: 2-3 month seasons with ratings, rewards, and balance patches.

## 9. Modes
1. Ranked PvP (primary).
2. Casual PvP.
3. Tournament rulesets.
4. Draft mode.
5. PvE campaign (lore and onboarding).

## 10. LiveOps and Retention
1. Regular patches and ruleset rotations.
2. Seasonal modifiers and temporary modes.
3. Daily/weekly missions.
4. Long-term goals: ranking ladders, leagues, tournaments.
5. Social systems: clans/alliances, team activities.

## 11. Web3 Design Principles
1. Blockchain is optional ownership/economy infrastructure.
2. NFT usage is cosmetic/collectible, not combat power.
3. Token usage supports rewards/utility/exchange without harming fairness.
4. Provable randomness is for off-battle flows (drops/events), not real-time deterministic PvP simulation.
5. Security and anti-speculative safeguards are mandatory.

## 12. Monetization (Fair F2P)
1. Cosmetic-first: skins, VFX, banners.
2. Battle pass: progression acceleration and cosmetic tracks.
3. Primary NFT sales plus secondary-market royalty.
4. Prohibited:
- direct sale of combat advantage;
- exclusive stat power for real money;
- systems that block competitive viability for free players.

## 13. Balance Philosophy
1. No single dominant strategy.
2. Every faction has viable counters.
3. Balance shifts prefer synergy tuning over blunt global nerfs.
4. Balance must be measurable (winrate/pickrate/counterrate telemetry).

## 14. Engineering Constraints
1. Ranked outcomes are determined server-side only.
2. Battle simulation must stay deterministic and replayable.
3. Client is visualization/interface, never gameplay source of truth.
4. Content and balance are data-driven and versioned.

# Factions Index (v0.1)

## 1. Canonical Faction List

### 1.1 Starter Factions (5)
1. Kingdom of Light
2. Shadow Empire
3. Nordic Clan
4. Elemental Council
5. Arcanum Republic

### 1.2 DLC Factions (20)
1. Desert Tribes
2. Techno-Orcs
3. Blood Sea Pirates
4. Cult of Forgotten Gods
5. Neo-Religious Syndicate
6. Wolf Tribe
7. Freedom Faction (Cyberpunk)
8. Mountain Dwarven Empire
9. Dragon Faction
10. Vampire Faction
11. Knights of the Star Order
12. Underwater Civilization
13. Beastfolk of the Forest
14. Bohemian Assassins
15. Technomagic Academy
16. Black Sun Wastelands
17. Rainbow Fae
18. Cosmic Martians
19. Steamwolf Tribe
20. Defiled Church

## 2. Standard Faction Composition
- 30 unique units per faction.
- Role distribution:
- 6 Assault;
- 5 Defender;
- 5 Ranger;
- 5 Mage;
- 3 Scout;
- 3 Healer;
- 3 Support.

## 3. Minimum Faction Profile
Each faction must define:
1. `id` and localized `name`.
2. `identity` (2-6 words describing playstyle).
3. `mechanic` (central unique mechanic).
4. Counter-weakness set.
5. Key synergy set.
6. Visual language (palette, shape language, FX style).

## 4. Minimum Unit Profile
Each unit must define:
1. Faction and role.
2. Base stats: HP, Armor, Resistance, Attack, Speed, Initiative, Energy/Mana.
3. Two active abilities.
4. One passive ability.
5. One ultimate ability (unlocked at late progression).
6. Full progression tree and final unique node.

## 5. Content Scalability Rules
1. All units must be fully data-driven.
2. Adding DLC must not require battle-engine code changes.
3. Every DLC faction should include:
- its own 30-unit roster;
- seasonal scenarios/rules;
- at least one unique meta-defining mechanic.

## 6. Current Codebase Status
- `packages/game-data` already contains a scaffold for 25 factions and 750 units.
- Unit names and abilities are currently technical/generated placeholders.
- Full migration to curated designer-authored data is required.

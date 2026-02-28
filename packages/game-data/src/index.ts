import { z } from "zod";
import type {
  AbilityDefinition,
  FactionDefinition,
  GameDataResponse,
  Loadout,
  SynergyState,
  UnitDefinition,
  UnitRole,
  UnitStats
} from "@warprotocol/shared-types";

const roleDistribution: Record<UnitRole, number> = {
  assault: 6,
  defender: 5,
  ranger: 5,
  mage: 5,
  scout: 3,
  healer: 3,
  support: 3
};

const roleOrder: UnitRole[] = [
  ...Array.from({ length: roleDistribution.assault }, () => "assault" as const),
  ...Array.from({ length: roleDistribution.defender }, () => "defender" as const),
  ...Array.from({ length: roleDistribution.ranger }, () => "ranger" as const),
  ...Array.from({ length: roleDistribution.mage }, () => "mage" as const),
  ...Array.from({ length: roleDistribution.scout }, () => "scout" as const),
  ...Array.from({ length: roleDistribution.healer }, () => "healer" as const),
  ...Array.from({ length: roleDistribution.support }, () => "support" as const)
];

const factions: FactionDefinition[] = [
  { id: "kingdom-of-light", name: "Kingdom of Light", identity: "balanced-discipline", mechanic: "auras-and-order" },
  { id: "shadow-empire", name: "Shadow Empire", identity: "resurrection-curses", mechanic: "grave-pacts" },
  { id: "nordic-clan", name: "Nordic Clan", identity: "fury-burst", mechanic: "rage-stacks" },
  { id: "elemental-council", name: "Elemental Council", identity: "field-control-aoe", mechanic: "terrain-attunement" },
  { id: "arcanum-republic", name: "Arcanum Republic", identity: "technomancy", mechanic: "module-overclock" },
  { id: "desert-tribes", name: "Desert Tribes", identity: "heat-mobility", mechanic: "sandstorm-momentum" },
  { id: "techno-orcs", name: "Techno-Orcs", identity: "brutal-cyber", mechanic: "scrap-rush" },
  { id: "blood-sea-pirates", name: "Blood Sea Pirates", identity: "boarding-chaos", mechanic: "plunder-stacks" },
  { id: "dragon-conclave", name: "Dragon Conclave", identity: "draconic-pride", mechanic: "flight-phases" },
  { id: "house-of-night", name: "House of Night", identity: "vampiric-control", mechanic: "blood-tithes" },
  { id: "cosmic-order", name: "Cosmic Order", identity: "astral-law", mechanic: "constellation-links" },
  { id: "abyssal-empire", name: "Abyssal Empire", identity: "deep-pressure", mechanic: "tide-cycles" },
  { id: "beastwood-tribes", name: "Beastwood Tribes", identity: "wild-hunt", mechanic: "pack-instinct" },
  { id: "assassin-order", name: "Assassin Order", identity: "precision-elimination", mechanic: "mark-and-execute" },
  { id: "techno-mage-academy", name: "Technomage Academy", identity: "hybrid-casting", mechanic: "protocol-combos" },
  { id: "black-sun-wastes", name: "Black Sun Wastes", identity: "radiation-decay", mechanic: "corruption-zones" },
  { id: "rainbow-fae", name: "Rainbow Fae", identity: "trickster-synergy", mechanic: "spectrum-chains" },
  { id: "alien-collective", name: "Alien Collective", identity: "hive-evolution", mechanic: "adaptive-genomes" },
  { id: "steamwolves", name: "Steamwolves", identity: "pressure-machinery", mechanic: "boiler-charge" },
  { id: "defiled-church", name: "Defiled Church", identity: "twisted-faith", mechanic: "sacrament-rot" },
  { id: "stone-titans", name: "Stone Titans", identity: "monolithic-defense", mechanic: "tectonic-stance" },
  { id: "void-spirits", name: "Void Spirits", identity: "phase-control", mechanic: "entropy-threads" },
  { id: "cyber-samurai", name: "Cyber Samurai", identity: "tempo-duels", mechanic: "kata-overdrive" },
  { id: "necromechanics", name: "Necromechanics", identity: "death-machines", mechanic: "soul-forge" },
  { id: "chaos-elementals", name: "Chaos Elementals", identity: "randomized-power", mechanic: "chaos-surge" }
];

const statProfile: Record<UnitRole, UnitStats> = {
  assault: { hp: 120, armor: 10, resistance: 8, attack: 28, speed: 7, initiative: 7, energy: 100 },
  defender: { hp: 165, armor: 22, resistance: 18, attack: 18, speed: 4, initiative: 4, energy: 90 },
  ranger: { hp: 105, armor: 8, resistance: 10, attack: 25, speed: 6, initiative: 6, energy: 105 },
  mage: { hp: 95, armor: 6, resistance: 18, attack: 30, speed: 5, initiative: 5, energy: 120 },
  scout: { hp: 90, armor: 7, resistance: 9, attack: 24, speed: 9, initiative: 9, energy: 95 },
  healer: { hp: 100, armor: 9, resistance: 16, attack: 15, speed: 5, initiative: 5, energy: 130 },
  support: { hp: 110, armor: 11, resistance: 14, attack: 17, speed: 5, initiative: 6, energy: 120 }
};

const tierCycle: UnitDefinition["tier"][] = ["recruit", "experienced", "veteran", "elite", "legendary"];

const damageTypesByRole = {
  assault: ["slash", "blunt", "true"],
  defender: ["blunt", "light", "percent"],
  ranger: ["pierce", "poison", "lightning"],
  mage: ["fire", "ice", "dark"],
  scout: ["pierce", "poison", "sacrificial"],
  healer: ["light", "ice", "percent"],
  support: ["dark", "lightning", "percent"]
} as const;

const unitSchema = z.object({
  id: z.string(),
  name: z.string(),
  factionId: z.string(),
  role: z.enum(["assault", "defender", "ranger", "mage", "scout", "healer", "support"]),
  tier: z.enum(["recruit", "experienced", "veteran", "elite", "legendary"]),
  stats: z.object({
    hp: z.number().positive(),
    armor: z.number().nonnegative(),
    resistance: z.number().nonnegative(),
    attack: z.number().positive(),
    speed: z.number().positive(),
    initiative: z.number().positive(),
    energy: z.number().positive()
  }),
  actives: z.tuple([
    z.object({
      id: z.string(),
      name: z.string(),
      damageType: z.string(),
      energyCost: z.number().nonnegative(),
      power: z.number().positive(),
      tags: z.array(z.string())
    }),
    z.object({
      id: z.string(),
      name: z.string(),
      damageType: z.string(),
      energyCost: z.number().nonnegative(),
      power: z.number().positive(),
      tags: z.array(z.string())
    })
  ]),
  passive: z.object({
    id: z.string(),
    name: z.string(),
    damageType: z.string(),
    energyCost: z.number().nonnegative(),
    power: z.number().positive(),
    tags: z.array(z.string())
  }),
  ultimate: z.object({
    id: z.string(),
    name: z.string(),
    damageType: z.string(),
    energyCost: z.number().nonnegative(),
    power: z.number().positive(),
    tags: z.array(z.string())
  })
});

const factionSchema = z.object({
  id: z.string(),
  name: z.string(),
  identity: z.string(),
  mechanic: z.string()
});

function clampStat(value: number): number {
  return Math.max(1, Math.round(value));
}

function createAbility(unitId: string, slot: "active-1" | "active-2" | "passive" | "ultimate", role: UnitRole, factionId: string, powerMultiplier: number): AbilityDefinition {
  const typePool = damageTypesByRole[role];
  const selectedType = typePool[slot === "active-1" ? 0 : slot === "active-2" ? 1 : 2];
  const basePower = role === "defender" ? 16 : role === "healer" ? 14 : 22;
  const energyCost = slot === "ultimate" ? 70 : slot === "passive" ? 0 : 30;
  return {
    id: `${unitId}:${slot}`,
    name: `${role}-${slot}-${factionId}`,
    damageType: selectedType,
    energyCost,
    power: clampStat(basePower * powerMultiplier),
    tags: [role, slot, factionId]
  };
}

function createUnit(faction: FactionDefinition, role: UnitRole, indexInRole: number, globalIndex: number): UnitDefinition {
  const unitId = `${faction.id}:${role}:${indexInRole + 1}`;
  const tier = tierCycle[globalIndex % tierCycle.length];
  const base = statProfile[role];
  const tierScale = 1 + (tierCycle.indexOf(tier) * 0.06);
  const roleVariance = 1 + (indexInRole % 3) * 0.03;
  const scale = tierScale * roleVariance;

  const stats: UnitStats = {
    hp: clampStat(base.hp * scale),
    armor: clampStat(base.armor * scale),
    resistance: clampStat(base.resistance * scale),
    attack: clampStat(base.attack * scale),
    speed: clampStat(base.speed + (indexInRole % 2)),
    initiative: clampStat(base.initiative + (indexInRole % 2)),
    energy: clampStat(base.energy + tierCycle.indexOf(tier) * 5)
  };

  return {
    id: unitId,
    name: `${faction.name} ${role.toUpperCase()} ${indexInRole + 1}`,
    factionId: faction.id,
    role,
    tier,
    stats,
    actives: [
      createAbility(unitId, "active-1", role, faction.id, scale),
      createAbility(unitId, "active-2", role, faction.id, scale * 1.1)
    ],
    passive: createAbility(unitId, "passive", role, faction.id, scale * 0.7),
    ultimate: createAbility(unitId, "ultimate", role, faction.id, scale * 1.8)
  };
}

export function buildUnitCatalog(): UnitDefinition[] {
  const units: UnitDefinition[] = [];
  factions.forEach((faction) => {
    let globalIndex = 0;
    const roleCounters: Record<UnitRole, number> = {
      assault: 0,
      defender: 0,
      ranger: 0,
      mage: 0,
      scout: 0,
      healer: 0,
      support: 0
    };

    roleOrder.forEach((role) => {
      const indexInRole = roleCounters[role];
      units.push(createUnit(faction, role, indexInRole, globalIndex));
      roleCounters[role] += 1;
      globalIndex += 1;
    });
  });

  if (units.length !== 750) {
    throw new Error(`Expected 750 units, received ${units.length}`);
  }

  const uniqueIds = new Set(units.map((unit) => unit.id));
  if (uniqueIds.size !== units.length) {
    throw new Error("Unit id collision detected.");
  }

  units.forEach((unit) => unitSchema.parse(unit));
  return units;
}

export function getFactions(): FactionDefinition[] {
  factions.forEach((faction) => factionSchema.parse(faction));
  return factions;
}

export function getGameData(balanceVersion = "0.1.0-alpha"): GameDataResponse {
  return {
    balanceVersion,
    factions: getFactions(),
    units: buildUnitCatalog()
  };
}

export function computeSynergy(unitDefs: UnitDefinition[]): SynergyState {
  const factionCounts: Record<string, number> = {};
  const roleCounts: Record<UnitRole, number> = {
    assault: 0,
    defender: 0,
    ranger: 0,
    mage: 0,
    scout: 0,
    healer: 0,
    support: 0
  };

  for (const unit of unitDefs) {
    factionCounts[unit.factionId] = (factionCounts[unit.factionId] ?? 0) + 1;
    roleCounts[unit.role] += 1;
  }

  const factionBonuses: Record<string, 0 | 1 | 2 | 3> = {};
  for (const [factionId, count] of Object.entries(factionCounts)) {
    factionBonuses[factionId] = count >= 7 ? 3 : count >= 5 ? 2 : count >= 3 ? 1 : 0;
  }

  const roleBonuses: Record<UnitRole, 0 | 1 | 2> = {
    assault: roleCounts.assault >= 4 ? 2 : roleCounts.assault >= 2 ? 1 : 0,
    defender: roleCounts.defender >= 4 ? 2 : roleCounts.defender >= 2 ? 1 : 0,
    ranger: roleCounts.ranger >= 4 ? 2 : roleCounts.ranger >= 2 ? 1 : 0,
    mage: roleCounts.mage >= 4 ? 2 : roleCounts.mage >= 2 ? 1 : 0,
    scout: roleCounts.scout >= 4 ? 2 : roleCounts.scout >= 2 ? 1 : 0,
    healer: roleCounts.healer >= 4 ? 2 : roleCounts.healer >= 2 ? 1 : 0,
    support: roleCounts.support >= 4 ? 2 : roleCounts.support >= 2 ? 1 : 0
  };

  return { factionBonuses, roleBonuses };
}

export interface LoadoutValidationResult {
  ok: boolean;
  errors: string[];
  synergy?: SynergyState;
}

export function validateLoadout(loadout: Loadout, allUnits: UnitDefinition[]): LoadoutValidationResult {
  const errors: string[] = [];
  const selected = loadout.unitIds.map((unitId) => allUnits.find((unit) => unit.id === unitId));

  if (selected.some((item) => item === undefined)) {
    errors.push("unknown_unit_id");
  }

  if (loadout.unitIds.length === 0) {
    errors.push("empty_loadout");
  }

  if (loadout.unitIds.length > 10) {
    errors.push("unit_limit_exceeded");
  }

  const uniqueCount = new Set(loadout.unitIds).size;
  if (uniqueCount !== loadout.unitIds.length) {
    errors.push("duplicate_unit");
  }

  const concreteUnits = selected.filter((item): item is UnitDefinition => item !== undefined);
  const energyCost = concreteUnits.reduce((sum, unit) => sum + unit.stats.energy, 0);
  if (energyCost > loadout.energyCap) {
    errors.push("energy_cap_exceeded");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors,
    synergy: computeSynergy(concreteUnits)
  };
}

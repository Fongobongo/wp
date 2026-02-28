export type DamageFamily = "physical" | "magical" | "special";

export type DamageType =
  | "slash"
  | "pierce"
  | "blunt"
  | "fire"
  | "ice"
  | "lightning"
  | "poison"
  | "dark"
  | "light"
  | "true"
  | "percent"
  | "sacrificial";

export type UnitRole =
  | "assault"
  | "defender"
  | "ranger"
  | "mage"
  | "scout"
  | "healer"
  | "support";

export interface UnitStats {
  hp: number;
  armor: number;
  resistance: number;
  attack: number;
  speed: number;
  initiative: number;
  energy: number;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  damageType: DamageType;
  energyCost: number;
  power: number;
  tags: string[];
}

export interface UnitDefinition {
  id: string;
  name: string;
  factionId: string;
  role: UnitRole;
  tier: "recruit" | "experienced" | "veteran" | "elite" | "legendary";
  stats: UnitStats;
  actives: [AbilityDefinition, AbilityDefinition];
  passive: AbilityDefinition;
  ultimate: AbilityDefinition;
}

export interface FactionDefinition {
  id: string;
  name: string;
  identity: string;
  mechanic: string;
}

export interface Loadout {
  playerId: string;
  unitIds: string[];
  energyCap: number;
}

export interface SynergyState {
  factionBonuses: Record<string, 0 | 1 | 2 | 3>;
  roleBonuses: Record<UnitRole, 0 | 1 | 2>;
}

export interface BattleSeed {
  value: number;
}

export interface BattleUnitSnapshot {
  id: string;
  playerId: string;
  unitId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  armor: number;
  resistance: number;
  attack: number;
  speed: number;
  alive: boolean;
}

export interface BattleSnapshot {
  id: string;
  tick: number;
  turn: number;
  units: BattleUnitSnapshot[];
}

export type BattleEventType =
  | "prep"
  | "initiative"
  | "move"
  | "attack"
  | "ability"
  | "death"
  | "round_end"
  | "match_end";

export interface BattleEvent {
  id: string;
  seq: number;
  tick: number;
  type: BattleEventType;
  payload: Record<string, unknown>;
}

export interface DamageEvent {
  sourceUnitId: string;
  targetUnitId: string;
  amount: number;
  damageType: DamageType;
  blockedByArmor: number;
  blockedByResistance: number;
}

export interface StatusEffect {
  id: string;
  unitId: string;
  kind: "dot" | "slow" | "buff" | "debuff" | "cleanse";
  durationTurns: number;
  magnitude: number;
}

export interface MatchResult {
  matchId: string;
  winnerPlayerId: string | "draw";
  events: BattleEvent[];
  balanceVersion: string;
}

export interface RatingDelta {
  playerId: string;
  before: number;
  after: number;
  delta: number;
}

export interface RewardBundle {
  playerId: string;
  credits: number;
  battlePassXp: number;
  cosmeticsUnlocked: string[];
}

export interface QueueJoinRequest {
  playerId: string;
  mmr: number;
  loadout: Loadout;
}

export interface QueueJoinResponse {
  status: "queued" | "matched";
  queueTicket?: string;
  matchId?: string;
  websocketUrl?: string;
  opponentPlayerId?: string;
}

export interface QueueLeaveRequest {
  playerId: string;
}

export interface QueueLeaveResponse {
  removed: boolean;
}

export interface GameDataResponse {
  balanceVersion: string;
  factions: FactionDefinition[];
  units: UnitDefinition[];
}

export interface Profile {
  playerId: string;
  displayName: string;
  rating: number;
  accountLevel: number;
  season: string;
}

export interface InventoryItem {
  id: string;
  type: "unit_skin" | "banner" | "emote";
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export interface BattlePassState {
  seasonId: string;
  level: number;
  premium: boolean;
  freeRewardsClaimed: number[];
  premiumRewardsClaimed: number[];
}

export interface ApiError {
  code: string;
  message: string;
}

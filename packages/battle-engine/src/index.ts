import type {
  BattleEvent,
  BattleSnapshot,
  BattleUnitSnapshot,
  MatchResult,
  UnitDefinition
} from "@warprotocol/shared-types";

export interface PlayerBattleInput {
  playerId: string;
  units: UnitDefinition[];
}

export interface BattleSimulationInput {
  matchId: string;
  seed: number;
  balanceVersion: string;
  players: readonly [PlayerBattleInput, PlayerBattleInput];
  grid: {
    width: number;
    height: number;
  };
  fixedTickMs: number;
  maxRounds?: number;
}

export interface BattleSimulationOutput {
  initialSnapshot: BattleSnapshot;
  snapshot: BattleSnapshot;
  result: MatchResult;
}

function xorshift32(seed: number): () => number {
  let x = seed | 0;
  if (x === 0) {
    x = 0x9e3779b9;
  }
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

function rngInt(next: () => number, min: number, max: number): number {
  return Math.floor(next() * (max - min + 1)) + min;
}

function cloneSnapshot(snapshot: BattleSnapshot): BattleSnapshot {
  return {
    id: snapshot.id,
    tick: snapshot.tick,
    turn: snapshot.turn,
    units: snapshot.units.map((unit) => ({ ...unit }))
  };
}

function createInitialSnapshot(input: BattleSimulationInput): BattleSnapshot {
  const [left, right] = input.players;
  const units: BattleUnitSnapshot[] = [];

  left.units.forEach((unit, idx) => {
    units.push({
      id: `${left.playerId}:${unit.id}`,
      playerId: left.playerId,
      unitId: unit.id,
      x: 0,
      y: idx % input.grid.height,
      hp: unit.stats.hp,
      maxHp: unit.stats.hp,
      armor: unit.stats.armor,
      resistance: unit.stats.resistance,
      attack: unit.stats.attack,
      speed: unit.stats.speed,
      alive: true
    });
  });

  right.units.forEach((unit, idx) => {
    units.push({
      id: `${right.playerId}:${unit.id}`,
      playerId: right.playerId,
      unitId: unit.id,
      x: input.grid.width - 1,
      y: idx % input.grid.height,
      hp: unit.stats.hp,
      maxHp: unit.stats.hp,
      armor: unit.stats.armor,
      resistance: unit.stats.resistance,
      attack: unit.stats.attack,
      speed: unit.stats.speed,
      alive: true
    });
  });

  return {
    id: input.matchId,
    tick: 0,
    turn: 0,
    units
  };
}

function manhattan(a: BattleUnitSnapshot, b: BattleUnitSnapshot): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function byInitiativeDesc(a: { initiative: number }, b: { initiative: number }): number {
  return b.initiative - a.initiative;
}

function findNearestEnemy(actor: BattleUnitSnapshot, units: BattleUnitSnapshot[]): BattleUnitSnapshot | undefined {
  const enemies = units.filter((unit) => unit.alive && unit.playerId !== actor.playerId);
  if (enemies.length === 0) {
    return undefined;
  }

  let nearest = enemies[0];
  let bestDistance = manhattan(actor, nearest);
  for (let i = 1; i < enemies.length; i += 1) {
    const candidate = enemies[i];
    const distance = manhattan(actor, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = candidate;
    }
  }
  return nearest;
}

function stepToward(actor: BattleUnitSnapshot, target: BattleUnitSnapshot, grid: { width: number; height: number }): { x: number; y: number } {
  const dx = target.x - actor.x;
  const dy = target.y - actor.y;

  let nextX = actor.x;
  let nextY = actor.y;

  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    nextX += Math.sign(dx);
  } else if (dy !== 0) {
    nextY += Math.sign(dy);
  }

  return {
    x: Math.max(0, Math.min(grid.width - 1, nextX)),
    y: Math.max(0, Math.min(grid.height - 1, nextY))
  };
}

function emitEvent(events: BattleEvent[], tick: number, type: BattleEvent["type"], payload: Record<string, unknown>): BattleEvent {
  const seq = events.length + 1;
  const event: BattleEvent = {
    id: `evt-${seq}`,
    seq,
    tick,
    type,
    payload
  };
  events.push(event);
  return event;
}

function calculateDamage(rawDamage: number, target: BattleUnitSnapshot): number {
  const armorBlock = target.armor * 0.28;
  const resistanceBlock = target.resistance * 0.18;
  return Math.max(1, Math.round(rawDamage - armorBlock - resistanceBlock));
}

function winnerFromState(snapshot: BattleSnapshot): string | "draw" {
  const aliveByPlayer = new Map<string, number>();
  for (const unit of snapshot.units) {
    if (unit.alive) {
      aliveByPlayer.set(unit.playerId, (aliveByPlayer.get(unit.playerId) ?? 0) + 1);
    }
  }

  if (aliveByPlayer.size === 0) {
    return "draw";
  }
  if (aliveByPlayer.size === 1) {
    return [...aliveByPlayer.keys()][0];
  }
  return "draw";
}

export function simulateBattle(input: BattleSimulationInput): BattleSimulationOutput {
  const nextRand = xorshift32(input.seed);
  const initialSnapshot = createInitialSnapshot(input);
  const snapshot = cloneSnapshot(initialSnapshot);
  const events: BattleEvent[] = [];
  const maxRounds = input.maxRounds ?? 40;

  emitEvent(events, snapshot.tick, "prep", {
    matchId: input.matchId,
    fixedTickMs: input.fixedTickMs,
    players: input.players.map((player) => ({ playerId: player.playerId, units: player.units.length }))
  });

  for (let round = 1; round <= maxRounds; round += 1) {
    snapshot.turn = round;
    snapshot.tick += 1;

    const alive = snapshot.units.filter((unit) => unit.alive);
    const distinctAlivePlayers = new Set(alive.map((unit) => unit.playerId));
    if (distinctAlivePlayers.size <= 1) {
      break;
    }

    const order = alive
      .map((unit) => ({ unitId: unit.id, initiative: unit.speed + rngInt(nextRand, 0, 5) }))
      .sort(byInitiativeDesc);

    emitEvent(events, snapshot.tick, "initiative", {
      round,
      order
    });

    for (const turnData of order) {
      snapshot.tick += 1;
      const actor = snapshot.units.find((unit) => unit.id === turnData.unitId);
      if (!actor || !actor.alive) {
        continue;
      }

      const target = findNearestEnemy(actor, snapshot.units);
      if (!target) {
        break;
      }

      const distance = manhattan(actor, target);
      if (distance > 1) {
        const nextPos = stepToward(actor, target, input.grid);
        actor.x = nextPos.x;
        actor.y = nextPos.y;
        emitEvent(events, snapshot.tick, "move", {
          actorId: actor.id,
          x: actor.x,
          y: actor.y
        });
      }

      const refreshedTarget = snapshot.units.find((unit) => unit.id === target.id);
      if (!refreshedTarget || !refreshedTarget.alive) {
        continue;
      }

      if (manhattan(actor, refreshedTarget) <= 1) {
        const rawDamage = actor.attack + rngInt(nextRand, 0, 6);
        const dealt = calculateDamage(rawDamage, refreshedTarget);
        refreshedTarget.hp -= dealt;
        emitEvent(events, snapshot.tick, "attack", {
          sourceUnitId: actor.id,
          targetUnitId: refreshedTarget.id,
          amount: dealt,
          hpLeft: Math.max(0, refreshedTarget.hp)
        });

        if (refreshedTarget.hp <= 0) {
          refreshedTarget.alive = false;
          refreshedTarget.hp = 0;
          emitEvent(events, snapshot.tick, "death", {
            unitId: refreshedTarget.id
          });
        }
      }
    }

    emitEvent(events, snapshot.tick, "round_end", {
      round,
      alive: snapshot.units.filter((unit) => unit.alive).length
    });
  }

  const winnerPlayerId = winnerFromState(snapshot);
  emitEvent(events, snapshot.tick + 1, "match_end", {
    winnerPlayerId
  });

  return {
    initialSnapshot,
    snapshot,
    result: {
      matchId: input.matchId,
      winnerPlayerId,
      events,
      balanceVersion: input.balanceVersion
    }
  };
}

export interface ReplayState {
  snapshot: BattleSnapshot;
  seenEventIds: Set<string>;
}

export function reduceEventsIdempotent(initial: BattleSnapshot, events: BattleEvent[], knownEventIds?: Set<string>): ReplayState {
  const snapshot = cloneSnapshot(initial);
  const seenEventIds = knownEventIds ? new Set(knownEventIds) : new Set<string>();

  for (const event of events) {
    if (seenEventIds.has(event.id)) {
      continue;
    }
    seenEventIds.add(event.id);

    if (event.type === "move") {
      const actor = snapshot.units.find((unit) => unit.id === String(event.payload.actorId));
      if (actor) {
        actor.x = Number(event.payload.x);
        actor.y = Number(event.payload.y);
      }
    }

    if (event.type === "attack") {
      const target = snapshot.units.find((unit) => unit.id === String(event.payload.targetUnitId));
      if (target) {
        target.hp = Number(event.payload.hpLeft);
        if (target.hp <= 0) {
          target.alive = false;
        }
      }
    }

    if (event.type === "death") {
      const unit = snapshot.units.find((candidate) => candidate.id === String(event.payload.unitId));
      if (unit) {
        unit.alive = false;
        unit.hp = 0;
      }
    }
  }

  return {
    snapshot,
    seenEventIds
  };
}

export function replayBattleFromInitial(initial: BattleSnapshot, events: BattleEvent[]): BattleSnapshot {
  return reduceEventsIdempotent(initial, events).snapshot;
}

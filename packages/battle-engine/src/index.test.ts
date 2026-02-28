import { describe, expect, it } from "vitest";
import { buildUnitCatalog } from "@warprotocol/game-data";
import { reduceEventsIdempotent, replayBattleFromInitial, simulateBattle } from "./index.js";

function makeInput(seed: number) {
  const units = buildUnitCatalog();
  const leftUnits = units.slice(0, 6);
  const rightUnits = units.slice(30, 36);

  return {
    matchId: "match-1",
    seed,
    balanceVersion: "0.1.0-alpha",
    players: [
      { playerId: "p1", units: leftUnits },
      { playerId: "p2", units: rightUnits }
    ] as const,
    grid: { width: 8, height: 8 },
    fixedTickMs: 250,
    maxRounds: 15
  };
}

describe("battle-engine", () => {
  it("is deterministic for equal seed and input", () => {
    const first = simulateBattle(makeInput(424242));
    const second = simulateBattle(makeInput(424242));

    expect(first.result.winnerPlayerId).toBe(second.result.winnerPlayerId);
    expect(first.result.events).toEqual(second.result.events);
  });

  it("can replay event log into final state", () => {
    const simulation = simulateBattle(makeInput(42));
    const replayed = replayBattleFromInitial(simulation.initialSnapshot, simulation.result.events);

    const aliveOriginal = simulation.snapshot.units.filter((u) => u.alive).map((u) => u.id).sort();
    const aliveReplayed = replayed.units.filter((u) => u.alive).map((u) => u.id).sort();

    expect(aliveReplayed).toEqual(aliveOriginal);
  });

  it("applies duplicate events idempotently", () => {
    const simulation = simulateBattle(makeInput(7));
    const events = simulation.result.events.slice(0, 20);
    const duplicated = [...events, ...events];

    const initial = simulation.initialSnapshot;

    const once = reduceEventsIdempotent(initial, events);
    const twice = reduceEventsIdempotent(initial, duplicated);

    expect(twice.snapshot.units).toEqual(once.snapshot.units);
  });
});

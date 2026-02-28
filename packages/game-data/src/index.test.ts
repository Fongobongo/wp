import { describe, expect, it } from "vitest";
import { buildUnitCatalog, getFactions, validateLoadout } from "./index.js";

describe("game-data", () => {
  it("builds 25 factions and 750 unique units", () => {
    const factions = getFactions();
    const units = buildUnitCatalog();

    expect(factions).toHaveLength(25);
    expect(units).toHaveLength(750);
    expect(new Set(units.map((u) => u.id)).size).toBe(750);
  });

  it("validates loadout caps and synergy", () => {
    const units = buildUnitCatalog();
    const selected = units.slice(0, 7);
    const result = validateLoadout(
      {
        playerId: "p1",
        unitIds: selected.map((u) => u.id),
        energyCap: 1000
      },
      units
    );

    expect(result.ok).toBe(true);
    expect(result.synergy).toBeDefined();
  });

  it("rejects invalid loadout", () => {
    const units = buildUnitCatalog();
    const result = validateLoadout(
      {
        playerId: "p2",
        unitIds: ["bad-id"],
        energyCap: 10
      },
      units
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("unknown_unit_id");
  });
});

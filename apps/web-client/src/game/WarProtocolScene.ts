import Phaser from "phaser";
import { DEMO_UNITS } from "./demoData.js";

const HEX_SIZE = 34;
const COLS = 8;
const ROWS = 7;
const ORIGIN_X = 150;
const ORIGIN_Y = 110;

type TileType = "plain" | "cover" | "elevation" | "energy" | "trap";
type CoordKey = `${number},${number}`;

type TileNode = {
  q: number;
  r: number;
  type: TileType;
  polygon: Phaser.GameObjects.Polygon;
};

type UnitTemplate = (typeof DEMO_UNITS)[number];

type UnitState = UnitTemplate & {
  q: number;
  r: number;
};

type UnitSprite = {
  state: UnitState;
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  hpLabel: Phaser.GameObjects.Text;
};

function compactUnitName(name: string): string {
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase() || "UNIT";
}

const TILE_COLORS: Record<TileType, number> = {
  plain: 0x31445a,
  cover: 0x2d5f4a,
  elevation: 0x5a4f38,
  energy: 0x305f7f,
  trap: 0x6b3544
};

const TILE_LABELS: Array<{ type: TileType; label: string }> = [
  { type: "plain", label: "Plain" },
  { type: "cover", label: "Cover" },
  { type: "elevation", label: "Elevation" },
  { type: "energy", label: "Energy" },
  { type: "trap", label: "Trap" }
];

function hexPoints(size: number): Phaser.Types.Math.Vector2Like[] {
  const points: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 6; i += 1) {
    // Pointy-top hex orientation to match axial->world conversion below.
    const angle = Phaser.Math.DegToRad(60 * i - 90);
    points.push({
      x: size * Math.cos(angle),
      y: size * Math.sin(angle)
    });
  }
  return points;
}

function axialToWorld(q: number, r: number): { x: number; y: number } {
  const x = Math.round(ORIGIN_X + HEX_SIZE * Math.sqrt(3) * (q + r / 2));
  const y = Math.round(ORIGIN_Y + HEX_SIZE * 1.5 * r);
  return { x, y };
}

function pickTileType(q: number, r: number): TileType {
  const roll = (q * 11 + r * 7 + q * r * 3) % 9;
  if (roll === 0) {
    return "trap";
  }
  if (roll <= 2) {
    return "energy";
  }
  if (roll <= 4) {
    return "cover";
  }
  if (roll <= 6) {
    return "elevation";
  }
  return "plain";
}

export class WarProtocolScene extends Phaser.Scene {
  private readonly tiles = new Map<CoordKey, TileNode>();
  private readonly units = new Map<string, UnitSprite>();
  private readonly reserveUnits = new Map<string, UnitTemplate>();
  private readonly occupiedTiles = new Map<CoordKey, string>();
  private readonly actedThisTurn = new Set<string>();

  private selectedUnitId: string | null = null;
  private selectedReserveUnitId: string | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private currentTeam: "Blue" | "Red" = "Blue";
  private turnNumber = 1;

  constructor() {
    super("war-protocol-scene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0d1219");
    this.cameras.main.roundPixels = true;

    for (const unit of DEMO_UNITS) {
      this.reserveUnits.set(unit.id, unit);
    }

    this.drawHexBoard();
    this.drawLegend();
    this.drawStatusLine();
    this.refreshHighlights();
    this.emitTurnState();
    this.emitRosterState();
  }

  public endTurn(): void {
    this.selectedUnitId = null;
    this.selectedReserveUnitId = null;
    this.actedThisTurn.clear();
    this.currentTeam = this.currentTeam === "Blue" ? "Red" : "Blue";
    this.turnNumber += 1;
    this.statusText.setText(`Turn ${this.turnNumber} started. Active team: ${this.currentTeam}.`);
    this.emitTurnState();
    this.emitRosterState();
    this.refreshHighlights();
  }

  public selectReserveUnit(unitId: string): void {
    if (this.units.has(unitId)) {
      this.statusText.setText("This unit is already deployed.");
      return;
    }

    const unit = this.reserveUnits.get(unitId);
    if (!unit) {
      return;
    }

    this.selectedUnitId = null;
    this.selectedReserveUnitId = unitId;
    this.statusText.setText(`Deploy ${unit.name}: click any empty hex.`);
    this.emitRosterState();
    this.refreshHighlights();
  }

  public deployReserveUnitAtWorld(unitId: string, worldX: number, worldY: number): void {
    if (!this.reserveUnits.has(unitId) || this.units.has(unitId)) {
      return;
    }
    const snappedTile = this.findClosestTileForDrop(worldX, worldY);
    if (!snappedTile) {
      this.statusText.setText("Drop target is outside battlefield.");
      return;
    }

    const destinationKey = this.tileKey(snappedTile.q, snappedTile.r);
    if (this.occupiedTiles.has(destinationKey)) {
      this.statusText.setText("Target hex is occupied.");
      return;
    }

    this.placeReserveUnit(unitId, snappedTile.q, snappedTile.r);
  }

  private findClosestTileForDrop(
    worldX: number,
    worldY: number
  ): { q: number; r: number } | null {
    let bestTile: { q: number; r: number } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const [, tile] of this.tiles) {
      const center = axialToWorld(tile.q, tile.r);
      const dx = worldX - center.x;
      const dy = worldY - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTile = { q: tile.q, r: tile.r };
      }
    }

    if (!bestTile) {
      return null;
    }

    if (bestDistance > HEX_SIZE * 0.92) {
      return null;
    }

    return bestTile;
  }

  private drawHexBoard(): void {
    const points = hexPoints(HEX_SIZE);

    for (let r = 0; r < ROWS; r += 1) {
      for (let q = 0; q < COLS; q += 1) {
        const { x, y } = axialToWorld(q, r);
        const tileType = pickTileType(q, r);
        const fillColor = TILE_COLORS[tileType];

        const tile = this.add.polygon(x, y, points, fillColor, 0.85);
        tile.setStrokeStyle(2, 0x1b2a38, 0.85);
        tile.setInteractive({ useHandCursor: true });
        tile.on("pointerdown", () => this.onTileClicked(q, r));

        this.tiles.set(this.tileKey(q, r), { q, r, type: tileType, polygon: tile });

        if ((q + r) % 4 === 0) {
          this.add
            .text(x, y, tileType[0].toUpperCase(), {
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#d7e4f4"
            })
            .setOrigin(0.5)
            .setAlpha(0.7);
        }
      }
    }
  }

  private getTileCenter(q: number, r: number): { x: number; y: number } {
    const tile = this.tiles.get(this.tileKey(q, r));
    if (tile) {
      return { x: tile.polygon.x, y: tile.polygon.y };
    }
    return axialToWorld(q, r);
  }

  private createUnitSprite(state: UnitState): UnitSprite {
    const { x, y } = this.getTileCenter(state.q, state.r);

    const body = this.add.circle(0, 0, 19, state.color, 0.96);
    body.setStrokeStyle(2, 0xe6edf6, 0.9);

    const shortName = compactUnitName(state.name);
    const nameLabel = this.add
      .text(0, -11, shortName, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f4f8ff"
      })
      .setOrigin(0.5);

    const roleLabel = this.add
      .text(0, 0, state.role[0], {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#091018"
      })
      .setOrigin(0.5);

    const hpLabel = this.add
      .text(0, 11, `${state.hp}`, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#c8d7e8"
      })
      .setOrigin(0.5);

    const root = this.add.container(x, y, [body, nameLabel, roleLabel, hpLabel]);
    root.setSize(40, 40);
    root.setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains);
    root.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.onUnitSelected(state.id);
    });
    root.setDepth(10);

    return { state, root, body, hpLabel };
  }

  private placeReserveUnit(unitId: string, q: number, r: number): void {
    const source = this.reserveUnits.get(unitId);
    if (!source || this.units.has(unitId)) {
      return;
    }

    const state: UnitState = { ...source, q, r };
    const sprite = this.createUnitSprite(state);

    this.units.set(unitId, sprite);
    this.occupiedTiles.set(this.tileKey(q, r), unitId);
    this.selectedReserveUnitId = null;

    this.statusText.setText(`${state.name} deployed at (${q}, ${r}).`);
    this.emitTurnState();
    this.emitRosterState();
    this.refreshHighlights();
  }

  private drawLegend(): void {
    const panel = this.add.rectangle(760, 120, 180, 170, 0x101a24, 0.88);
    panel.setStrokeStyle(1, 0x31465c, 0.95);

    this.add
      .text(760, 52, "Tile Types", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#e7f0fb"
      })
      .setOrigin(0.5);

    TILE_LABELS.forEach((item, index) => {
      const y = 78 + index * 24;
      this.add.rectangle(700, y, 14, 14, TILE_COLORS[item.type], 0.95).setStrokeStyle(1, 0xe8f0fb, 0.7);
      this.add
        .text(715, y - 6, item.label, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#d3dfec"
        })
        .setOrigin(0, 0);
    });
  }

  private drawStatusLine(): void {
    this.statusText = this.add
      .text(36, 585, "Deploy units from the roster, then move them on your turn.", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#e7f0fb"
      })
      .setOrigin(0, 0.5);
  }

  private onUnitSelected(unitId: string): void {
    const unit = this.units.get(unitId);
    if (!unit) {
      return;
    }

    this.selectedReserveUnitId = null;
    this.selectedUnitId = unitId;

    if (unit.state.team !== this.currentTeam) {
      this.statusText.setText(`It is ${this.currentTeam} team turn.`);
      this.selectedUnitId = null;
      this.refreshHighlights();
      return;
    }
    if (this.actedThisTurn.has(unitId)) {
      this.statusText.setText(`${unit.state.name} already acted this turn.`);
      this.selectedUnitId = null;
      this.refreshHighlights();
      return;
    }

    this.statusText.setText(`Turn ${this.turnNumber} (${this.currentTeam}): ${unit.state.name} selected.`);
    this.emitRosterState();
    this.refreshHighlights();
  }

  private onTileClicked(q: number, r: number): void {
    const destinationKey = this.tileKey(q, r);

    if (this.selectedReserveUnitId) {
      if (this.occupiedTiles.has(destinationKey)) {
        this.statusText.setText("Target hex is occupied.");
        return;
      }
      this.placeReserveUnit(this.selectedReserveUnitId, q, r);
      return;
    }

    if (!this.selectedUnitId) {
      this.statusText.setText("Select a unit first.");
      return;
    }

    const unit = this.units.get(this.selectedUnitId);
    if (!unit) {
      return;
    }

    const occupiedBy = this.occupiedTiles.get(destinationKey);
    if (occupiedBy && occupiedBy !== unit.state.id) {
      this.statusText.setText("Target hex is occupied.");
      return;
    }

    const distance = this.hexDistance(unit.state.q, unit.state.r, q, r);
    if (distance === 0) {
      this.statusText.setText("Unit is already on this hex.");
      return;
    }
    if (distance > unit.state.move) {
      this.statusText.setText(`Out of range. ${unit.state.name} can move up to ${unit.state.move} hexes.`);
      return;
    }

    const fromKey = this.tileKey(unit.state.q, unit.state.r);
    this.occupiedTiles.delete(fromKey);
    this.occupiedTiles.set(destinationKey, unit.state.id);

    unit.state.q = q;
    unit.state.r = r;
    const { x, y } = this.getTileCenter(q, r);

    this.tweens.add({
      targets: unit.root,
      x,
      y,
      duration: 180,
      ease: "Sine.Out"
    });

    this.actedThisTurn.add(unit.state.id);
    this.selectedUnitId = null;
    this.statusText.setText(`${unit.state.name} moved to (${q}, ${r}) and ended action.`);
    this.emitTurnState();
    this.autoEndTurnIfNeeded();
    this.refreshHighlights();
  }

  private refreshHighlights(): void {
    const selected = this.selectedUnitId ? this.units.get(this.selectedUnitId) : null;

    for (const [, tile] of this.tiles) {
      const baseColor = TILE_COLORS[tile.type];
      const key = this.tileKey(tile.q, tile.r);
      tile.polygon.setFillStyle(baseColor, 0.85);
      tile.polygon.setStrokeStyle(2, 0x1b2a38, 0.85);

      if (this.selectedReserveUnitId && !this.occupiedTiles.has(key)) {
        tile.polygon.setFillStyle(baseColor, 1);
        tile.polygon.setStrokeStyle(3, 0x9be7b0, 0.95);
        continue;
      }

      if (!selected) {
        continue;
      }

      const isOccupied = this.occupiedTiles.has(key);
      const distance = this.hexDistance(selected.state.q, selected.state.r, tile.q, tile.r);
      const inRange = distance > 0 && distance <= selected.state.move;

      if (inRange && !isOccupied) {
        tile.polygon.setFillStyle(baseColor, 1);
        tile.polygon.setStrokeStyle(3, 0xf4ce74, 0.95);
      }
    }

    for (const [, unit] of this.units) {
      const isCurrentTeam = unit.state.team === this.currentTeam;
      const hasActed = this.actedThisTurn.has(unit.state.id);

      if (this.selectedUnitId === unit.state.id) {
        unit.body.setStrokeStyle(3, 0xfff1a6, 1);
        unit.root.setDepth(15);
      } else {
        unit.body.setStrokeStyle(2, 0xe6edf6, 0.9);
        unit.root.setDepth(10);
      }
      unit.root.setAlpha(isCurrentTeam ? (hasActed ? 0.55 : 1) : 0.8);
      unit.hpLabel.setText(`${unit.state.hp}`);
    }
  }

  private autoEndTurnIfNeeded(): void {
    const available = this.getRemainingActions();
    if (available > 0) {
      return;
    }

    const hasAnyUnitsForTeam = Array.from(this.units.values()).some(
      (unit) => unit.state.team === this.currentTeam
    );
    if (hasAnyUnitsForTeam) {
      this.endTurn();
    }
  }

  private getRemainingActions(): number {
    let count = 0;
    for (const [, unit] of this.units) {
      if (unit.state.team === this.currentTeam && !this.actedThisTurn.has(unit.state.id)) {
        count += 1;
      }
    }
    return count;
  }

  private emitTurnState(): void {
    this.events.emit("turnStateChanged", {
      currentTeam: this.currentTeam,
      turnNumber: this.turnNumber,
      remainingActions: this.getRemainingActions()
    });
  }

  private emitRosterState(): void {
    this.events.emit("rosterStateChanged", {
      deployedUnitIds: Array.from(this.units.keys()),
      selectedReserveUnitId: this.selectedReserveUnitId
    });
  }

  private tileKey(q: number, r: number): CoordKey {
    return `${q},${r}`;
  }

  private hexDistance(aq: number, ar: number, bq: number, br: number): number {
    const dq = aq - bq;
    const dr = ar - br;
    const ds = (aq + ar) - (bq + br);
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
  }
}

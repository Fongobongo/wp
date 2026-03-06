import Phaser from "phaser";
import { DEMO_UNITS } from "./demoData.js";

const HEX_SIZE = 72;
const TILE_Q = 0;
const TILE_R = 0;
const TILE_FILL = 0x31445a;
const TILE_STROKE = 0x1b2a38;
const HIGHLIGHT_STROKE = 0x9be7b0;

type CoordKey = `${number},${number}`;

type TileNode = {
  q: number;
  r: number;
  graphics: Phaser.GameObjects.Graphics;
  centerX: number;
  centerY: number;
  vertices: Array<{ x: number; y: number }>;
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
};

export type BattleDebugState = {
  board: {
    cols: number;
    rows: number;
    hexSize: number;
    originX: number;
    originY: number;
  };
  statusText: string;
  tiles: Array<{
    q: number;
    r: number;
    centerX: number;
    centerY: number;
    vertices: Array<{
      x: number;
      y: number;
    }>;
  }>;
  units: Array<{
    id: string;
    name: string;
    color: number;
    q: number;
    r: number;
    rootX: number;
    rootY: number;
    tileCenterX: number;
    tileCenterY: number;
  }>;
};

function compactUnitName(name: string): string {
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase() || "UNIT";
}

function hexPoints(size: number): Phaser.Types.Math.Vector2Like[] {
  const points: Phaser.Types.Math.Vector2Like[] = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = Phaser.Math.DegToRad(60 * index - 90);
    points.push({
      x: size * Math.cos(angle),
      y: size * Math.sin(angle)
    });
  }
  return points;
}

export class WarProtocolScene extends Phaser.Scene {
  private readonly tiles = new Map<CoordKey, TileNode>();
  private readonly units = new Map<string, UnitSprite>();
  private readonly reserveUnits = new Map<string, UnitTemplate>();
  private readonly occupiedTiles = new Map<CoordKey, string>();

  private readonly pointCache = hexPoints(HEX_SIZE);

  private selectedReserveUnitId: string | null = null;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super("war-protocol-scene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0d1219");
    this.cameras.main.roundPixels = true;

    this.reserveUnits.clear();
    for (const unit of DEMO_UNITS) {
      this.reserveUnits.set(unit.id, unit);
    }

    this.createStatusText();
    this.ensureSingleTile();
    this.layoutScene();
    this.statusText.setText("Drag the unit into the hex.");
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.handleResize, this);
    });

    this.emitRosterState();
    this.refreshHighlights();
  }

  public selectReserveUnit(unitId: string): void {
    if (this.units.has(unitId)) {
      this.statusText.setText("The unit is already deployed.");
      return;
    }

    const unit = this.reserveUnits.get(unitId);
    if (!unit) {
      return;
    }

    this.selectedReserveUnitId = unitId;
    this.statusText.setText(`Place ${unit.name} into the hex.`);
    this.emitRosterState();
    this.refreshHighlights();
  }

  public deployReserveUnitAtWorld(unitId: string, worldX: number, worldY: number): void {
    if (!this.reserveUnits.has(unitId) || this.units.has(unitId)) {
      return;
    }

    const tile = this.findTileAtPoint(worldX, worldY);
    if (!tile) {
      this.statusText.setText("Drop target is outside the hex.");
      return;
    }

    const tileKey = this.tileKey(tile.q, tile.r);
    if (this.occupiedTiles.has(tileKey)) {
      this.statusText.setText("The hex is already occupied.");
      return;
    }

    this.placeReserveUnit(unitId, tile.q, tile.r);
  }

  public getDebugState(): BattleDebugState {
    const tile = this.tiles.get(this.tileKey(TILE_Q, TILE_R));
    const units = Array.from(this.units.values())
      .map((unit) => {
        const tileCenter = this.getTileCenter(unit.state.q, unit.state.r);
        return {
          id: unit.state.id,
          name: unit.state.name,
          color: unit.state.color,
          q: unit.state.q,
          r: unit.state.r,
          rootX: unit.root.x,
          rootY: unit.root.y,
          tileCenterX: tileCenter.x,
          tileCenterY: tileCenter.y
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id));

    return {
      board: {
        cols: 1,
        rows: 1,
        hexSize: HEX_SIZE,
        originX: tile?.centerX ?? this.scale.width / 2,
        originY: tile?.centerY ?? this.scale.height / 2
      },
      statusText: this.statusText?.text ?? "",
      tiles: tile
        ? [
            {
              q: tile.q,
              r: tile.r,
              centerX: tile.centerX,
              centerY: tile.centerY,
              vertices: tile.vertices
            }
          ]
        : [],
      units
    };
  }

  private handleResize(): void {
    this.layoutScene();
    this.refreshHighlights();
  }

  private createStatusText(): void {
    this.statusText = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#e7f0fb"
      })
      .setOrigin(0, 0.5);
  }

  private ensureSingleTile(): void {
    const key = this.tileKey(TILE_Q, TILE_R);
    if (this.tiles.has(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.setDepth(1);

    this.tiles.set(key, {
      q: TILE_Q,
      r: TILE_R,
      graphics,
      centerX: 0,
      centerY: 0,
      vertices: []
    });
  }

  private layoutScene(): void {
    const requestedCenterX = Math.round(this.scale.width / 2);
    const requestedCenterY = Math.round(this.scale.height * 0.42);
    const tile = this.tiles.get(this.tileKey(TILE_Q, TILE_R));

    if (tile) {
      tile.centerX = requestedCenterX;
      tile.centerY = requestedCenterY;
      tile.vertices = this.pointCache.map((point) => ({
        x: tile.centerX + point.x,
        y: tile.centerY + point.y
      }));
    }

    this.statusText.setPosition(36, this.scale.height - 28);

    for (const [, unit] of this.units) {
      const position = this.getTileCenter(unit.state.q, unit.state.r);
      unit.root.setPosition(position.x, position.y);
    }
  }

  private getTileCenter(q: number, r: number): { x: number; y: number } {
    const tile = this.tiles.get(this.tileKey(q, r));
    if (!tile) {
      return {
        x: Math.round(this.scale.width / 2),
        y: Math.round(this.scale.height * 0.42)
      };
    }
    return { x: tile.centerX, y: tile.centerY };
  }

  private createUnitSprite(state: UnitState): UnitSprite {
    const { x, y } = this.getTileCenter(state.q, state.r);

    const body = this.add.circle(0, 0, 28, state.color, 0.96);
    body.setStrokeStyle(3, 0xe6edf6, 0.95);

    const nameLabel = this.add
      .text(0, -11, compactUnitName(state.name), {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f4f8ff"
      })
      .setOrigin(0.5);

    const roleLabel = this.add
      .text(0, 1, state.role[0], {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#091018"
      })
      .setOrigin(0.5);

    const hpLabel = this.add
      .text(0, 14, `${state.hp}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#e7f0fb"
      })
      .setOrigin(0.5);

    const root = this.add.container(x, y, [body, nameLabel, roleLabel, hpLabel]);
    root.setDepth(10);

    return { state, root, body };
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

    this.statusText.setText(`${state.name} deployed into the hex.`);
    this.emitRosterState();
    this.refreshHighlights();
  }

  private refreshHighlights(): void {
    const tile = this.tiles.get(this.tileKey(TILE_Q, TILE_R));
    if (tile) {
      const isAvailable = this.selectedReserveUnitId && !this.occupiedTiles.has(this.tileKey(TILE_Q, TILE_R));
      this.redrawTile(tile, Boolean(isAvailable));
    }

    for (const [, unit] of this.units) {
      unit.body.setStrokeStyle(3, 0xe6edf6, 0.95);
      unit.root.setAlpha(1);
    }
  }

  private redrawTile(tile: TileNode, isHighlighted: boolean): void {
    tile.graphics.clear();
    tile.graphics.fillStyle(TILE_FILL, 0.9);
    tile.graphics.lineStyle(3, isHighlighted ? HIGHLIGHT_STROKE : TILE_STROKE, isHighlighted ? 1 : 0.95);
    tile.graphics.beginPath();
    tile.graphics.moveTo(tile.vertices[0].x, tile.vertices[0].y);
    for (let index = 1; index < tile.vertices.length; index += 1) {
      tile.graphics.lineTo(tile.vertices[index].x, tile.vertices[index].y);
    }
    tile.graphics.closePath();
    tile.graphics.fillPath();
    tile.graphics.strokePath();
  }

  private emitRosterState(): void {
    this.events.emit("rosterStateChanged", {
      deployedUnitIds: Array.from(this.units.keys()),
      selectedReserveUnitId: this.selectedReserveUnitId
    });
  }

  private findTileAtPoint(worldX: number, worldY: number): { q: number; r: number } | null {
    const tile = this.tiles.get(this.tileKey(TILE_Q, TILE_R));
    if (!tile) {
      return null;
    }

    return this.isPointInsidePolygon(worldX, worldY, tile.vertices)
      ? { q: tile.q, r: tile.r }
      : null;
  }

  private isPointInsidePolygon(
    x: number,
    y: number,
    vertices: Array<{ x: number; y: number }>
  ): boolean {
    let inside = false;
    let previousIndex = vertices.length - 1;

    for (let currentIndex = 0; currentIndex < vertices.length; currentIndex += 1) {
      const current = vertices[currentIndex];
      const previous = vertices[previousIndex];
      const intersects =
        current.y > y !== previous.y > y &&
        x <
          ((previous.x - current.x) * (y - current.y)) /
            ((previous.y - current.y) + Number.EPSILON) +
            current.x;

      if (intersects) {
        inside = !inside;
      }

      previousIndex = currentIndex;
    }

    return inside;
  }

  private tileKey(q: number, r: number): CoordKey {
    return `${q},${r}`;
  }
}

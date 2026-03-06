import Phaser from "phaser";
import { DEMO_UNITS } from "./demoData.js";

const HEX_SIZE = 58;
const ROW_LENGTHS = [5, 4, 5, 4, 5] as const;
const GRID_ROWS = ROW_LENGTHS.length;
const GRID_COLS = 5;
const TILE_FILL = 0x31445a;
const TILE_STROKE = 0x1b2a38;
const HIGHLIGHT_STROKE = 0x9be7b0;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HALF_WIDTH = Math.sqrt(3) * HEX_SIZE * 0.5;

type CoordKey = `${number},${number}`;

type TileNode = {
  q: number;
  r: number;
  graphics: Phaser.GameObjects.Graphics;
  highlightGraphics: Phaser.GameObjects.Graphics;
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
  selectedReserveUnitId: string | null;
  highlightedTiles: Array<{
    q: number;
    r: number;
  }>;
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

const TILE_LAYOUT: Array<{ q: number; r: number }> = [];
for (let r = 0; r < ROW_LENGTHS.length; r += 1) {
  const rowLength = ROW_LENGTHS[r];
  for (let q = 0; q < rowLength; q += 1) {
    TILE_LAYOUT.push({ q, r });
  }
}

function compactUnitName(name: string): string {
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase() || "UNIT";
}

function roleIconType(role: UnitTemplate["role"]): "sword" | "shield" | "bow" | "wand" | "cross" {
  switch (role) {
    case "Defender":
      return "shield";
    case "Ranger":
      return "bow";
    case "Mage":
      return "wand";
    case "Healer":
      return "cross";
    default:
      return "sword";
  }
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

function tileToWorld(q: number, r: number): { x: number; y: number } {
  return {
    x: q * HEX_WIDTH + (r % 2 === 0 ? 0 : HEX_HALF_WIDTH),
    y: HEX_SIZE * 1.5 * r
  };
}

export class WarProtocolScene extends Phaser.Scene {
  private readonly tiles = new Map<CoordKey, TileNode>();
  private readonly units = new Map<string, UnitSprite>();
  private readonly reserveUnits = new Map<string, UnitTemplate>();
  private readonly occupiedTiles = new Map<CoordKey, string>();

  private readonly pointCache = hexPoints(HEX_SIZE);

  private selectedReserveUnitId: string | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private boardOriginX = 0;
  private boardOriginY = 0;

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
    this.ensureTiles();
    this.layoutScene();
    this.statusText.setText("Select a unit, then place it into any empty hex.");
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
    this.statusText.setText(`Place ${unit.name} into any empty hex.`);
    this.emitRosterState();
    this.refreshHighlights();
  }

  public cancelReservePlacement(): void {
    if (this.units.size > 0) {
      for (const [, unit] of this.units) {
        unit.root.destroy(true);
      }

      this.units.clear();
      this.occupiedTiles.clear();
      this.selectedReserveUnitId = null;
      this.statusText.setText("Deployment reset.");
      this.emitRosterState();
      this.refreshHighlights();
      return;
    }

    if (!this.selectedReserveUnitId) {
      this.statusText.setText("No unit placement is currently active.");
      return;
    }

    this.selectedReserveUnitId = null;
    this.statusText.setText("Placement canceled.");
    this.emitRosterState();
    this.refreshHighlights();
  }

  public deployReserveUnitAtWorld(unitId: string, worldX: number, worldY: number): void {
    if (!this.reserveUnits.has(unitId) || this.units.has(unitId)) {
      return;
    }

    const tile = this.findTileAtPoint(worldX, worldY);
    if (!tile) {
      this.statusText.setText("Drop target is outside the grid.");
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

    const tiles = Array.from(this.tiles.values())
      .map((tile) => ({
        q: tile.q,
        r: tile.r,
        centerX: tile.centerX,
        centerY: tile.centerY,
        vertices: tile.vertices
      }))
      .sort((left, right) => left.r - right.r || left.q - right.q);

    return {
      board: {
        cols: GRID_COLS,
        rows: GRID_ROWS,
        hexSize: HEX_SIZE,
        originX: this.boardOriginX,
        originY: this.boardOriginY
      },
      statusText: this.statusText?.text ?? "",
      selectedReserveUnitId: this.selectedReserveUnitId,
      highlightedTiles: tiles
        .filter((tile) => this.selectedReserveUnitId && !this.occupiedTiles.has(this.tileKey(tile.q, tile.r)))
        .map((tile) => ({ q: tile.q, r: tile.r })),
      tiles,
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

  private ensureTiles(): void {
    for (const tileDef of TILE_LAYOUT) {
      const key = this.tileKey(tileDef.q, tileDef.r);
      if (this.tiles.has(key)) {
        continue;
      }

      const graphics = this.add.graphics();
      graphics.setDepth(1);
      const highlightGraphics = this.add.graphics();
      highlightGraphics.setDepth(2);

      this.tiles.set(key, {
        q: tileDef.q,
        r: tileDef.r,
        graphics,
        highlightGraphics,
        centerX: 0,
        centerY: 0,
        vertices: []
      });
    }
  }

  private layoutScene(): void {
    const viewportCenterX = Math.round(this.scale.width / 2);
    const viewportCenterY = Math.round(this.scale.height * 0.42);

    const relativeCenters = Array.from(this.tiles.values()).map((tile) => {
      const world = tileToWorld(tile.q, tile.r);
      return { x: world.x, y: world.y };
    });

    const minX = Math.min(...relativeCenters.map((tile) => tile.x - HEX_HALF_WIDTH));
    const maxX = Math.max(...relativeCenters.map((tile) => tile.x + HEX_HALF_WIDTH));
    const minY = Math.min(...relativeCenters.map((tile) => tile.y - HEX_SIZE));
    const maxY = Math.max(...relativeCenters.map((tile) => tile.y + HEX_SIZE));
    const boardCenterX = (minX + maxX) / 2;
    const boardCenterY = (minY + maxY) / 2;

    this.boardOriginX = Math.round(viewportCenterX - boardCenterX);
    this.boardOriginY = Math.round(viewportCenterY - boardCenterY);

    for (const [, tile] of this.tiles) {
      const world = tileToWorld(tile.q, tile.r);
      tile.centerX = Math.round(world.x + this.boardOriginX);
      tile.centerY = Math.round(world.y + this.boardOriginY);
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

  private createChipBackground(width: number, height: number): Phaser.GameObjects.Graphics {
    const background = this.add.graphics();
    background.setPosition(-width / 2, -height / 2);
    background.fillStyle(0x0f1823, 0.96);
    background.lineStyle(1.5, 0x45596d, 1);
    background.fillRoundedRect(0, 0, width, height, 6);
    background.strokeRoundedRect(0, 0, width, height, 6);
    return background;
  }

  private createRoleIcon(role: UnitTemplate["role"]): Phaser.GameObjects.Graphics {
    const icon = this.add.graphics();
    icon.lineStyle(2, 0xe7f0fb, 1);

    switch (roleIconType(role)) {
      case "shield":
        icon.beginPath();
        icon.moveTo(0, -7);
        icon.lineTo(6, -4);
        icon.lineTo(5, 3);
        icon.lineTo(0, 8);
        icon.lineTo(-5, 3);
        icon.lineTo(-6, -4);
        icon.closePath();
        icon.strokePath();
        break;
      case "bow":
        icon.beginPath();
        icon.arc(-1, 0, 7, Phaser.Math.DegToRad(260), Phaser.Math.DegToRad(100), true);
        icon.strokePath();
        icon.beginPath();
        icon.moveTo(4, -7);
        icon.lineTo(4, 7);
        icon.moveTo(1, -5);
        icon.lineTo(7, -9);
        icon.moveTo(1, 5);
        icon.lineTo(7, 9);
        icon.strokePath();
        break;
      case "wand":
        icon.beginPath();
        icon.moveTo(-5, 6);
        icon.lineTo(3, -2);
        icon.strokePath();
        icon.fillStyle(0xe7f0fb, 1);
        icon.fillCircle(5, -4, 2);
        icon.lineStyle(1.5, 0xe7f0fb, 1);
        icon.beginPath();
        icon.moveTo(5, -10);
        icon.lineTo(5, -6);
        icon.moveTo(1, -4);
        icon.lineTo(9, -4);
        icon.moveTo(2, -8);
        icon.lineTo(8, 0);
        icon.moveTo(2, 0);
        icon.lineTo(8, -8);
        icon.strokePath();
        break;
      case "cross":
        icon.beginPath();
        icon.moveTo(0, -7);
        icon.lineTo(0, 7);
        icon.moveTo(-7, 0);
        icon.lineTo(7, 0);
        icon.strokePath();
        break;
      case "sword":
      default:
        icon.beginPath();
        icon.moveTo(-2, 7);
        icon.lineTo(4, 1);
        icon.lineTo(7, -6);
        icon.moveTo(-4, 5);
        icon.lineTo(-1, 8);
        icon.moveTo(-1, 8);
        icon.lineTo(1, 10);
        icon.moveTo(-1, 5);
        icon.lineTo(2, 8);
        icon.strokePath();
        break;
    }

    return icon;
  }

  private createInfoChip(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string
  ): Phaser.GameObjects.Container {
    const background = this.createChipBackground(width, height);
    const label = this.add
      .text(0, 0, text, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#eef5ff"
      })
      .setOrigin(0.5);

    return this.add.container(x, y, [background, label]);
  }

  private createUnitSprite(state: UnitState): UnitSprite {
    const { x, y } = this.getTileCenter(state.q, state.r);

    const body = this.add.circle(0, 0, 24, state.color, 0.96);
    body.setStrokeStyle(3, 0xe6edf6, 0.95);

    const nameLabel = this.add
      .text(0, -10, compactUnitName(state.name), {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#f4f8ff"
      })
      .setOrigin(0.5);

    const centerLabel = this.add
      .text(0, 0, state.team[0], {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#091018"
      })
      .setOrigin(0.5);

    const moveLabel = this.add
      .text(0, 11, `MV ${state.move}`, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#e7f0fb"
      })
      .setOrigin(0.5);

    const roleChipBackground = this.createChipBackground(18, 18);
    const roleChipIcon = this.createRoleIcon(state.role);
    const roleChip = this.add.container(-35, -10, [roleChipBackground, roleChipIcon]);
    const attackChip = this.createInfoChip(-23, 15, 34, 16, `AT ${state.attack}`);
    const healthChip = this.createInfoChip(23, 15, 34, 16, `HP ${state.hp}`);

    const root = this.add.container(x, y, [
      body,
      nameLabel,
      centerLabel,
      moveLabel,
      roleChip,
      attackChip,
      healthChip
    ]);
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

    this.statusText.setText(`${state.name} deployed to hex (${q}, ${r}).`);
    this.emitRosterState();
    this.refreshHighlights();
  }

  private refreshHighlights(): void {
    for (const [, tile] of this.tiles) {
      const key = this.tileKey(tile.q, tile.r);
      const isAvailable = Boolean(this.selectedReserveUnitId) && !this.occupiedTiles.has(key);
      this.redrawTile(tile, isAvailable);
    }

    for (const [, unit] of this.units) {
      unit.body.setStrokeStyle(3, 0xe6edf6, 0.95);
      unit.root.setAlpha(1);
    }
  }

  private redrawTile(tile: TileNode, isHighlighted: boolean): void {
    tile.graphics.clear();
    tile.graphics.fillStyle(TILE_FILL, 0.9);
    tile.graphics.lineStyle(3, TILE_STROKE, 0.95);
    tile.graphics.beginPath();
    tile.graphics.moveTo(tile.vertices[0].x, tile.vertices[0].y);
    for (let index = 1; index < tile.vertices.length; index += 1) {
      tile.graphics.lineTo(tile.vertices[index].x, tile.vertices[index].y);
    }
    tile.graphics.closePath();
    tile.graphics.fillPath();
    tile.graphics.strokePath();

    tile.highlightGraphics.clear();
    if (!isHighlighted) {
      return;
    }

    tile.highlightGraphics.lineStyle(4, HIGHLIGHT_STROKE, 1);
    tile.highlightGraphics.beginPath();
    tile.highlightGraphics.moveTo(tile.vertices[0].x, tile.vertices[0].y);
    for (let index = 1; index < tile.vertices.length; index += 1) {
      tile.highlightGraphics.lineTo(tile.vertices[index].x, tile.vertices[index].y);
    }
    tile.highlightGraphics.closePath();
    tile.highlightGraphics.strokePath();
  }

  private emitRosterState(): void {
    this.events.emit("rosterStateChanged", {
      deployedUnitIds: Array.from(this.units.keys()),
      selectedReserveUnitId: this.selectedReserveUnitId
    });
  }

  private findTileAtPoint(worldX: number, worldY: number): { q: number; r: number } | null {
    for (const [, tile] of this.tiles) {
      if (this.isPointInsidePolygon(worldX, worldY, tile.vertices)) {
        return { q: tile.q, r: tile.r };
      }
    }

    return null;
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

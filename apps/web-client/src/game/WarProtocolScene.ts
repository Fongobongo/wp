import Phaser from "phaser";
import { DEMO_UNITS } from "./demoData.js";

const HEX_SIZE = 34;
const COLS = 8;
const ROWS = 7;
const ORIGIN_X = 150;
const ORIGIN_Y = 110;

type TileType = "plain" | "cover" | "elevation" | "energy" | "trap";

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
    const angle = Phaser.Math.DegToRad(60 * i - 30);
    points.push({
      x: size * Math.cos(angle),
      y: size * Math.sin(angle)
    });
  }
  return points;
}

function axialToWorld(q: number, r: number): { x: number; y: number } {
  const x = ORIGIN_X + HEX_SIZE * Math.sqrt(3) * (q + r / 2);
  const y = ORIGIN_Y + HEX_SIZE * 1.5 * r;
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
  constructor() {
    super("war-protocol-scene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0d1219");
    this.drawHexBoard();
    this.drawUnits();
    this.drawLegend();
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

  private drawUnits(): void {
    for (const unit of DEMO_UNITS) {
      const { x, y } = axialToWorld(unit.q, unit.r);

      const body = this.add.circle(x, y, 15, unit.color, 0.96);
      body.setStrokeStyle(2, 0xe6edf6, 0.9);

      this.add
        .text(x, y - 23, unit.name, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#f4f8ff"
        })
        .setOrigin(0.5);

      this.add
        .text(x, y + 1, unit.role[0], {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#091018"
        })
        .setOrigin(0.5);

      this.add
        .text(x, y + 22, `HP ${unit.hp}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#c8d7e8"
        })
        .setOrigin(0.5);
    }
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
}

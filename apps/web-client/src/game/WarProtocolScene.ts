import Phaser from "phaser";
import type { BattleEvent, BattleSnapshot, BattleUnitSnapshot } from "@warprotocol/shared-types";

type UnitSprite = {
  body: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
};

const CELL = 56;

export class WarProtocolScene extends Phaser.Scene {
  private units = new Map<string, UnitSprite>();

  constructor() {
    super("war-protocol-scene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0f1318");
    this.drawGrid(8, 8);
  }

  private drawGrid(width: number, height: number): void {
    const line = this.add.graphics();
    line.lineStyle(1, 0x32404f, 0.9);
    for (let x = 0; x <= width; x += 1) {
      line.moveTo(x * CELL, 0);
      line.lineTo(x * CELL, height * CELL);
    }
    for (let y = 0; y <= height; y += 1) {
      line.moveTo(0, y * CELL);
      line.lineTo(width * CELL, y * CELL);
    }
    line.strokePath();
  }

  setInitialSnapshot(snapshot: BattleSnapshot): void {
    this.clearUnits();
    for (const unit of snapshot.units) {
      this.createOrUpdateUnit(unit);
    }
  }

  applyEvent(event: BattleEvent): void {
    if (event.type === "move") {
      const actorId = String(event.payload.actorId ?? "");
      const sprite = this.units.get(actorId);
      if (!sprite) {
        return;
      }
      const x = Number(event.payload.x ?? 0);
      const y = Number(event.payload.y ?? 0);
      sprite.hpText.setPosition(this.worldX(x), this.worldY(y) - 10);
      sprite.nameText.setPosition(this.worldX(x), this.worldY(y) + 10);
      this.tweens.add({
        targets: sprite.body,
        x: this.worldX(x),
        y: this.worldY(y),
        duration: 120,
        ease: "Sine.Out"
      });
      return;
    }

    if (event.type === "attack") {
      const targetId = String(event.payload.targetUnitId ?? "");
      const hpLeft = Number(event.payload.hpLeft ?? 0);
      const sprite = this.units.get(targetId);
      if (!sprite) {
        return;
      }
      sprite.hpText.setText(String(Math.max(0, Math.round(hpLeft))));
      this.tweens.add({
        targets: sprite.body,
        alpha: 0.3,
        yoyo: true,
        duration: 90,
        repeat: 1
      });
      return;
    }

    if (event.type === "death") {
      const unitId = String(event.payload.unitId ?? "");
      const sprite = this.units.get(unitId);
      if (!sprite) {
        return;
      }
      this.tweens.add({
        targets: [sprite.body, sprite.hpText, sprite.nameText],
        alpha: 0,
        duration: 220,
        onComplete: () => {
          sprite.body.destroy();
          sprite.hpText.destroy();
          sprite.nameText.destroy();
          this.units.delete(unitId);
        }
      });
    }
  }

  private createOrUpdateUnit(unit: BattleUnitSnapshot): void {
    const color = unit.playerId.endsWith("1") || unit.playerId.startsWith("p1") ? 0xff6b35 : 0x2a9d8f;
    const existing = this.units.get(unit.id);
    if (existing) {
      existing.body.setPosition(this.worldX(unit.x), this.worldY(unit.y));
      existing.hpText.setPosition(this.worldX(unit.x), this.worldY(unit.y) - 10);
      existing.hpText.setText(String(unit.hp));
      existing.nameText.setPosition(this.worldX(unit.x), this.worldY(unit.y) + 10);
      return;
    }

    const body = this.add.rectangle(this.worldX(unit.x), this.worldY(unit.y), 38, 38, color, 0.95);
    body.setStrokeStyle(2, 0xe5f3ff, 0.85);

    const hpText = this.add.text(this.worldX(unit.x), this.worldY(unit.y) - 10, String(unit.hp), {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#f4f8ff"
    });
    hpText.setOrigin(0.5);

    const nameText = this.add.text(this.worldX(unit.x), this.worldY(unit.y) + 10, unit.unitId.split(":").at(-1) ?? "u", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#b8c4d1"
    });
    nameText.setOrigin(0.5);

    this.units.set(unit.id, { body, hpText, nameText });
  }

  private clearUnits(): void {
    for (const sprite of this.units.values()) {
      sprite.body.destroy();
      sprite.hpText.destroy();
      sprite.nameText.destroy();
    }
    this.units.clear();
  }

  private worldX(gridX: number): number {
    return gridX * CELL + CELL / 2;
  }

  private worldY(gridY: number): number {
    return gridY * CELL + CELL / 2;
  }
}

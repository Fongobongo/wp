import Phaser from "phaser";
import type { BattleEvent, BattleSnapshot } from "@warprotocol/shared-types";
import { WarProtocolScene } from "./WarProtocolScene.js";

let game: Phaser.Game | null = null;
let scene: WarProtocolScene | null = null;

export function mountBattleGame(container: HTMLDivElement): void {
  if (game) {
    return;
  }

  scene = new WarProtocolScene();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 8 * 56,
    height: 8 * 56,
    parent: container,
    backgroundColor: "#0f1318",
    scene: [scene],
    physics: {
      default: "arcade"
    }
  });
}

export function unmountBattleGame(): void {
  if (!game) {
    return;
  }
  game.destroy(true);
  game = null;
  scene = null;
}

export function updateInitialSnapshot(snapshot: BattleSnapshot): void {
  scene?.setInitialSnapshot(snapshot);
}

export function applyBattleEvent(event: BattleEvent): void {
  scene?.applyEvent(event);
}

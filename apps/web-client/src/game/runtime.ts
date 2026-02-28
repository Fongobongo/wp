import Phaser from "phaser";
import { WarProtocolScene } from "./WarProtocolScene.js";

let game: Phaser.Game | null = null;

export function mountBattleGame(container: HTMLDivElement): void {
  if (game) {
    return;
  }

  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 920,
    height: 620,
    parent: container,
    backgroundColor: "#0d1219",
    scene: [new WarProtocolScene()],
    physics: {
      default: "arcade"
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  });
}

export function unmountBattleGame(): void {
  if (!game) {
    return;
  }

  game.destroy(true);
  game = null;
}

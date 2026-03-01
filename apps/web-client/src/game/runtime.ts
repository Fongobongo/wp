import Phaser from "phaser";
import { WarProtocolScene } from "./WarProtocolScene.js";

let game: Phaser.Game | null = null;
let resizeObserver: ResizeObserver | null = null;

const BASE_HEIGHT = 620;

function resizeGameToContainer(container: HTMLDivElement): void {
  if (!game) {
    return;
  }

  const width = Math.max(320, Math.floor(container.clientWidth));
  game.scale.resize(width, BASE_HEIGHT);
}

export function mountBattleGame(container: HTMLDivElement): void {
  if (game) {
    return;
  }

  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: Math.max(320, Math.floor(container.clientWidth)),
    height: BASE_HEIGHT,
    parent: container,
    backgroundColor: "#0d1219",
    scene: [new WarProtocolScene()],
    physics: {
      default: "arcade"
    },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER
    }
  });

  resizeObserver = new ResizeObserver(() => {
    resizeGameToContainer(container);
  });
  resizeObserver.observe(container);
}

export function unmountBattleGame(): void {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  if (!game) {
    return;
  }

  game.destroy(true);
  game = null;
}

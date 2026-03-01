import Phaser from "phaser";
import { WarProtocolScene } from "./WarProtocolScene.js";

let game: Phaser.Game | null = null;
let resizeObserver: ResizeObserver | null = null;
let sceneRef: WarProtocolScene | null = null;

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

  sceneRef = new WarProtocolScene();

  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: Math.max(320, Math.floor(container.clientWidth)),
    height: BASE_HEIGHT,
    parent: container,
    backgroundColor: "#0d1219",
    scene: [sceneRef],
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
  sceneRef = null;
}

export function endCurrentTurn(): void {
  sceneRef?.endTurn();
}

export function onTurnStateChange(
  listener: (state: {
    currentTeam: "Blue" | "Red";
    turnNumber: number;
    remainingActions: number;
  }) => void
): () => void {
  if (!sceneRef) {
    return () => undefined;
  }

  const handler = (payload: {
    currentTeam: "Blue" | "Red";
    turnNumber: number;
    remainingActions: number;
  }) => listener(payload);

  sceneRef.events.on("turnStateChanged", handler);
  return () => {
    sceneRef?.events.off("turnStateChanged", handler);
  };
}

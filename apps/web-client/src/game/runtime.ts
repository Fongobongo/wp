import Phaser from "phaser";
import { WarProtocolScene } from "./WarProtocolScene.js";

let game: Phaser.Game | null = null;
let resizeObserver: ResizeObserver | null = null;
let sceneRef: WarProtocolScene | null = null;

const BASE_HEIGHT = 620;

type TurnState = {
  currentTeam: "Blue" | "Red";
  turnNumber: number;
  remainingActions: number;
};

type RosterState = {
  deployedUnitIds: string[];
  selectedReserveUnitId: string | null;
};

function resizeGameToContainer(container: HTMLDivElement): void {
  if (!game) {
    return;
  }

  const width = Math.max(320, Math.floor(container.clientWidth));
  game.scale.resize(width, BASE_HEIGHT);
}

function subscribeToSceneEvent<TPayload>(
  eventName: string,
  listener: (payload: TPayload) => void
): () => void {
  let attachedEmitter: Phaser.Events.EventEmitter | null = null;
  let handler: ((payload: TPayload) => void) | null = null;
  let disposed = false;

  const tryAttach = (): void => {
    if (disposed || !sceneRef?.events || attachedEmitter) {
      return;
    }

    handler = (payload) => listener(payload);
    sceneRef.events.on(eventName, handler);
    attachedEmitter = sceneRef.events;
  };

  tryAttach();
  const attachPoll = attachedEmitter ? null : window.setInterval(tryAttach, 50);

  return () => {
    disposed = true;
    if (attachPoll !== null) {
      window.clearInterval(attachPoll);
    }
    if (attachedEmitter && handler) {
      attachedEmitter.off(eventName, handler);
    }
  };
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
    autoRound: true,
    parent: container,
    backgroundColor: "#0d1219",
    scene: [sceneRef],
    render: {
      pixelArt: false,
      antialias: true,
      roundPixels: true
    },
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

export function selectUnitForPlacement(unitId: string): void {
  sceneRef?.selectReserveUnit(unitId);
}

export function deployUnitByClientPosition(
  unitId: string,
  clientX: number,
  clientY: number
): void {
  if (!game || !sceneRef) {
    return;
  }

  const canvasRect = game.canvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return;
  }

  // Keep reserve selection aligned with drag source.
  sceneRef.selectReserveUnit(unitId);

  const normalizedX = Phaser.Math.Clamp((clientX - canvasRect.left) / canvasRect.width, 0, 1);
  const normalizedY = Phaser.Math.Clamp((clientY - canvasRect.top) / canvasRect.height, 0, 1);
  const worldX = normalizedX * game.scale.width;
  const worldY = normalizedY * game.scale.height;
  sceneRef.deployReserveUnitAtWorld(unitId, worldX, worldY);
}

export function onTurnStateChange(listener: (state: TurnState) => void): () => void {
  return subscribeToSceneEvent<TurnState>("turnStateChanged", listener);
}

export function onRosterStateChange(listener: (state: RosterState) => void): () => void {
  return subscribeToSceneEvent<RosterState>("rosterStateChanged", listener);
}

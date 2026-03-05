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

export function deployUnitByClientPoint(
  unitId: string,
  clientX: number,
  clientY: number
): void {
  if (!game || !sceneRef) {
    return;
  }

  const canvas = game.canvas;
  if (!canvas) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const scaleManager = game.scale as unknown as {
    transformX?: (pageX: number) => number;
    transformY?: (pageY: number) => number;
  };

  const worldX = scaleManager.transformX
    ? scaleManager.transformX(clientX)
    : ((clientX - rect.left) / rect.width) * game.scale.width;
  const worldY = scaleManager.transformY
    ? scaleManager.transformY(clientY)
    : ((clientY - rect.top) / rect.height) * game.scale.height;

  sceneRef.deployReserveUnitAtWorld(unitId, worldX, worldY);
}

export function onTurnStateChange(listener: (state: TurnState) => void): () => void {
  return subscribeToSceneEvent<TurnState>("turnStateChanged", listener);
}

export function onRosterStateChange(listener: (state: RosterState) => void): () => void {
  return subscribeToSceneEvent<RosterState>("rosterStateChanged", listener);
}

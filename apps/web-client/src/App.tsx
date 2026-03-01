import { useEffect, useRef, useState } from "react";
import { DEMO_UNITS } from "./game/demoData.js";
import {
  deployUnitByClientPoint,
  endCurrentTurn,
  mountBattleGame,
  onRosterStateChange,
  onTurnStateChange,
  selectUnitForPlacement,
  unmountBattleGame
} from "./game/runtime.js";

function colorToCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function createDragPreview(color: number): HTMLDivElement {
  const node = document.createElement("div");
  node.style.width = "20px";
  node.style.height = "20px";
  node.style.borderRadius = "50%";
  node.style.border = "2px solid #e6edf6";
  node.style.background = colorToCssHex(color);
  node.style.boxShadow = "0 0 0 1px rgba(0, 0, 0, 0.35)";
  node.style.position = "fixed";
  node.style.left = "-9999px";
  node.style.top = "-9999px";
  node.style.pointerEvents = "none";
  document.body.appendChild(node);
  return node;
}

export default function App() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [isDragOverBoard, setIsDragOverBoard] = useState(false);
  const [turnState, setTurnState] = useState({
    currentTeam: "Blue" as "Blue" | "Red",
    turnNumber: 1,
    remainingActions: 0
  });
  const [rosterState, setRosterState] = useState({
    deployedUnitIds: [] as string[],
    selectedReserveUnitId: null as string | null
  });

  useEffect(() => {
    if (!boardRef.current) {
      return;
    }

    mountBattleGame(boardRef.current);
    const unsubscribeTurnState = onTurnStateChange((state) => {
      setTurnState(state);
    });
    const unsubscribeRosterState = onRosterStateChange((state) => {
      setRosterState(state);
    });

    return () => {
      unsubscribeTurnState();
      unsubscribeRosterState();
      unmountBattleGame();
    };
  }, []);

  return (
    <div className="page">
      <header className="hero">
        <h1>WAR PROTOCOL</h1>
        <p>Empty hex battlefield: deploy units from roster, then play turn-based movement.</p>
      </header>

      <section className="panel board-panel">
        <div className="board-header">
          <h2>Battlefield</h2>
          <div className="turn-controls">
            <span className="turn-state">
              Turn {turnState.turnNumber}: {turnState.currentTeam} team ({turnState.remainingActions} actions left)
            </span>
            <button
              type="button"
              className="end-turn-button"
              onClick={() => endCurrentTurn()}
            >
              End Turn
            </button>
          </div>
        </div>
        <div
          className={`battle-canvas${isDragOverBoard ? " is-drag-over" : ""}`}
          ref={boardRef}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOverBoard(true);
          }}
          onDragLeave={() => {
            setIsDragOverBoard(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOverBoard(false);
            const unitId = event.dataTransfer.getData("text/unit-id");
            if (!unitId) {
              return;
            }
            deployUnitByClientPoint(unitId, event.clientX, event.clientY);
          }}
        />
      </section>

      <section className="panel roster-panel">
        <h2>Starter Units (Deploy to Field)</h2>
        <div className="roster-grid">
          {DEMO_UNITS.map((unit) => {
            const deployed = rosterState.deployedUnitIds.includes(unit.id);
            const selectedForDeploy = rosterState.selectedReserveUnitId === unit.id;

            return (
              <article
                className={`unit-card${selectedForDeploy ? " is-selected" : ""}${deployed ? " is-deployed" : ""}`}
                key={unit.id}
                draggable={!deployed}
                onDragStart={(event) => {
                  if (deployed) {
                    return;
                  }
                  event.dataTransfer.setData("text/unit-id", unit.id);
                  event.dataTransfer.effectAllowed = "move";
                  const preview = createDragPreview(unit.color);
                  event.dataTransfer.setDragImage(preview, 10, 10);
                  window.setTimeout(() => {
                    preview.remove();
                  }, 0);
                  selectUnitForPlacement(unit.id);
                }}
                onDragEnd={() => {
                  setIsDragOverBoard(false);
                }}
              >
                <div className="unit-name">{unit.name}</div>
                <div className="unit-stats">Team {unit.team}</div>
                <div className="unit-role">{unit.role}</div>
                <div className="unit-stats">HP {unit.hp}</div>
                <div className="unit-stats">ATK {unit.attack}</div>
                <div className="unit-stats">Move {unit.move}</div>
                <button
                  type="button"
                  className="deploy-button"
                  disabled={deployed}
                  onClick={() => selectUnitForPlacement(unit.id)}
                >
                  {deployed ? "Deployed" : selectedForDeploy ? "Deploying..." : "Deploy to Field"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

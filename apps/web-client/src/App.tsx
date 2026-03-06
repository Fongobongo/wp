import { useEffect, useRef, useState } from "react";
import { DEMO_UNITS } from "./game/demoData.js";
import {
  deployUnitByClientPosition,
  mountBattleGame,
  onRosterStateChange,
  selectUnitForPlacement,
  unmountBattleGame
} from "./game/runtime.js";

function colorToCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function createDragPreview(color: number): HTMLDivElement {
  const node = document.createElement("div");
  node.style.width = "24px";
  node.style.height = "24px";
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
  const [rosterState, setRosterState] = useState({
    deployedUnitIds: [] as string[],
    selectedReserveUnitId: null as string | null
  });

  useEffect(() => {
    if (!boardRef.current) {
      return;
    }

    mountBattleGame(boardRef.current);
    const unsubscribeRosterState = onRosterStateChange((state) => {
      setRosterState(state);
    });

    return () => {
      unsubscribeRosterState();
      unmountBattleGame();
    };
  }, []);

  const unit = DEMO_UNITS[0];
  const deployed = rosterState.deployedUnitIds.includes(unit.id);
  const selectedForDeploy = rosterState.selectedReserveUnitId === unit.id;

  return (
    <div className="page">
      <header className="hero">
        <h1>WAR PROTOCOL</h1>
        <p>Four-hex deployment sandbox. Drag the only unit into any empty hex.</p>
      </header>

      <section className="panel board-panel">
        <div className="board-header">
          <h2>Battlefield</h2>
          <span className="board-note">Four hexes. One unit. Drop into any empty hex.</span>
        </div>
        <div
          className={`battle-canvas${isDragOverBoard ? " is-drag-over" : ""}`}
          data-testid="battle-board"
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
            deployUnitByClientPosition(unitId, event.clientX, event.clientY);
          }}
        />
      </section>

      <section className="panel roster-panel">
        <h2>Reserve Unit</h2>
        <div className="roster-grid">
          <article
            className={`unit-card${selectedForDeploy ? " is-selected" : ""}${deployed ? " is-deployed" : ""}`}
            data-testid={`unit-card-${unit.id}`}
            draggable={!deployed}
            onClick={() => {
              if (!deployed) {
                selectUnitForPlacement(unit.id);
              }
            }}
            onDragStart={(event) => {
              if (deployed) {
                return;
              }
              event.dataTransfer.setData("text/unit-id", unit.id);
              event.dataTransfer.effectAllowed = "move";
              const preview = createDragPreview(unit.color);
              event.dataTransfer.setDragImage(preview, 12, 12);
              window.setTimeout(() => {
                preview.remove();
              }, 0);
              selectUnitForPlacement(unit.id);
            }}
            onDragEnd={() => {
              setIsDragOverBoard(false);
            }}
          >
            <div className="unit-chip-row">
              <span
                className="unit-chip"
                aria-hidden="true"
                style={{ backgroundColor: colorToCssHex(unit.color) }}
              />
              <div className="unit-name">{unit.name}</div>
            </div>
            <div className="unit-role">{unit.role}</div>
            <div className="unit-stats">Team {unit.team}</div>
            <div className="unit-stats">HP {unit.hp}</div>
            <div className="unit-stats">ATK {unit.attack}</div>
            <div className="unit-stats">Move {unit.move}</div>
            <div className="unit-hint">
              {deployed ? "Already deployed." : selectedForDeploy ? "Drop into any hex." : "Drag into any hex."}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

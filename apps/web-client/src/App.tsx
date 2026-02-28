import { useEffect, useRef } from "react";
import { DEMO_UNITS } from "./game/demoData.js";
import { mountBattleGame, unmountBattleGame } from "./game/runtime.js";

export default function App() {
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boardRef.current) {
      return;
    }

    mountBattleGame(boardRef.current);
    return () => {
      unmountBattleGame();
    };
  }, []);

  return (
    <div className="page">
      <header className="hero">
        <h1>WAR PROTOCOL</h1>
        <p>Browser MVP: hex battlefield with a starter roster of five units.</p>
      </header>

      <section className="panel board-panel">
        <h2>Battlefield</h2>
        <div className="battle-canvas" ref={boardRef} />
      </section>

      <section className="panel roster-panel">
        <h2>Starter Units (5)</h2>
        <div className="roster-grid">
          {DEMO_UNITS.map((unit) => (
            <article className="unit-card" key={unit.id}>
              <div className="unit-name">{unit.name}</div>
              <div className="unit-role">{unit.role}</div>
              <div className="unit-stats">HP {unit.hp}</div>
              <div className="unit-stats">ATK {unit.attack}</div>
              <div className="unit-stats">Move {unit.move}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

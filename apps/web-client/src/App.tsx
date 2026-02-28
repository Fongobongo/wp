import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BattleEvent,
  GameDataResponse,
  Loadout,
  MatchResult,
  UnitDefinition
} from "@warprotocol/shared-types";
import {
  ackMatchResult,
  buildMatchWebSocketUrl,
  getBattlePass,
  getGameData,
  loginGuest,
  loginWithName,
  queueJoin,
  queueLeave,
  queueStatus,
  validateLoadout,
  type LoginResponse,
  type WsMessage
} from "./api/client.js";
import {
  applyBattleEvent,
  mountBattleGame,
  unmountBattleGame,
  updateInitialSnapshot
} from "./game/runtime.js";

type QueueState = "idle" | "queued" | "matched";

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function App() {
  const [login, setLogin] = useState<LoginResponse | null>(null);
  const [displayName, setDisplayName] = useState("Commander");
  const [gameData, setGameData] = useState<GameDataResponse | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<string>("kingdom-of-light");
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [loadoutValidation, setLoadoutValidation] = useState<string>("not validated");
  const [queueState, setQueueState] = useState<QueueState>("idle");
  const [queueMessage, setQueueMessage] = useState("not in queue");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [battlePassLevel, setBattlePassLevel] = useState<number | null>(null);
  const [socketState, setSocketState] = useState("disconnected");

  const wsRef = useRef<WebSocket | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const factionUnits = useMemo(() => {
    if (!gameData) {
      return [];
    }
    return gameData.units.filter((unit) => unit.factionId === selectedFaction);
  }, [gameData, selectedFaction]);

  useEffect(() => {
    if (!boardRef.current) {
      return;
    }
    mountBattleGame(boardRef.current);
    return () => {
      unmountBattleGame();
    };
  }, []);

  useEffect(() => {
    if (!login) {
      return;
    }

    const timer = setInterval(async () => {
      if (queueState !== "queued") {
        return;
      }

      try {
        const status = await queueStatus(login.playerId);
        if (status.status === "matched" && status.matchId && status.websocketUrl) {
          setQueueState("matched");
          setQueueMessage(`Matched vs ${status.opponentPlayerId}`);
          connectToMatch(status.matchId, status.websocketUrl);
        }
      } catch (error) {
        setQueueMessage(`Queue status error: ${String(error)}`);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [login, queueState]);

  async function ensureGameData(): Promise<void> {
    if (!gameData) {
      const loaded = await getGameData();
      setGameData(loaded);
    }
  }

  async function handleGuestLogin(): Promise<void> {
    const session = await loginGuest();
    setLogin(session);
    await ensureGameData();
    const battlePass = await getBattlePass(session.playerId);
    setBattlePassLevel(battlePass.state.level);
  }

  async function handleNamedLogin(): Promise<void> {
    const session = await loginWithName(displayName);
    setLogin(session);
    await ensureGameData();
    const battlePass = await getBattlePass(session.playerId);
    setBattlePassLevel(battlePass.state.level);
  }

  function toggleUnit(unitId: string): void {
    setSelectedUnitIds((current) => {
      if (current.includes(unitId)) {
        return current.filter((id) => id !== unitId);
      }
      if (current.length >= 8) {
        return current;
      }
      return [...current, unitId];
    });
  }

  function makeLoadout(playerId: string): Loadout {
    return {
      playerId,
      unitIds: selectedUnitIds,
      energyCap: 1000
    };
  }

  async function handleValidateLoadout(): Promise<void> {
    if (!login) {
      return;
    }
    const response = await validateLoadout(makeLoadout(login.playerId));
    setLoadoutValidation(response.ok ? "valid" : `invalid: ${response.errors.join(",")}`);
  }

  async function handleJoinQueue(): Promise<void> {
    if (!login) {
      return;
    }

    const payload = {
      playerId: login.playerId,
      mmr: login.profile.rating,
      loadout: makeLoadout(login.playerId)
    };

    const response = await queueJoin(payload);
    if (response.status === "matched" && response.matchId && response.websocketUrl) {
      setQueueState("matched");
      setQueueMessage(`Matched vs ${response.opponentPlayerId}`);
      connectToMatch(response.matchId, response.websocketUrl);
      return;
    }

    setQueueState("queued");
    setQueueMessage(`Queued ticket: ${response.queueTicket ?? "none"}`);
  }

  async function handleLeaveQueue(): Promise<void> {
    if (!login) {
      return;
    }

    await queueLeave(login.playerId);
    setQueueState("idle");
    setQueueMessage("not in queue");
  }

  function connectToMatch(id: string, wsUrlRaw: string): void {
    setMatchId(id);
    setEvents([]);
    setResult(null);

    const wsUrl = buildMatchWebSocketUrl(wsUrlRaw);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setSocketState("connected");
    };

    ws.onclose = () => {
      setSocketState("disconnected");
    };

    ws.onerror = () => {
      setSocketState("error");
    };

    ws.onmessage = (message) => {
      const payload = JSON.parse(String(message.data)) as WsMessage;
      if (payload.type === "live_start" && payload.initialSnapshot) {
        updateInitialSnapshot(payload.initialSnapshot);
        return;
      }

      if (payload.type === "live" && payload.event) {
        setEvents((prev) => [...prev, payload.event as BattleEvent]);
        applyBattleEvent(payload.event as BattleEvent);
        return;
      }

      if (payload.type === "result" && payload.result && login) {
        const matchResult = payload.result as MatchResult;
        setResult(matchResult);
        const maxSeq = matchResult.events.reduce((max, event) => Math.max(max, event.seq), 0);
        ackMatchResult(matchResult.matchId, login.playerId, maxSeq).catch(() => undefined);
      }
    };
  }

  function handleLockIn(): void {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !login) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "lock_in",
        loadout: makeLoadout(login.playerId)
      })
    );
  }

  const roleBuckets = useMemo(() => {
    const grouped: Record<string, UnitDefinition[]> = {};
    for (const unit of factionUnits) {
      grouped[unit.role] = grouped[unit.role] ?? [];
      grouped[unit.role].push(unit);
    }
    return grouped;
  }, [factionUnits]);

  return (
    <div className="page">
      <header className="hero">
        <h1>WAR PROTOCOL</h1>
        <p>Web-first live PvP tactics with authoritative battle simulation.</p>
      </header>

      <section className="panel auth">
        <h2>1) Auth</h2>
        <div className="auth-row">
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name"
          />
          <button onClick={() => void handleNamedLogin()}>Login</button>
          <button onClick={() => void handleGuestLogin()}>Guest</button>
        </div>
        <div className="meta">
          Player: <strong>{login?.playerId ?? "-"}</strong>
          <span>Rating: {login?.profile.rating ?? "-"}</span>
          <span>Battle Pass Lv: {battlePassLevel ?? "-"}</span>
        </div>
      </section>

      <section className="panel setup">
        <h2>2) Draft & Loadout</h2>
        <div className="setup-row">
          <label>
            Faction
            <select
              value={selectedFaction}
              onChange={(event) => {
                setSelectedFaction(event.target.value);
                setSelectedUnitIds([]);
              }}
            >
              {gameData?.factions.map((faction) => (
                <option key={faction.id} value={faction.id}>
                  {faction.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!login} onClick={() => void handleValidateLoadout()}>
            Validate Loadout
          </button>
          <span className="status">{loadoutValidation}</span>
        </div>

        <div className="unit-grid">
          {Object.entries(roleBuckets).map(([role, units]) => (
            <div className="role-column" key={role}>
              <h3>{formatRole(role)}</h3>
              {units.map((unit) => {
                const active = selectedUnitIds.includes(unit.id);
                return (
                  <button
                    className={active ? "unit selected" : "unit"}
                    key={unit.id}
                    onClick={() => toggleUnit(unit.id)}
                  >
                    <span>{unit.name}</span>
                    <small>ATK {unit.stats.attack} | SPD {unit.stats.speed}</small>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="meta">Selected: {selectedUnitIds.length}/8</div>
      </section>

      <section className="panel match">
        <h2>3) Queue & Match</h2>
        <div className="controls">
          <button disabled={!login || selectedUnitIds.length === 0} onClick={() => void handleJoinQueue()}>
            Join Queue
          </button>
          <button disabled={!login || queueState !== "queued"} onClick={() => void handleLeaveQueue()}>
            Leave Queue
          </button>
          <button disabled={!matchId || socketState !== "connected"} onClick={handleLockIn}>
            Lock In
          </button>
        </div>
        <div className="meta">
          Queue: {queueState} | {queueMessage}
        </div>
        <div className="meta">
          Match: {matchId ?? "-"} | Socket: {socketState}
        </div>

        <div className="battle-layout">
          <div className="battle-canvas" ref={boardRef} />
          <aside className="event-log">
            <h3>Event Log</h3>
            <div className="events">
              {events.slice(-50).map((event) => (
                <div key={event.id} className="event">
                  <strong>{event.seq}</strong> {event.type}
                </div>
              ))}
            </div>
            <div className="result">
              Winner: <strong>{result?.winnerPlayerId ?? "-"}</strong>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

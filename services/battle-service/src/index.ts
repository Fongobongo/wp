import websocket from "@fastify/websocket";
import {
  simulateBattle,
  type BattleSimulationInput
} from "@warprotocol/battle-engine";
import { buildUnitCatalog, validateLoadout } from "@warprotocol/game-data";
import {
  createServiceRuntime,
  parsePort,
  safeJson,
  sendApiError,
  startRuntime
} from "@warprotocol/service-runtime";
import type {
  BattleSnapshot,
  Loadout,
  MatchResult,
  UnitDefinition
} from "@warprotocol/shared-types";
import type { RawData, WebSocket } from "ws";
import { z } from "zod";

const prepSeconds = Number(process.env.BATTLE_PREP_SECONDS ?? 20);
const gridWidth = Number(process.env.BATTLE_GRID_WIDTH ?? 8);
const gridHeight = Number(process.env.BATTLE_GRID_HEIGHT ?? 8);
const fixedTickMs = Number(process.env.BATTLE_FIXED_TICK_MS ?? 250);

const unitCatalog = buildUnitCatalog();
const unitById = new Map(unitCatalog.map((unit) => [unit.id, unit]));

const createMatchSchema = z.object({
  matchId: z.string().min(1),
  players: z.tuple([
    z.object({
      playerId: z.string(),
      loadout: z.object({
        playerId: z.string(),
        unitIds: z.array(z.string()),
        energyCap: z.number().positive()
      })
    }),
    z.object({
      playerId: z.string(),
      loadout: z.object({
        playerId: z.string(),
        unitIds: z.array(z.string()),
        energyCap: z.number().positive()
      })
    })
  ])
});

const ackSchema = z.object({
  matchId: z.string(),
  playerId: z.string(),
  eventSeq: z.number().int().nonnegative()
});

interface MatchPlayerState {
  playerId: string;
  loadout: Loadout;
  locked: boolean;
}

interface MatchState {
  matchId: string;
  players: [MatchPlayerState, MatchPlayerState];
  createdAt: number;
  prepDeadlineAt: number;
  result: MatchResult | null;
  initialSnapshot: BattleSnapshot | null;
  streamed: boolean;
  connections: Map<string, Set<WebSocket>>;
  resultAcks: Map<string, number>;
}

interface ClientMessage {
  type: "lock_in" | "ping";
  loadout?: Loadout;
}

const matches = new Map<string, MatchState>();

function createEmptyConnections(players: [MatchPlayerState, MatchPlayerState]): Map<string, Set<WebSocket>> {
  return new Map(players.map((player) => [player.playerId, new Set<WebSocket>()]));
}

function getUnitsFromLoadout(loadout: Loadout): UnitDefinition[] {
  return loadout.unitIds
    .map((unitId) => unitById.get(unitId))
    .filter((unit): unit is UnitDefinition => unit !== undefined)
    .slice(0, 8);
}

function serialize(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

function broadcast(match: MatchState, payload: Record<string, unknown>): void {
  const raw = serialize(payload);
  for (const sockets of match.connections.values()) {
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) {
        socket.send(raw);
      }
    }
  }
}

function allLocked(match: MatchState): boolean {
  return match.players.every((player) => player.locked);
}

function streamResult(match: MatchState): void {
  if (!match.result || match.streamed) {
    return;
  }

  match.streamed = true;
  broadcast(match, {
    type: "live_start",
    matchId: match.matchId,
    totalEvents: match.result.events.length,
    initialSnapshot: match.initialSnapshot
  });

  for (const event of match.result.events) {
    broadcast(match, {
      type: "live",
      matchId: match.matchId,
      event
    });
  }

  broadcast(match, {
    type: "result",
    matchId: match.matchId,
    result: match.result
  });
}

function runBattleIfReady(match: MatchState): void {
  if (!allLocked(match) || match.result) {
    return;
  }

  const [left, right] = match.players;
  const leftValidation = validateLoadout(left.loadout, unitCatalog);
  const rightValidation = validateLoadout(right.loadout, unitCatalog);

  if (!leftValidation.ok || !rightValidation.ok) {
    const invalidPlayer = !leftValidation.ok ? left.playerId : right.playerId;
    const opponent = !leftValidation.ok ? right.playerId : left.playerId;

    match.result = {
      matchId: match.matchId,
      winnerPlayerId: opponent,
      balanceVersion: process.env.GAME_DATA_BALANCE_VERSION ?? "0.1.0-alpha",
      events: [
        {
          id: "evt-1",
          seq: 1,
          tick: 0,
          type: "match_end",
          payload: {
            winnerPlayerId: opponent,
            reason: `invalid_loadout:${invalidPlayer}`
          }
        }
      ]
    };

    streamResult(match);
    return;
  }

  const simulationInput: BattleSimulationInput = {
    matchId: match.matchId,
    seed: Date.now() % 1000000,
    balanceVersion: process.env.GAME_DATA_BALANCE_VERSION ?? "0.1.0-alpha",
    players: [
      {
        playerId: left.playerId,
        units: getUnitsFromLoadout(left.loadout)
      },
      {
        playerId: right.playerId,
        units: getUnitsFromLoadout(right.loadout)
      }
    ],
    grid: {
      width: gridWidth,
      height: gridHeight
    },
    fixedTickMs
  };

  const simulation = simulateBattle(simulationInput);
  match.initialSnapshot = simulation.initialSnapshot;
  match.result = simulation.result;
  streamResult(match);
}

function getOrCreateMatch(matchId: string, playerId: string): MatchState {
  const existing = matches.get(matchId);
  if (existing) {
    return existing;
  }

  const fallbackPlayer = `${playerId}-bot`;
  const defaultUnits = unitCatalog.slice(0, 8).map((unit) => unit.id);
  const fallbackLoadout: Loadout = {
    playerId,
    unitIds: defaultUnits,
    energyCap: 1000
  };

  const fallbackMatch: MatchState = {
    matchId,
    players: [
      {
        playerId,
        loadout: fallbackLoadout,
        locked: false
      },
      {
        playerId: fallbackPlayer,
        loadout: {
          ...fallbackLoadout,
          playerId: fallbackPlayer,
          unitIds: unitCatalog.slice(30, 38).map((unit) => unit.id)
        },
        locked: false
      }
    ],
    createdAt: Date.now(),
    prepDeadlineAt: Date.now() + prepSeconds * 1000,
    result: null,
    initialSnapshot: null,
    streamed: false,
    connections: new Map([
      [playerId, new Set<WebSocket>()],
      [fallbackPlayer, new Set<WebSocket>()]
    ]),
    resultAcks: new Map()
  };

  matches.set(matchId, fallbackMatch);
  return fallbackMatch;
}

async function bootstrap(): Promise<void> {
  const { app } = await createServiceRuntime({ serviceName: "battle-service" });
  await app.register(websocket);

  app.post("/internal/matches", async (request, reply) => {
    const parsed = createMatchSchema.safeParse(request.body);
    if (!parsed.success) {
      sendApiError(reply, 400, "invalid_payload", "malformed internal match payload");
      return;
    }

    const payload = parsed.data;
    const players: [MatchPlayerState, MatchPlayerState] = [
      {
        playerId: payload.players[0].playerId,
        loadout: payload.players[0].loadout,
        locked: false
      },
      {
        playerId: payload.players[1].playerId,
        loadout: payload.players[1].loadout,
        locked: false
      }
    ];

    const match: MatchState = {
      matchId: payload.matchId,
      players,
      createdAt: Date.now(),
      prepDeadlineAt: Date.now() + prepSeconds * 1000,
      result: null,
      initialSnapshot: null,
      streamed: false,
      connections: createEmptyConnections(players),
      resultAcks: new Map()
    };

    matches.set(payload.matchId, match);
    return { ok: true, matchId: payload.matchId };
  });

  app.post("/match/result/ack", async (request, reply) => {
    const parsed = ackSchema.safeParse(request.body);
    if (!parsed.success) {
      sendApiError(reply, 400, "invalid_payload", "malformed ack payload");
      return;
    }

    const payload = parsed.data;
    const match = matches.get(payload.matchId);
    if (!match) {
      sendApiError(reply, 404, "match_not_found", "unknown matchId");
      return;
    }

    match.resultAcks.set(payload.playerId, payload.eventSeq);
    return {
      ok: true,
      acks: [...match.resultAcks.entries()].map(([playerId, eventSeq]) => ({
        playerId,
        eventSeq
      }))
    };
  });

  app.get("/match/:matchId/events", async (request, reply) => {
    const params = request.params as { matchId: string };
    const query = request.query as { fromSeq?: string };
    const fromSeq = query.fromSeq ? Number(query.fromSeq) : 0;

    const match = matches.get(params.matchId);
    if (!match || !match.result) {
      sendApiError(reply, 404, "result_not_found", "match result unavailable");
      return;
    }

    const events = match.result.events.filter((event) => event.seq > fromSeq);
    return {
      matchId: match.matchId,
      events,
      winnerPlayerId: match.result.winnerPlayerId
    };
  });

  app.get("/match/:matchId", { websocket: true }, (socket, request) => {
    const params = request.params as { matchId: string };
    const query = request.query as { playerId?: string; fromSeq?: string };

    const playerId = query.playerId;
    if (!playerId) {
      socket.send(
        serialize({
          type: "error",
          code: "missing_player_id"
        })
      );
      socket.close();
      return;
    }

    const match = getOrCreateMatch(params.matchId, playerId);
    if (!match.connections.has(playerId)) {
      socket.send(
        serialize({
          type: "error",
          code: "player_not_in_match"
        })
      );
      socket.close();
      return;
    }

    const playerSockets = match.connections.get(playerId);
    playerSockets?.add(socket);

    const prepRemainingMs = Math.max(0, match.prepDeadlineAt - Date.now());
    socket.send(
      serialize({
        type: "prep",
        matchId: match.matchId,
        prepEndsAt: new Date(match.prepDeadlineAt).toISOString(),
        prepRemainingMs,
        players: match.players.map((player) => ({
          playerId: player.playerId,
          locked: player.locked
        }))
      })
    );

    const fromSeq = query.fromSeq ? Number(query.fromSeq) : 0;
    if (match.result) {
      const backlog = match.result.events.filter((event) => event.seq > fromSeq);
      for (const event of backlog) {
        socket.send(
          serialize({
            type: "live",
            matchId: match.matchId,
            event
          })
        );
      }
      socket.send(
        serialize({
          type: "result",
          matchId: match.matchId,
          result: match.result
        })
      );
    }

    socket.on("message", (raw: RawData) => {
      const payload = safeJson<ClientMessage>(String(raw), { type: "ping" });
      if (payload.type === "ping") {
        socket.send(serialize({ type: "pong", matchId: match.matchId }));
        return;
      }

      if (payload.type === "lock_in") {
        const playerState = match.players.find((player) => player.playerId === playerId);
        if (!playerState) {
          socket.send(serialize({ type: "error", code: "player_not_found" }));
          return;
        }

        if (payload.loadout) {
          if (payload.loadout.playerId !== playerId) {
            socket.send(serialize({ type: "error", code: "loadout_owner_mismatch" }));
            return;
          }
          playerState.loadout = payload.loadout;
        }

        playerState.locked = true;
        broadcast(match, {
          type: "prep_update",
          matchId: match.matchId,
          players: match.players.map((player) => ({
            playerId: player.playerId,
            locked: player.locked
          }))
        });

        runBattleIfReady(match);
      }
    });

    socket.on("close", () => {
      playerSockets?.delete(socket);
    });
  });

  const timeoutCheck = setInterval(() => {
    const now = Date.now();
    for (const match of matches.values()) {
      if (match.result) {
        continue;
      }

      if (now >= match.prepDeadlineAt) {
        for (const player of match.players) {
          if (!player.locked) {
            player.locked = true;
          }
        }
        runBattleIfReady(match);
      }
    }
  }, 250);

  app.addHook("onClose", async () => {
    clearInterval(timeoutCheck);
    matches.clear();
  });

  await startRuntime(app, parsePort("BATTLE_PORT", 4004));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

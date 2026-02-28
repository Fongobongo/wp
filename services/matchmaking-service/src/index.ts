import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import { buildUnitCatalog, validateLoadout } from "@warprotocol/game-data";
import {
  createServiceRuntime,
  parsePort,
  sendApiError,
  startRuntime
} from "@warprotocol/service-runtime";
import type {
  Loadout,
  QueueJoinRequest,
  QueueJoinResponse,
  QueueLeaveRequest
} from "@warprotocol/shared-types";
import { z } from "zod";

const joinSchema = z.object({
  playerId: z.string(),
  mmr: z.number().int(),
  loadout: z.object({
    playerId: z.string(),
    unitIds: z.array(z.string()),
    energyCap: z.number().int().positive()
  })
});

const leaveSchema = z.object({
  playerId: z.string()
});

interface QueueEntry {
  ticket: string;
  playerId: string;
  mmr: number;
  joinedAt: number;
  loadout: Loadout;
}

interface PendingMatch {
  matchId: string;
  opponentPlayerId: string;
  websocketUrl: string;
}

const queueEntries: QueueEntry[] = [];
const pendingMatches = new Map<string, PendingMatch>();
const unitCatalog = buildUnitCatalog();
const mmrWindow = Number(process.env.MATCHMAKING_MMR_WINDOW ?? 200);
const battleServiceUrl = process.env.BATTLE_SERVICE_URL ?? "http://localhost:4004";
const battleWsUrl = process.env.BATTLE_WS_URL ?? "ws://localhost:4004";

let matchEventQueue: Queue | null = null;

if (process.env.REDIS_URL) {
  const redisUrl = new URL(process.env.REDIS_URL);
  const redisPort = redisUrl.port ? Number(redisUrl.port) : 6379;
  matchEventQueue = new Queue("match-events", {
    connection: {
      host: redisUrl.hostname,
      port: redisPort,
      ...(redisUrl.password ? { password: redisUrl.password } : {})
    }
  });
}

function pullPending(playerId: string): PendingMatch | null {
  const pending = pendingMatches.get(playerId);
  if (!pending) {
    return null;
  }
  pendingMatches.delete(playerId);
  return pending;
}

function findOpponentIndex(playerId: string, mmr: number): number {
  let bestIndex = -1;
  let bestDistance = Number.MAX_SAFE_INTEGER;

  queueEntries.forEach((entry, idx) => {
    if (entry.playerId === playerId) {
      return;
    }
    const distance = Math.abs(entry.mmr - mmr);
    if (distance <= mmrWindow && distance < bestDistance) {
      bestDistance = distance;
      bestIndex = idx;
    }
  });

  return bestIndex;
}

async function createBattle(matchId: string, left: QueueEntry, right: QueueEntry): Promise<void> {
  const response = await fetch(`${battleServiceUrl}/internal/matches`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      matchId,
      players: [
        {
          playerId: left.playerId,
          loadout: left.loadout
        },
        {
          playerId: right.playerId,
          loadout: right.loadout
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Battle service rejected match ${matchId}: ${response.status}`);
  }

  if (matchEventQueue) {
    await matchEventQueue.add("match-created", {
      matchId,
      leftPlayerId: left.playerId,
      rightPlayerId: right.playerId,
      createdAt: Date.now()
    });
  }
}

async function bootstrap(): Promise<void> {
  const { app } = await createServiceRuntime({ serviceName: "matchmaking-service" });

  app.post("/queue/join", async (request, reply) => {
    const parsed = joinSchema.safeParse(request.body);
    if (!parsed.success) {
      sendApiError(reply, 400, "invalid_payload", "join payload malformed");
      return;
    }

    const payload = parsed.data as QueueJoinRequest;
    if (payload.playerId !== payload.loadout.playerId) {
      sendApiError(reply, 400, "loadout_owner_mismatch", "loadout.playerId must match playerId");
      return;
    }

    const loadoutValidation = validateLoadout(payload.loadout, unitCatalog);
    if (!loadoutValidation.ok) {
      reply.status(422).send(loadoutValidation);
      return;
    }

    const pending = pullPending(payload.playerId);
    if (pending) {
      const response: QueueJoinResponse = {
        status: "matched",
        matchId: pending.matchId,
        websocketUrl: `${pending.websocketUrl}/match/${pending.matchId}?playerId=${payload.playerId}`,
        opponentPlayerId: pending.opponentPlayerId
      };
      return response;
    }

    const existingQueueItem = queueEntries.find((entry) => entry.playerId === payload.playerId);
    if (existingQueueItem) {
      return {
        status: "queued",
        queueTicket: existingQueueItem.ticket
      } satisfies QueueJoinResponse;
    }

    const queueEntry: QueueEntry = {
      ticket: randomUUID(),
      playerId: payload.playerId,
      mmr: payload.mmr,
      joinedAt: Date.now(),
      loadout: payload.loadout
    };

    const opponentIndex = findOpponentIndex(payload.playerId, payload.mmr);
    if (opponentIndex < 0) {
      queueEntries.push(queueEntry);
      return {
        status: "queued",
        queueTicket: queueEntry.ticket
      } satisfies QueueJoinResponse;
    }

    const [opponent] = queueEntries.splice(opponentIndex, 1);
    const matchId = randomUUID();

    try {
      await createBattle(matchId, opponent, queueEntry);
    } catch (error) {
      queueEntries.push(opponent);
      sendApiError(reply, 503, "battle_service_unavailable", error instanceof Error ? error.message : "unknown");
      return;
    }

    pendingMatches.set(opponent.playerId, {
      matchId,
      opponentPlayerId: queueEntry.playerId,
      websocketUrl: battleWsUrl
    });

    return {
      status: "matched",
      matchId,
      websocketUrl: `${battleWsUrl}/match/${matchId}?playerId=${queueEntry.playerId}`,
      opponentPlayerId: opponent.playerId
    } satisfies QueueJoinResponse;
  });

  app.get("/queue/status", async (request) => {
    const query = request.query as { playerId?: string };
    if (!query.playerId) {
      return {
        status: "queued",
        queueTicket: null
      };
    }

    const pending = pullPending(query.playerId);
    if (pending) {
      return {
        status: "matched",
        matchId: pending.matchId,
        websocketUrl: `${pending.websocketUrl}/match/${pending.matchId}?playerId=${query.playerId}`,
        opponentPlayerId: pending.opponentPlayerId
      } satisfies QueueJoinResponse;
    }

    const queued = queueEntries.find((entry) => entry.playerId === query.playerId);
    if (queued) {
      return {
        status: "queued",
        queueTicket: queued.ticket
      } satisfies QueueJoinResponse;
    }

    return {
      status: "queued",
      queueTicket: null
    };
  });

  app.post("/queue/leave", async (request) => {
    const parsed = leaveSchema.safeParse(request.body);
    if (!parsed.success) {
      return {
        removed: false,
        reason: "invalid_payload"
      };
    }

    const payload = parsed.data as QueueLeaveRequest;
    const index = queueEntries.findIndex((entry) => entry.playerId === payload.playerId);
    if (index === -1) {
      return {
        removed: false
      };
    }

    queueEntries.splice(index, 1);
    return {
      removed: true
    };
  });

  app.get("/queue/debug", async () => {
    return {
      queueSize: queueEntries.length,
      pendingMatches: pendingMatches.size,
      head: queueEntries.slice(0, 5)
    };
  });

  app.addHook("onClose", async () => {
    await matchEventQueue?.close();
  });

  await startRuntime(app, parsePort("MATCHMAKING_PORT", 4003));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

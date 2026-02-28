import { randomUUID } from "node:crypto";
import { buildUnitCatalog, validateLoadout } from "@warprotocol/game-data";
import {
  createServiceRuntime,
  parsePort,
  sendApiError,
  startRuntime
} from "@warprotocol/service-runtime";
import type {
  InventoryItem,
  Loadout,
  Profile
} from "@warprotocol/shared-types";
import { z } from "zod";

const loginSchema = z.object({
  displayName: z.string().min(2).max(24)
});

const profileStore = new Map<string, Profile>();
const sessionStore = new Map<string, string>();
const inventoryStore = new Map<string, InventoryItem[]>();
const loadoutSchema = z.object({
  playerId: z.string(),
  unitIds: z.array(z.string()),
  energyCap: z.number().int().positive()
});

const unitCatalog = buildUnitCatalog();

function ensurePlayer(playerId: string): Profile {
  const existing = profileStore.get(playerId);
  if (existing) {
    return existing;
  }

  const created: Profile = {
    playerId,
    displayName: `Commander-${playerId.slice(0, 6)}`,
    rating: 1000,
    accountLevel: 1,
    season: "season-0"
  };

  profileStore.set(playerId, created);
  inventoryStore.set(playerId, [
    {
      id: `banner-${playerId}`,
      type: "banner",
      name: "Founders Banner",
      rarity: "common"
    },
    {
      id: `emote-${playerId}`,
      type: "emote",
      name: "Protocol Salute",
      rarity: "rare"
    }
  ]);

  return created;
}

function authPlayer(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "").trim();
  return sessionStore.get(token) ?? null;
}

async function bootstrap(): Promise<void> {
  const { app } = await createServiceRuntime({ serviceName: "player-service" });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      sendApiError(reply, 400, "invalid_payload", "displayName must be 2-24 chars");
      return;
    }

    const playerId = randomUUID();
    const sessionToken = randomUUID();
    const profile: Profile = {
      ...ensurePlayer(playerId),
      displayName: parsed.data.displayName
    };
    profileStore.set(playerId, profile);
    sessionStore.set(sessionToken, playerId);

    return {
      playerId,
      sessionToken,
      profile
    };
  });

  app.post("/auth/guest", async () => {
    const playerId = randomUUID();
    const sessionToken = randomUUID();
    const profile = ensurePlayer(playerId);
    sessionStore.set(sessionToken, playerId);

    return {
      playerId,
      sessionToken,
      profile
    };
  });

  app.get("/profile", async (request, reply) => {
    const query = request.query as { playerId?: string };
    const authPlayerId = authPlayer(request.headers.authorization);
    const playerId = query.playerId ?? authPlayerId;
    if (!playerId) {
      sendApiError(reply, 401, "unauthorized", "missing bearer token or playerId");
      return;
    }

    return ensurePlayer(playerId);
  });

  app.get("/inventory", async (request, reply) => {
    const query = request.query as { playerId?: string };
    const authPlayerId = authPlayer(request.headers.authorization);
    const playerId = query.playerId ?? authPlayerId;
    if (!playerId) {
      sendApiError(reply, 401, "unauthorized", "missing bearer token or playerId");
      return;
    }

    const profile = ensurePlayer(playerId);
    return {
      playerId,
      accountLevel: profile.accountLevel,
      items: inventoryStore.get(playerId) ?? []
    };
  });

  app.post("/loadout/validate", async (request, reply) => {
    const parsed = loadoutSchema.safeParse(request.body);
    if (!parsed.success) {
      sendApiError(reply, 400, "invalid_payload", "loadout payload malformed");
      return;
    }

    const loadout = parsed.data as Loadout;
    ensurePlayer(loadout.playerId);
    const result = validateLoadout(loadout, unitCatalog);

    if (!result.ok) {
      reply.status(422).send(result);
      return;
    }

    return result;
  });

  await startRuntime(app, parsePort("PLAYER_PORT", 4002));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

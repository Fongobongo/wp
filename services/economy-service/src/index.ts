import {
  createServiceRuntime,
  parsePort,
  sendApiError,
  startRuntime
} from "@warprotocol/service-runtime";
import type {
  BattlePassState,
  RewardBundle
} from "@warprotocol/shared-types";
import { z } from "zod";

const seasonId = process.env.SEASON_ID ?? "season-0";

const stateByPlayer = new Map<string, BattlePassState>();

const xpSchema = z.object({
  playerId: z.string().min(1),
  xp: z.number().int().positive()
});

function ensureState(playerId: string): BattlePassState {
  const existing = stateByPlayer.get(playerId);
  if (existing) {
    return existing;
  }

  const created: BattlePassState = {
    seasonId,
    level: 1,
    premium: false,
    freeRewardsClaimed: [],
    premiumRewardsClaimed: []
  };

  stateByPlayer.set(playerId, created);
  return created;
}

function rewardsForLevel(playerId: string, level: number): RewardBundle {
  return {
    playerId,
    credits: level * 50,
    battlePassXp: level * 100,
    cosmeticsUnlocked: level % 5 === 0 ? [`season-${seasonId}-skin-${level}`] : []
  };
}

async function bootstrap(): Promise<void> {
  const { app } = await createServiceRuntime({ serviceName: "economy-service" });

  app.get("/battle-pass", async (request, reply) => {
    const query = request.query as { playerId?: string };
    if (!query.playerId) {
      sendApiError(reply, 400, "missing_player_id", "playerId query required");
      return;
    }

    const state = ensureState(query.playerId);
    return {
      playerId: query.playerId,
      state,
      nextReward: rewardsForLevel(query.playerId, state.level + 1)
    };
  });

  app.post("/battle-pass/xp", async (request, reply) => {
    const parsed = xpSchema.safeParse(request.body);
    if (!parsed.success) {
      sendApiError(reply, 400, "invalid_payload", "playerId and positive xp required");
      return;
    }

    const payload = parsed.data;
    const state = ensureState(payload.playerId);
    const previousLevel = state.level;
    const levelGain = Math.floor(payload.xp / 1000);
    state.level += Math.max(0, levelGain);

    const unlockedRewards: RewardBundle[] = [];
    for (let level = previousLevel + 1; level <= state.level; level += 1) {
      unlockedRewards.push(rewardsForLevel(payload.playerId, level));
    }

    return {
      playerId: payload.playerId,
      fromLevel: previousLevel,
      toLevel: state.level,
      unlockedRewards
    };
  });

  await startRuntime(app, parsePort("ECONOMY_PORT", 4005));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

import type {
  BattleEvent,
  BattleSnapshot,
  GameDataResponse,
  Loadout,
  MatchResult,
  Profile,
  QueueJoinResponse
} from "@warprotocol/shared-types";

const GAME_DATA_URL = import.meta.env.VITE_GAME_DATA_URL ?? "http://localhost:4001";
const PLAYER_URL = import.meta.env.VITE_PLAYER_URL ?? "http://localhost:4002";
const MATCHMAKING_URL = import.meta.env.VITE_MATCHMAKING_URL ?? "http://localhost:4003";
const BATTLE_URL = import.meta.env.VITE_BATTLE_URL ?? "http://localhost:4004";
const ECONOMY_URL = import.meta.env.VITE_ECONOMY_URL ?? "http://localhost:4005";

export interface LoginResponse {
  playerId: string;
  sessionToken: string;
  profile: Profile;
}

export interface QueueJoinPayload {
  playerId: string;
  mmr: number;
  loadout: Loadout;
}

export interface QueueStatusResponse extends QueueJoinResponse {}

export interface BattlePassResponse {
  playerId: string;
  state: {
    seasonId: string;
    level: number;
    premium: boolean;
  };
}

export interface WsMessage {
  type: string;
  matchId?: string;
  event?: BattleEvent;
  result?: MatchResult;
  initialSnapshot?: BattleSnapshot;
  prepRemainingMs?: number;
  players?: Array<{ playerId: string; locked: boolean }>;
  totalEvents?: number;
  [key: string]: unknown;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function loginGuest(): Promise<LoginResponse> {
  return jsonRequest<LoginResponse>(`${PLAYER_URL}/auth/guest`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function loginWithName(displayName: string): Promise<LoginResponse> {
  return jsonRequest<LoginResponse>(`${PLAYER_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ displayName })
  });
}

export async function getGameData(): Promise<GameDataResponse> {
  return jsonRequest<GameDataResponse>(`${GAME_DATA_URL}/game-data`);
}

export async function validateLoadout(loadout: Loadout): Promise<{ ok: boolean; errors: string[] }> {
  return jsonRequest<{ ok: boolean; errors: string[] }>(`${PLAYER_URL}/loadout/validate`, {
    method: "POST",
    body: JSON.stringify(loadout)
  });
}

export async function queueJoin(payload: QueueJoinPayload): Promise<QueueJoinResponse> {
  return jsonRequest<QueueJoinResponse>(`${MATCHMAKING_URL}/queue/join`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function queueStatus(playerId: string): Promise<QueueStatusResponse> {
  return jsonRequest<QueueStatusResponse>(`${MATCHMAKING_URL}/queue/status?playerId=${encodeURIComponent(playerId)}`);
}

export async function queueLeave(playerId: string): Promise<{ removed: boolean }> {
  return jsonRequest<{ removed: boolean }>(`${MATCHMAKING_URL}/queue/leave`, {
    method: "POST",
    body: JSON.stringify({ playerId })
  });
}

export async function getBattlePass(playerId: string): Promise<BattlePassResponse> {
  return jsonRequest<BattlePassResponse>(`${ECONOMY_URL}/battle-pass?playerId=${encodeURIComponent(playerId)}`);
}

export async function ackMatchResult(matchId: string, playerId: string, eventSeq: number): Promise<void> {
  await jsonRequest(`${BATTLE_URL}/match/result/ack`, {
    method: "POST",
    body: JSON.stringify({ matchId, playerId, eventSeq })
  });
}

export function buildMatchWebSocketUrl(url: string): string {
  return url;
}

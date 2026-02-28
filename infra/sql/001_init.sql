-- WAR PROTOCOL baseline schema

CREATE TABLE IF NOT EXISTS players (
  player_id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1000,
  account_level INTEGER NOT NULL DEFAULT 1,
  season TEXT NOT NULL DEFAULT 'season-0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token UUID PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_results (
  match_id UUID PRIMARY KEY,
  winner_player_id TEXT NOT NULL,
  balance_version TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_ratings (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES match_results(match_id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  before_rating INTEGER NOT NULL,
  after_rating INTEGER NOT NULL,
  delta INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS battle_pass_state (
  player_id UUID PRIMARY KEY REFERENCES players(player_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  premium BOOLEAN NOT NULL DEFAULT FALSE,
  free_rewards_claimed JSONB NOT NULL DEFAULT '[]'::jsonb,
  premium_rewards_claimed JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_player ON inventory_items(player_id);
CREATE INDEX IF NOT EXISTS idx_match_created_at ON match_results(created_at DESC);

-- Municipal Vision Platform — PostgreSQL + PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS cameras (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  geom GEOGRAPHY(POINT, 4326) NOT NULL,
  h_matrix JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY,
  camera_id TEXT NOT NULL REFERENCES cameras(id),
  task_id TEXT NOT NULL,
  track_key TEXT NOT NULL,
  class_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  UNIQUE (camera_id, task_id, track_key, started_at)
);

CREATE TABLE IF NOT EXISTS detections (
  id BIGSERIAL PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES tracks(id),
  frame_ts TIMESTAMPTZ NOT NULL,
  conf REAL NOT NULL,
  bbox JSONB NOT NULL,
  geom GEOGRAPHY(POINT, 4326),
  thumb_uri TEXT
);

CREATE TABLE IF NOT EXISTS permits (
  id TEXT PRIMARY KEY,
  geom GEOGRAPHY(POINT, 4326) NOT NULL,
  start_date DATE,
  end_date DATE,
  board_id TEXT
);

CREATE TABLE IF NOT EXISTS geo_features (
  id TEXT PRIMARY KEY,
  feature_type TEXT NOT NULL,
  name TEXT,
  geom GEOGRAPHY(POLYGON, 4326) NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY,
  track_id UUID NOT NULL UNIQUE REFERENCES tracks(id),
  task_id TEXT NOT NULL,
  risk_score INT NOT NULL,
  priority_score INT NOT NULL,
  review_tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reasons JSONB NOT NULL DEFAULT '[]',
  risk_breakdown JSONB NOT NULL DEFAULT '{}',
  priority_breakdown JSONB NOT NULL DEFAULT '{}',
  geom GEOGRAPHY(POINT, 4326),
  assignee TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES candidates(id),
  action_type TEXT NOT NULL,
  department TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'assigned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_priority ON candidates (priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_geom ON candidates USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_permits_geom ON permits USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_geo_features_geom ON geo_features USING GIST (geom);

-- Guardian: crime hotspots (run via InsForge CLI)
-- npx @insforge/cli db import backend/insforge/schema.sql
-- or: npx @insforge/cli db query "$(cat backend/insforge/schema.sql)"

CREATE TABLE IF NOT EXISTS hotspots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  category TEXT NOT NULL,
  severity SMALLINT NOT NULL CHECK (severity >= 1 AND severity <= 5),
  occurred_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'sfpd',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotspots_lat ON hotspots (lat);
CREATE INDEX IF NOT EXISTS idx_hotspots_lng ON hotspots (lng);
CREATE INDEX IF NOT EXISTS idx_hotspots_occurred_at ON hotspots (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotspots_category ON hotspots (category);

ALTER TABLE hotspots ENABLE ROW LEVEL SECURITY;

-- Map + API can read hotspots without auth during hackathon demo
DROP POLICY IF EXISTS "hotspots_public_read" ON hotspots;
CREATE POLICY "hotspots_public_read"
  ON hotspots FOR SELECT
  USING (true);

-- Stretch: user profiles (InsForge auth)
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  home_city TEXT,
  prefs JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_owner_read" ON profiles;
CREATE POLICY "profiles_owner_read"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "profiles_owner_write" ON profiles;
CREATE POLICY "profiles_owner_write"
  ON profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Stretch: saved trips
CREATE TABLE IF NOT EXISTS trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'walking',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips (user_id);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trips_owner" ON trips;
CREATE POLICY "trips_owner"
  ON trips FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

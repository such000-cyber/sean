/*
# Create devices and readings tables (single-tenant, no auth)

1. New Tables
- `devices` — utility meters registered by the user (electricity, water, gas, etc.)
  - `id` (uuid, primary key)
  - `name` (text, not null) — display name e.g. "Електричество"
  - `type` (text, not null) — meter type: electricity, water, gas, heat, other
  - `unit` (text, not null) — unit of measurement e.g. "kWh", "m³"
  - `number` (text) — optional meter serial number
  - `location` (text) — optional location e.g. "Апартамент"
  - `color` (text, default '#0ea5e9') — hex accent color for charts/badges
  - `created_at` (timestamptz)
- `readings` — monthly readings recorded for each device
  - `id` (uuid, primary key)
  - `device_id` (uuid, foreign key → devices.id ON DELETE CASCADE)
  - `reading_date` (date, not null) — the month the reading applies to (stored as 1st of month)
  - `value` (numeric(14,3), not null) — the meter reading value
  - `note` (text) — optional note
  - `created_at` (timestamptz)
  - UNIQUE constraint on (device_id, reading_date) — one reading per device per month

2. Security
- Enable RLS on both tables.
- Single-tenant app (no sign-in): allow anon + authenticated full CRUD.
*/

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'electricity',
  unit text NOT NULL DEFAULT 'kWh',
  number text,
  location text,
  color text NOT NULL DEFAULT '#0ea5e9',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  reading_date date NOT NULL,
  value numeric(14,3) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, reading_date)
);

CREATE INDEX IF NOT EXISTS idx_readings_device_date ON readings (device_id, reading_date DESC);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_devices" ON devices;
CREATE POLICY "anon_select_devices" ON devices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_devices" ON devices;
CREATE POLICY "anon_insert_devices" ON devices FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_devices" ON devices;
CREATE POLICY "anon_update_devices" ON devices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_devices" ON devices;
CREATE POLICY "anon_delete_devices" ON devices FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_readings" ON readings;
CREATE POLICY "anon_select_readings" ON readings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_readings" ON readings;
CREATE POLICY "anon_insert_readings" ON readings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_readings" ON readings;
CREATE POLICY "anon_update_readings" ON readings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_readings" ON readings;
CREATE POLICY "anon_delete_readings" ON readings FOR DELETE
  TO anon, authenticated USING (true);
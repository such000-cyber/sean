/*
# Add inventory_number and coefficient columns to devices

1. Modified Tables
- `devices`
  - `inventory_number` (text, nullable) — optional inventory/asset number for the device
  - `coefficient` (numeric(10,4), not null, default 1) — multiplier applied to consumption delta (e.g. transformation ratio)
2. Security
- No policy changes — existing anon/authenticated CRUD policies already cover the new columns.
*/

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS inventory_number text,
  ADD COLUMN IF NOT EXISTS coefficient numeric(10,4) NOT NULL DEFAULT 1;
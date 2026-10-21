/*
# Add company locations (обекти/филиали)

1. New Tables
- `company_locations` — locations/branches belonging to a company (e.g. София, Видин, Бургас)
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK → companies.id ON DELETE CASCADE)
  - `name` (text, not null) — location name (e.g. "София")
  - `created_at` (timestamptz)

2. Modified Tables
- `devices`
  - `location_id` (uuid, nullable, FK → company_locations.id ON DELETE SET NULL) — optional link to a company location

3. Security
- Enable RLS on `company_locations`.
- This app has auth (admin/company_user roles). Policies scoped to authenticated users.
- All authenticated users can read locations (needed for filtering/display).
- Only authenticated users can insert/update/delete locations.
- Enable realtime for the new table.
*/

CREATE TABLE IF NOT EXISTS company_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_locations_company ON company_locations(company_id);

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES company_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_location ON devices(location_id);

ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_company_locations" ON company_locations;
CREATE POLICY "auth_select_company_locations" ON company_locations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_company_locations" ON company_locations;
CREATE POLICY "auth_insert_company_locations" ON company_locations FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_company_locations" ON company_locations;
CREATE POLICY "auth_update_company_locations" ON company_locations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_company_locations" ON company_locations;
CREATE POLICY "auth_delete_company_locations" ON company_locations FOR DELETE
  TO authenticated USING (true);

-- Enable realtime for company_locations
ALTER PUBLICATION supabase_realtime ADD TABLE company_locations;
/*
# Add companies, clients, and device-client allocation

1. New Tables
- `companies` — companies that own/manage devices
  - `id` (uuid, primary key)
  - `name` (text, not null)
  - `bulstat` (text) — Bulgarian company ID (ЕИК/БУЛСТАТ)
  - `address` (text)
  - `phone` (text)
  - `email` (text)
  - `created_at` (timestamptz)
- `clients` — clients associated with a company who share device usage
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK → companies.id ON DELETE CASCADE)
  - `name` (text, not null)
  - `identifier` (text) — client ID / personal number
  - `phone` (text)
  - `email` (text)
  - `created_at` (timestamptz)
- `device_clients` — many-to-many join: which clients use which device, with percentage allocation
  - `id` (uuid, primary key)
  - `device_id` (uuid, FK → devices.id ON DELETE CASCADE)
  - `client_id` (uuid, FK → clients.id ON DELETE CASCADE)
  - `percentage` (numeric(5,2), not null, default 100) — share of consumption (0–100)
  - `created_at` (timestamptz)
  - UNIQUE (device_id, client_id) — a client can be linked to a device only once

2. Modified Tables
- `devices`
  - `company_id` (uuid, nullable, FK → companies.id ON DELETE SET NULL) — the company this device belongs to

3. Security
- Enable RLS on all new tables.
- Single-tenant app (no auth): allow anon + authenticated full CRUD on all new tables.
*/

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bulstat text,
  address text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  identifier text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  percentage numeric(5,2) NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_device_clients_device ON device_clients(device_id);
CREATE INDEX IF NOT EXISTS idx_device_clients_client ON device_clients(client_id);

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_company ON devices(company_id);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_clients ENABLE ROW LEVEL SECURITY;

-- companies policies
DROP POLICY IF EXISTS "anon_select_companies" ON companies;
CREATE POLICY "anon_select_companies" ON companies FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_companies" ON companies;
CREATE POLICY "anon_insert_companies" ON companies FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_companies" ON companies;
CREATE POLICY "anon_update_companies" ON companies FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_companies" ON companies;
CREATE POLICY "anon_delete_companies" ON companies FOR DELETE
  TO anon, authenticated USING (true);

-- clients policies
DROP POLICY IF EXISTS "anon_select_clients" ON clients;
CREATE POLICY "anon_select_clients" ON clients FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_clients" ON clients;
CREATE POLICY "anon_insert_clients" ON clients FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_clients" ON clients;
CREATE POLICY "anon_update_clients" ON clients FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_clients" ON clients;
CREATE POLICY "anon_delete_clients" ON clients FOR DELETE
  TO anon, authenticated USING (true);

-- device_clients policies
DROP POLICY IF EXISTS "anon_select_device_clients" ON device_clients;
CREATE POLICY "anon_select_device_clients" ON device_clients FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_device_clients" ON device_clients;
CREATE POLICY "anon_insert_device_clients" ON device_clients FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_device_clients" ON device_clients;
CREATE POLICY "anon_update_device_clients" ON device_clients FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_device_clients" ON device_clients;
CREATE POLICY "anon_delete_device_clients" ON device_clients FOR DELETE
  TO anon, authenticated USING (true);
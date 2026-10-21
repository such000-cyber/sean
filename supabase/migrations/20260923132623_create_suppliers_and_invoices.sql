/*
# Create suppliers and supplier invoices

1. New Tables
- `suppliers` — доставчици на услуги (ток, вода, газ, топло и др.)
  - id (uuid PK)
  - name (text, not null) — име на доставчика
  - service_type (text, not null) — вид услуга: electricity / water / gas / heat / other
  - bulstat (text) — ЕИК на доставчика
  - address (text) — адрес
  - phone (text) — телефон
  - email (text) — имейл
  - created_at (timestamptz)
- `supplier_invoices` — фактури от доставчици за даден месец
  - id (uuid PK)
  - supplier_id (uuid FK → suppliers, cascade delete)
  - invoice_number (text, not null) — номер на фактурата
  - invoice_date (date, not null) — дата на фактурата
  - service_month (text, not null) — месец на услугата, формат YYYY-MM
  - quantity (numeric, not null) — количество (kWh, m³, тон и т.н.)
  - unit (text, not null) — мерна единица
  - amount (numeric, not null) — стойност без ДДС
  - vat_amount (numeric, default 0) — ДДС
  - total_amount (numeric, not null) — обща стойност с ДДС
  - note (text) — бележка
  - created_at (timestamptz)

2. Indexes
- idx_supplier_invoices_supplier_id — бързо търсене на фактури по доставчик
- idx_supplier_invoices_service_month — филтриране по месец

3. Security
- RLS enabled на двете таблици.
- Приложението е без вход (single-tenant), затова политиките са TO anon, authenticated с USING (true) / WITH CHECK (true) — данните са общодостъпни.
*/ 

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_type text NOT NULL DEFAULT 'electricity',
  bulstat text,
  address text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_suppliers" ON suppliers;
CREATE POLICY "anon_select_suppliers" ON suppliers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_suppliers" ON suppliers;
CREATE POLICY "anon_insert_suppliers" ON suppliers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_suppliers" ON suppliers;
CREATE POLICY "anon_update_suppliers" ON suppliers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_suppliers" ON suppliers;
CREATE POLICY "anon_delete_suppliers" ON suppliers FOR DELETE
  TO anon, authenticated USING (true);


CREATE TABLE IF NOT EXISTS supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  service_month text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kWh',
  amount numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_supplier_invoices" ON supplier_invoices;
CREATE POLICY "anon_select_supplier_invoices" ON supplier_invoices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_supplier_invoices" ON supplier_invoices;
CREATE POLICY "anon_insert_supplier_invoices" ON supplier_invoices FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_supplier_invoices" ON supplier_invoices;
CREATE POLICY "anon_update_supplier_invoices" ON supplier_invoices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_supplier_invoices" ON supplier_invoices;
CREATE POLICY "anon_delete_supplier_invoices" ON supplier_invoices FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_service_month ON supplier_invoices(service_month);

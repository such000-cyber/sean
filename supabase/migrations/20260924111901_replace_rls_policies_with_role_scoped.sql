/*
# Replace anon policies with authenticated, role-scoped policies

## Changes per table

### companies
- SELECT: admin sees all; company_user sees only their assigned company
- INSERT/UPDATE/DELETE: admin only

### devices
- SELECT: admin sees all; company_user sees only devices for their company
- INSERT/UPDATE/DELETE: admin only

### clients
- SELECT: admin sees all; company_user sees only clients for their company
- INSERT/UPDATE/DELETE: admin only

### device_clients
- SELECT: admin sees all; company_user sees only links where device belongs to their company
- INSERT/UPDATE/DELETE: admin only

### readings
- SELECT: admin sees all; company_user sees only readings for devices in their company
- INSERT/UPDATE: admin OR company_user (for their company's devices)
- DELETE: admin only

### suppliers & supplier_invoices
- All operations: admin only

## Notes
- All old anon_* policies are dropped first.
- Company users can add/edit readings but cannot modify devices, clients, or companies.
*/

-- ===================== COMPANIES =====================
DROP POLICY IF EXISTS "anon_select_companies" ON companies;
DROP POLICY IF EXISTS "anon_insert_companies" ON companies;
DROP POLICY IF EXISTS "anon_update_companies" ON companies;
DROP POLICY IF EXISTS "anon_delete_companies" ON companies;

CREATE POLICY "select_companies"
ON companies FOR SELECT
TO authenticated
USING (public.is_admin() OR id = public.user_company_id());

CREATE POLICY "insert_companies_admin"
ON companies FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "update_companies_admin"
ON companies FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "delete_companies_admin"
ON companies FOR DELETE
TO authenticated
USING (public.is_admin());

-- ===================== DEVICES =====================
DROP POLICY IF EXISTS "anon_select_devices" ON devices;
DROP POLICY IF EXISTS "anon_insert_devices" ON devices;
DROP POLICY IF EXISTS "anon_update_devices" ON devices;
DROP POLICY IF EXISTS "anon_delete_devices" ON devices;

CREATE POLICY "select_devices"
ON devices FOR SELECT
TO authenticated
USING (public.is_admin() OR company_id = public.user_company_id());

CREATE POLICY "insert_devices_admin"
ON devices FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "update_devices_admin"
ON devices FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "delete_devices_admin"
ON devices FOR DELETE
TO authenticated
USING (public.is_admin());

-- ===================== CLIENTS =====================
DROP POLICY IF EXISTS "anon_select_clients" ON clients;
DROP POLICY IF EXISTS "anon_insert_clients" ON clients;
DROP POLICY IF EXISTS "anon_update_clients" ON clients;
DROP POLICY IF EXISTS "anon_delete_clients" ON clients;

CREATE POLICY "select_clients"
ON clients FOR SELECT
TO authenticated
USING (public.is_admin() OR company_id = public.user_company_id());

CREATE POLICY "insert_clients_admin"
ON clients FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "update_clients_admin"
ON clients FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "delete_clients_admin"
ON clients FOR DELETE
TO authenticated
USING (public.is_admin());

-- ===================== DEVICE_CLIENTS =====================
DROP POLICY IF EXISTS "anon_select_device_clients" ON device_clients;
DROP POLICY IF EXISTS "anon_insert_device_clients" ON device_clients;
DROP POLICY IF EXISTS "anon_update_device_clients" ON device_clients;
DROP POLICY IF EXISTS "anon_delete_device_clients" ON device_clients;

CREATE POLICY "select_device_clients"
ON device_clients FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM devices
    WHERE devices.id = device_clients.device_id
    AND devices.company_id = public.user_company_id()
  )
);

CREATE POLICY "insert_device_clients_admin"
ON device_clients FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "update_device_clients_admin"
ON device_clients FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "delete_device_clients_admin"
ON device_clients FOR DELETE
TO authenticated
USING (public.is_admin());

-- ===================== READINGS =====================
DROP POLICY IF EXISTS "anon_select_readings" ON readings;
DROP POLICY IF EXISTS "anon_insert_readings" ON readings;
DROP POLICY IF EXISTS "anon_update_readings" ON readings;
DROP POLICY IF EXISTS "anon_delete_readings" ON readings;

CREATE POLICY "select_readings"
ON readings FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM devices
    WHERE devices.id = readings.device_id
    AND devices.company_id = public.user_company_id()
  )
);

CREATE POLICY "insert_readings"
ON readings FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM devices
    WHERE devices.id = readings.device_id
    AND devices.company_id = public.user_company_id()
  )
);

CREATE POLICY "update_readings"
ON readings FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM devices
    WHERE devices.id = readings.device_id
    AND devices.company_id = public.user_company_id()
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM devices
    WHERE devices.id = readings.device_id
    AND devices.company_id = public.user_company_id()
  )
);

CREATE POLICY "delete_readings_admin"
ON readings FOR DELETE
TO authenticated
USING (public.is_admin());

-- ===================== SUPPLIERS =====================
DROP POLICY IF EXISTS "anon_select_suppliers" ON suppliers;
DROP POLICY IF EXISTS "anon_insert_suppliers" ON suppliers;
DROP POLICY IF EXISTS "anon_update_suppliers" ON suppliers;
DROP POLICY IF EXISTS "anon_delete_suppliers" ON suppliers;

CREATE POLICY "select_suppliers_admin"
ON suppliers FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "insert_suppliers_admin"
ON suppliers FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "update_suppliers_admin"
ON suppliers FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "delete_suppliers_admin"
ON suppliers FOR DELETE
TO authenticated
USING (public.is_admin());

-- ===================== SUPPLIER_INVOICES =====================
DROP POLICY IF EXISTS "anon_select_supplier_invoices" ON supplier_invoices;
DROP POLICY IF EXISTS "anon_insert_supplier_invoices" ON supplier_invoices;
DROP POLICY IF EXISTS "anon_update_supplier_invoices" ON supplier_invoices;
DROP POLICY IF EXISTS "anon_delete_supplier_invoices" ON supplier_invoices;

CREATE POLICY "select_supplier_invoices_admin"
ON supplier_invoices FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "insert_supplier_invoices_admin"
ON supplier_invoices FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "update_supplier_invoices_admin"
ON supplier_invoices FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "delete_supplier_invoices_admin"
ON supplier_invoices FOR DELETE
TO authenticated
USING (public.is_admin());
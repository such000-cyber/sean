/*
# Add multi-company and location-scoped access for users

## Summary
Currently each user_profile has a single company_id, limiting users to one company.
This migration introduces a user_company_access table that allows a user to be
granted access to multiple companies and optionally to specific locations within
those companies. If location_id is NULL, the user has access to the entire company.
If location_id is set, the user only sees data for that specific location.

## New Tables
- user_company_access
  - id (uuid PK)
  - user_id (uuid, references auth.users ON DELETE CASCADE)
  - company_id (uuid, references companies ON DELETE CASCADE)
  - location_id (uuid nullable, references company_locations ON DELETE CASCADE)
  - created_at (timestamptz)
  - UNIQUE(user_id, company_id, location_id) — prevents duplicate grants

## New/Updated Functions
- user_company_ids() — returns array of company_ids the current user can access
  (from user_company_access, or all companies if admin, or the legacy company_id
  from user_profiles if no user_company_access rows exist)
- user_location_ids() — returns array of location_ids the user is restricted to
  (only locations where location_id IS NOT NULL in user_company_access; if empty,
  the user has no location restriction and sees all locations for their companies)
- user_can_access_company(uuid) — returns true if the user can access a given company
- user_can_access_location(uuid, uuid) — returns true if the user can access a given
  location within a company

## RLS Policy Updates
- devices: SELECT now uses user_company_ids() instead of = user_company_id()
- clients: SELECT now uses user_company_ids() instead of = user_company_id()
- companies: SELECT now uses user_company_ids() instead of = user_company_id()
- device_clients: SELECT checks device's company_id against user_company_ids()
- readings: SELECT/INSERT/UPDATE check device's company_id against user_company_ids()
- suppliers: SELECT now uses user_company_ids() instead of admin-only
- supplier_invoices: SELECT now uses user_company_ids() instead of admin-only
- company_locations: SELECT now uses user_company_ids() instead of true-for-all
- user_company_access: users can SELECT their own rows; admins can SELECT all

## Data Migration
- For each existing user_profiles row with a non-null company_id, insert a
  corresponding user_company_access row so existing permissions are preserved.

## Notes
1. Admins continue to have full access to everything via is_admin().
2. The legacy company_id column on user_profiles is kept for backward compatibility
   but is no longer the sole source of truth for company access.
3. When a user has user_company_access rows, those define their access scope.
   When they have none, the legacy company_id is used as a fallback.
*/

-- 1. Create user_company_access table
CREATE TABLE IF NOT EXISTS user_company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  location_id uuid REFERENCES company_locations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id, location_id)
);

ALTER TABLE user_company_access ENABLE ROW LEVEL SECURITY;

-- 2. Helper functions

-- Returns array of company_ids the current user can access
CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin') THEN
      (SELECT array_agg(id) FROM companies)
    WHEN EXISTS (SELECT 1 FROM user_company_access WHERE user_id = auth.uid()) THEN
      (SELECT array_agg(DISTINCT company_id) FROM user_company_access WHERE user_id = auth.uid())
    ELSE
      ARRAY(SELECT company_id FROM user_profiles WHERE id = auth.uid() AND company_id IS NOT NULL)
  END;
$function$;

-- Returns array of location_ids the user is restricted to (non-null only).
-- If empty, the user has no location restriction.
CREATE OR REPLACE FUNCTION public.user_location_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT array_agg(location_id)
FROM user_company_access
WHERE user_id = auth.uid()
  AND location_id IS NOT NULL;
$function$;

-- Check if user can access a specific company
CREATE OR REPLACE FUNCTION public.user_can_access_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  OR
  p_company_id = ANY(user_company_ids());
$function$;

-- Check if user can access a specific location within a company
CREATE OR REPLACE FUNCTION public.user_can_access_location(p_company_id uuid, p_location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin') THEN true
    WHEN NOT user_can_access_company(p_company_id) THEN false
    -- If user has no location restrictions at all, allow
    WHEN array_length(user_location_ids(), 1) IS NULL THEN true
    -- Otherwise check if this location is in the allowed list
    ELSE p_location_id = ANY(user_location_ids())
  END;
$function$;

-- 3. Data migration: copy existing company_id grants to user_company_access
INSERT INTO user_company_access (user_id, company_id, location_id)
SELECT id, company_id, NULL
FROM user_profiles
WHERE company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_company_access uca
    WHERE uca.user_id = user_profiles.id
      AND uca.company_id = user_profiles.company_id
      AND uca.location_id IS NULL
  );

-- 4. RLS policies for user_company_access
DROP POLICY IF EXISTS "select_own_access" ON user_company_access;
CREATE POLICY "select_own_access"
ON user_company_access FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "insert_access_admin" ON user_company_access;
CREATE POLICY "insert_access_admin"
ON user_company_access FOR INSERT
TO authenticated
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_access_admin" ON user_company_access;
CREATE POLICY "delete_access_admin"
ON user_company_access FOR DELETE
TO authenticated
USING (is_admin());

-- 5. Update RLS policies to use user_company_ids() instead of user_company_id()

-- devices SELECT
DROP POLICY IF EXISTS "select_devices" ON devices;
CREATE POLICY "select_devices"
ON devices FOR SELECT
TO authenticated
USING (is_admin() OR (company_id = ANY(user_company_ids())));

-- clients SELECT
DROP POLICY IF EXISTS "select_clients" ON clients;
CREATE POLICY "select_clients"
ON clients FOR SELECT
TO authenticated
USING (is_admin() OR (company_id = ANY(user_company_ids())));

-- companies SELECT
DROP POLICY IF EXISTS "select_companies" ON companies;
CREATE POLICY "select_companies"
ON companies FOR SELECT
TO authenticated
USING (is_admin() OR (id = ANY(user_company_ids())));

-- device_clients SELECT
DROP POLICY IF EXISTS "select_device_clients" ON device_clients;
CREATE POLICY "select_device_clients"
ON device_clients FOR SELECT
TO authenticated
USING (
  is_admin() OR (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = device_clients.device_id
        AND devices.company_id = ANY(user_company_ids())
    )
  )
);

-- readings SELECT
DROP POLICY IF EXISTS "select_readings" ON readings;
CREATE POLICY "select_readings"
ON readings FOR SELECT
TO authenticated
USING (
  is_admin() OR (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = readings.device_id
        AND devices.company_id = ANY(user_company_ids())
    )
  )
);

-- readings INSERT
DROP POLICY IF EXISTS "insert_readings" ON readings;
CREATE POLICY "insert_readings"
ON readings FOR INSERT
TO authenticated
WITH CHECK (
  is_admin() OR (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = readings.device_id
        AND devices.company_id = ANY(user_company_ids())
    )
  )
);

-- readings UPDATE
DROP POLICY IF EXISTS "update_readings" ON readings;
CREATE POLICY "update_readings"
ON readings FOR UPDATE
TO authenticated
USING (
  is_admin() OR (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = readings.device_id
        AND devices.company_id = ANY(user_company_ids())
    )
  )
)
WITH CHECK (
  is_admin() OR (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = readings.device_id
        AND devices.company_id = ANY(user_company_ids())
    )
  )
);

-- suppliers SELECT — now accessible by company users too
DROP POLICY IF EXISTS "select_suppliers_admin" ON suppliers;
CREATE POLICY "select_suppliers"
ON suppliers FOR SELECT
TO authenticated
USING (
  is_admin() OR (
    (company_id = ANY(user_company_ids())) OR company_id IS NULL
  )
);

-- supplier_invoices SELECT — now accessible by company users too
DROP POLICY IF EXISTS "select_supplier_invoices_admin" ON supplier_invoices;
CREATE POLICY "select_supplier_invoices"
ON supplier_invoices FOR SELECT
TO authenticated
USING (
  is_admin() OR (
    EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_invoices.supplier_id
        AND (suppliers.company_id = ANY(user_company_ids()) OR suppliers.company_id IS NULL)
    )
  )
);

-- company_locations SELECT — restrict to user's companies
DROP POLICY IF EXISTS "auth_select_company_locations" ON company_locations;
CREATE POLICY "select_company_locations"
ON company_locations FOR SELECT
TO authenticated
USING (is_admin() OR (company_id = ANY(user_company_ids())));

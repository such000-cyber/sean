/*
# Create user_profiles table and auth helper functions

## New Tables
- user_profiles: id (uuid PK → auth.users), role (text: 'admin'|'company_user'), company_id (uuid → companies, nullable), full_name (text), created_at

## New Functions
- is_admin(): SECURITY DEFINER, returns boolean if current user is admin
- user_company_id(): SECURITY DEFINER, returns company_id of current user
- current_user_profile(): SECURITY DEFINER, returns the profile row for current user

## Security
- RLS enabled on user_profiles
- SELECT: own profile or admin
- UPDATE: own profile or admin
- INSERT/DELETE: admin only
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'company_user' CHECK (role IN ('admin', 'company_user')),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  full_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper: get the current user's company_id
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Helper: get the current user's full profile
CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS public.user_profiles
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM public.user_profiles WHERE id = auth.uid();
$$;

-- user_profiles policies
DROP POLICY IF EXISTS "select_own_or_all_profile" ON user_profiles;
CREATE POLICY "select_own_or_all_profile"
ON user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "update_own_or_all_profile" ON user_profiles;
CREATE POLICY "update_own_or_all_profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "insert_admin_profile" ON user_profiles;
CREATE POLICY "insert_admin_profile"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_admin_profile" ON user_profiles;
CREATE POLICY "delete_admin_profile"
ON user_profiles FOR DELETE
TO authenticated
USING (public.is_admin());
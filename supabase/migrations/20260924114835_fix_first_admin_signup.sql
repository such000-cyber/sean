-- Allow the very first user to self-register as admin, bypassing RLS.
-- is_admin() checks user_profiles, but the first user has no profile yet,
-- so the RLS insert policy blocks them. This SECURITY DEFINER function
-- inserts the profile directly, but ONLY if no admin exists yet.

CREATE OR REPLACE FUNCTION public.create_first_admin(
  p_user_id uuid,
  p_full_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: only allow if NO admin exists yet
  IF EXISTS (SELECT 1 FROM user_profiles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Вече съществува администратор';
  END IF;

  INSERT INTO user_profiles (id, role, full_name)
  VALUES (p_user_id, 'admin', p_full_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_first_admin(uuid, text) TO authenticated;
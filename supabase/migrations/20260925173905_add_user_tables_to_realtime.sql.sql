/*
# Add user_profiles and user_company_access to realtime

## Changes
- Add `user_profiles` and `user_company_access` to the `supabase_realtime` publication
  so that admin changes to users (create, role change, access grants) propagate
  instantly to all connected admin clients.

## Notes
- These tables already have RLS enabled; only admin users can see all rows.
- Realtime respects RLS, so non-admin users will only receive events for their own rows.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE user_company_access;

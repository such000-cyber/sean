/*
# Add user roles and company-scoped access control

## Summary

This migration adds authentication and role-based access control to the application.
Two roles are supported:
1. **admin** — full access to all data: view, create, edit, delete everything; can create new users (both admin and company users).
2. **company_user** — can only see devices/clients/readings for their assigned company; can only add/edit readings (not devices, clients, or companies).

## New Tables

### user_profiles
- `id` (uuid, primary key, references auth.users) — links to the Supabase auth user
- `role` (text, not null, default 'company_user') — either 'admin' or 'company_user'
- `company_id` (uuid, nullable, references companies) — required for company_user; the company this user is scoped to
- `full_name` (text, nullable) — display name
- `created_at` (timestamptz, default now())

## New Functions

### is_admin()
SECURITY DEFINER function that checks if the current auth user has role 'admin' in user_profiles.
Returns boolean. Used in RLS policies.

### user_company_id()
SECURITY DEFINER function that returns the company_id of the current auth user.
Returns uuid or NULL. Used in RLS policies to scope company_user access.

### current_user_profile()
SECURITY DEFINER function that returns the full profile row for the current auth user.
Used by the frontend to determine role and company.

## Security Changes (RLS Policies)

All existing anon-* policies are DROPPED. New policies are scoped to authenticated users:

### companies
- SELECT: admin sees all; company_user sees only their assigned company
- INSERT/UPDATE/DELETE: admin only

### devices
- SELECT: admin sees all; company_user sees only devices where device.company_id = their company
- INSERT/UPDATE/DELETE: admin only

### clients
- SELECT: admin sees all; company_user sees only clients where client.company_id = their company
- INSERT/UPDATE/DELETE: admin only

### device_clients
- SELECT: admin sees all; company_user sees only links where the device belongs to their company
- INSERT/UPDATE/DELETE: admin only

### readings
- SELECT: admin sees all; company_user sees only readings for devices in their company
- INSERT/UPDATE: admin OR company_user (for devices in their company) — company users can add readings
- DELETE: admin only

### suppliers
- SELECT/INSERT/UPDATE/DELETE: admin only

### supplier_invoices
- SELECT/INSERT/UPDATE/DELETE: admin only

### user_profiles
- SELECT: users can read their own profile; admin can read all
- UPDATE: users can update their own profile (e.g. full_name); admin can update any
- INSERT/DELETE: admin only (handled via edge function for insert)

## Important Notes

1. The app MUST now show a login screen. Unauthenticated users see nothing.
2. The first admin user must be created via the signup form (or manually in Supabase dashboard).
3. Company users are created by the admin via an edge function (admin-auth endpoint).
4. Company users can ONLY add/edit readings — they cannot create devices, clients, companies, or suppliers.
5. Company users only see data for their assigned company.
*/
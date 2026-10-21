/*
# Add sort_order column to devices

1. Changes
- Adds `sort_order` (integer, default 0) to `devices` table.
- Used for manual ordering of devices within a company in the consumption report.
- Existing devices get sort_order = 0 (will be set by the app when reordering).
2. Security
- No RLS changes. Existing policies remain in place.
*/

ALTER TABLE devices ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

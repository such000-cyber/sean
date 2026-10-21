/*
# Add is_base column to devices

1. Modified Tables
- `devices`: adds `is_base` boolean column (default false).
  When true, the device is priced with a manually-set unit price
  instead of being priced from supplier invoices.
  Example: "Вода база" is a base device with a fixed price per m³,
  while regular water meters are priced from supplier invoices.

2. Security
- No changes to RLS policies. The column is editable by the same
  roles that can already edit devices.
*/

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

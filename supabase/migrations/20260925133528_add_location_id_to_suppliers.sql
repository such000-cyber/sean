/*
# Add location_id to suppliers

1. Changes
- Add `location_id` column (uuid, nullable) to `suppliers` table.
- Foreign key to `company_locations(id)` with ON DELETE SET NULL.
- This lets suppliers be associated with a specific company location (e.g. Видин).
2. Data update
- Set all suppliers belonging to "Виена Реал Естейт ЕАД" (company_id = 52ed2e37-...)
  to the "Видин" location (id = a3b3b06c-...).
3. Security
- No RLS policy changes needed; existing supplier policies already cover the new column.
*/

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES company_locations(id) ON DELETE SET NULL;

UPDATE suppliers
SET location_id = 'a3b3b06c-c0b8-43f5-8f52-bd3c9e6cfc0c'
WHERE company_id = '52ed2e37-1ecc-4026-94d6-17f52ee5fb36'
  AND location_id IS NULL;

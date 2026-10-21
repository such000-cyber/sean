/*
# Add company_id to suppliers

1. Modified Tables
- `suppliers` — add `company_id` column (uuid, nullable, references companies(id))
  This links each supplier to a specific company so that supplier invoice prices
  are calculated per-company in the consumption report.
  Existing suppliers get company_id = NULL (works for all companies).

2. Security
- No policy changes needed — RLS already allows anon/authenticated full CRUD.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

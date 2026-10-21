/*
# Add device_dependencies junction table for multi-device subtraction

## Purpose
Currently devices have a single `depends_on_device_id` column that allows
subtracting one device's reading from another. The user needs to subtract
readings from MULTIPLE devices (e.g. a main meter minus several sub-meters)
and distribute the remainder percentage-wise across clients.

## Changes

### 1. New Table: `device_dependencies`
- `id` (uuid, primary key)
- `device_id` (uuid, references devices.id ON DELETE CASCADE) — the device whose reading is computed by subtraction
- `depends_on_device_id` (uuid, references devices.id ON DELETE CASCADE) — a source device whose reading is subtracted
- `sort_order` (int, default 0) — ordering for display
- `created_at` (timestamptz, default now())
- Unique constraint on (device_id, depends_on_device_id) to prevent duplicates

### 2. Security
- Enable RLS on `device_dependencies`
- Reuses the same helper functions (is_admin(), user_company_ids()) as the devices table

### 3. Realtime
- Add `device_dependencies` to the realtime publication

### 4. Data migration
- Copy existing `depends_on_device_id` values from `devices` into the new junction table

### 5. Notes
- The `devices.depends_on_device_id` column is kept for backward compatibility.
*/

-- 1. Create junction table
CREATE TABLE IF NOT EXISTS device_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  depends_on_device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(device_id, depends_on_device_id)
);

-- 2. Enable RLS
ALTER TABLE device_dependencies ENABLE ROW LEVEL SECURITY;

-- 3. Policies matching existing devices table pattern
DROP POLICY IF EXISTS "select_device_dependencies" ON device_dependencies;
CREATE POLICY "select_device_dependencies"
ON device_dependencies FOR SELECT
TO authenticated
USING (
  is_admin()
  OR (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = device_dependencies.device_id
      AND d.company_id = ANY (user_company_ids())
    )
  )
);

DROP POLICY IF EXISTS "insert_device_dependencies" ON device_dependencies;
CREATE POLICY "insert_device_dependencies"
ON device_dependencies FOR INSERT
TO authenticated
WITH CHECK (
  is_admin()
  OR (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = device_dependencies.device_id
      AND d.company_id = ANY (user_company_ids())
    )
  )
);

DROP POLICY IF EXISTS "update_device_dependencies" ON device_dependencies;
CREATE POLICY "update_device_dependencies"
ON device_dependencies FOR UPDATE
TO authenticated
USING (
  is_admin()
  OR (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = device_dependencies.device_id
      AND d.company_id = ANY (user_company_ids())
    )
  )
)
WITH CHECK (
  is_admin()
  OR (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = device_dependencies.device_id
      AND d.company_id = ANY (user_company_ids())
    )
  )
);

DROP POLICY IF EXISTS "delete_device_dependencies" ON device_dependencies;
CREATE POLICY "delete_device_dependencies"
ON device_dependencies FOR DELETE
TO authenticated
USING (
  is_admin()
  OR (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = device_dependencies.device_id
      AND d.company_id = ANY (user_company_ids())
    )
  )
);

-- 4. Migrate existing single depends_on_device_id values
INSERT INTO device_dependencies (device_id, depends_on_device_id)
SELECT id, depends_on_device_id FROM devices
WHERE depends_on_device_id IS NOT NULL
ON CONFLICT (device_id, depends_on_device_id) DO NOTHING;

-- 5. Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE device_dependencies;

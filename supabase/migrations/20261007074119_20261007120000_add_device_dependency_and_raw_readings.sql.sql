/*
# Add device dependency (auto-calculated readings) and raw_value to readings

## Purpose
Some devices' readings are automatically calculated as the difference between
a "raw" meter value and a sub-meter value. For example, in "Индустриален Парк
Драгоман ЕООД", the "Главен Водомер" reading = (raw Главен Водомер value) −
(Водомер WSBG value). This migration adds the schema to support that.

## Changes

### 1. New column: devices.depends_on_device_id
- `depends_on_device_id` (uuid, nullable, references devices.id ON DELETE SET NULL)
- When set, this device's reading is auto-calculated as:
  raw_value (entered for this device) − value of the depended-on device
  for the same reading_date.
- If the depended-on device has no reading for that date yet, the dependent
  device's value is stored as just the raw_value (no subtraction).

### 2. New column: readings.raw_value
- `raw_value` (numeric, nullable)
- Stores the original meter reading entered by the user before subtraction.
- For non-dependent devices, raw_value = value (or null if not set).
- For dependent devices, value = raw_value − depended_device.value,
  and raw_value holds what the user actually entered.

### 3. Link existing devices
- Set "Главен Водомер" (in Индустриален Парк Драгоман ЕООД) to depend on
  "Водомер" with number "WSBG" in the same company.

## Security
- No RLS policy changes. Existing policies still apply.
- No new tables.
*/

-- 1. Add depends_on_device_id to devices
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS depends_on_device_id uuid REFERENCES devices(id) ON DELETE SET NULL;

-- 2. Add raw_value to readings
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS raw_value numeric(14,3);

-- 3. Link Главен Водомер → Водомер WSBG in Индустриален Парк Драгоман ЕООД
UPDATE devices
SET depends_on_device_id = (
  SELECT sub.id FROM devices sub
  WHERE sub.company_id = devices.company_id
    AND sub.number = 'WSBG'
    AND sub.name = 'Водомер'
  LIMIT 1
)
WHERE name = 'Главен Водомер'
  AND company_id = '2842e653-c555-4e33-ba40-81daf29373cb';

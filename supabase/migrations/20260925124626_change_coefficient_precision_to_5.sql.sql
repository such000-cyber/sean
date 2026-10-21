ALTER TABLE devices
  ALTER COLUMN coefficient TYPE numeric(10,5) USING coefficient::numeric(10,5);
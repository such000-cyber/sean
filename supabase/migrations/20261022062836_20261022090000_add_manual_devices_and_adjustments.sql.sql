/*
# Ръчни уреди и месечни корекции

## devices.is_manual
- `is_manual` (boolean, default false)
- Уред без брояч (напр. „Чилър“, „Сървър МСК“, „Евротранспорт 630 kWh“).
  Месечното показание на такъв уред Е потреблението за месеца
  (не се вади предишно показание и не се умножава по коефициент).

## readings.adjustment
- `adjustment` (numeric, default 0)
- Корекция към потреблението на уреда за конкретния месец (+/−),
  добавя се след коефициента. Пример: −427 kWh за сграда 33, +800 kWh за Адмирал.

## Сигурност
- Без промени в RLS; важат съществуващите правила за devices и readings.
*/

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;

ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS adjustment numeric(14,3) NOT NULL DEFAULT 0;

/*
# Ценови групи (абонати / видове услуга)

Позволява няколко различни цени за една и съща услуга в една локация,
напр. три абоната за ток с отделни фактури или питейна и промишлена вода.

## devices.price_group
- `price_group` (text, nullable) – напр. „Аб. 95308012“, „Промишлена вода“.

## supplier_invoices.price_group
- `price_group` (text, nullable) – същото име като на уредите.

Уред с група се оценява по фактурите със същата група (фирма + локация + услуга + група).
Ако за групата няма фактура за месеца, се ползват фактурите без група, както досега.

## Сигурност
- Без промени в RLS.
*/

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS price_group text;

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS price_group text;

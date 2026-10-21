import type { Device, Reading, DeviceDependency } from './supabase';

/**
 * Изчисляване на консумацията по същата логика като в месечните Excel справки:
 *
 *   бруто(уред)  = (текущо показание − предишно показание) × коефициент на уреда
 *   нето(уред)   = бруто(уред) − Σ бруто(подуред)   за всички уреди, които той изважда
 *
 * Нетото се разпределя по клиентите на уреда в проценти.
 *
 * Важно: изваждат се КОНСУМАЦИИ (с коефициента на всеки подуред), а не показания.
 * Показанията в базата винаги се пазят такива, каквито са въведени
 * (raw_value). За стари записи, при които `value` е било „показание − подуреди“,
 * се използва raw_value.
 */

/** Показанието, което е въведено от потребителя (без изваждане). */
export function rawReadingValue(r: Pick<Reading, 'value' | 'raw_value'>): number {
  return r.raw_value !== null && r.raw_value !== undefined ? Number(r.raw_value) : Number(r.value);
}

export interface ReadingIndex {
  /** readings на уред, сортирани по дата възходящо */
  byDevice: Map<string, Reading[]>;
}

export function buildReadingIndex(readings: Reading[]): ReadingIndex {
  const byDevice = new Map<string, Reading[]>();
  for (const r of readings) {
    const list = byDevice.get(r.device_id);
    if (list) list.push(r);
    else byDevice.set(r.device_id, [r]);
  }
  for (const list of byDevice.values()) list.sort((a, b) => a.reading_date.localeCompare(b.reading_date));
  return { byDevice };
}

export interface GrossConsumption {
  current: Reading;
  previous: Reading;
  /** разлика в показанията, без коефициент */
  delta: number;
  /** разлика × коефициент */
  consumption: number;
}

/** Бруто консумация на уред за месец (reading_date = YYYY-MM-01). null ако липсва текущо или предишно показание. */
export function grossConsumption(device: Device, monthDate: string, index: ReadingIndex): GrossConsumption | null {
  const list = index.byDevice.get(device.id);
  if (!list) return null;
  const current = list.find((r) => r.reading_date === monthDate);
  if (!current) return null;
  let previous: Reading | null = null;
  for (const r of list) {
    if (r.reading_date < monthDate) previous = r;
    else break;
  }
  if (!previous) return null;
  const delta = rawReadingValue(current) - rawReadingValue(previous);
  const coef = Number(device.coefficient ?? 1);
  return { current, previous, delta, consumption: round3(delta * coef) };
}

export interface NetConsumption {
  device: Device;
  /** бруто консумация на самия уред (с коефициент) */
  gross: number;
  /** сума на бруто консумациите на изважданите подуреди */
  subtracted: number;
  /** gross − subtracted; това се разпределя по клиентите */
  net: number;
  /** подуреди без показание за месеца (третирани като 0) */
  missingSubDevices: Device[];
}

/**
 * Нето консумация за всички уреди за даден месец.
 * Връща Map deviceId → NetConsumption (само за уреди с изчислима бруто консумация).
 */
export function computeNetConsumptions(
  devices: Device[],
  readings: Reading[],
  dependencies: DeviceDependency[],
  monthDate: string,
): Map<string, NetConsumption> {
  const index = buildReadingIndex(readings);
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const grossById = new Map<string, number>();
  for (const d of devices) {
    const g = grossConsumption(d, monthDate, index);
    if (g) grossById.set(d.id, g.consumption);
  }

  const subsByDevice = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (dep.device_id === dep.depends_on_device_id) continue;
    const list = subsByDevice.get(dep.device_id);
    if (list) list.push(dep.depends_on_device_id);
    else subsByDevice.set(dep.device_id, [dep.depends_on_device_id]);
  }

  const result = new Map<string, NetConsumption>();
  for (const d of devices) {
    const gross = grossById.get(d.id);
    if (gross === undefined) continue;
    let subtracted = 0;
    const missing: Device[] = [];
    for (const subId of subsByDevice.get(d.id) ?? []) {
      const sub = deviceById.get(subId);
      if (!sub) continue;
      const subGross = grossById.get(subId);
      if (subGross === undefined) missing.push(sub);
      else subtracted += subGross;
    }
    result.set(d.id, {
      device: d,
      gross,
      subtracted: round3(subtracted),
      net: round3(gross - subtracted),
      missingSubDevices: missing,
    });
  }
  return result;
}

export function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

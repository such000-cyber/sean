import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Device, Reading, Company, Client, DeviceClientWithClient, DeviceDependency, CompanyLocation } from '@/lib/supabase';
import { Icon } from './Icon';

interface MonthlyEntryProps {
  devices: Device[];
  readings: Reading[];
  companies: Company[];
  clients: Client[];
  deviceClients: DeviceClientWithClient[];
  deviceDependencies: DeviceDependency[];
  locations: CompanyLocation[];
  onSave: (deviceId: string, readingDate: string, value: number, note: string | null, existingId?: string) => Promise<void>;
  onBack: () => void;
}

const MONTH_NAMES_BG = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
];

function formatValue(v: number): string {
  return v.toLocaleString('bg-BG', { maximumFractionDigits: 3 });
}

interface RowData {
  value: string;
  note: string;
  existingReadingId: string | null;
  previousValue: number | null;
  previousDate: string | null;
  saved: boolean;
  dirty: boolean;
}

export function MonthlyEntry({ devices, readings, companies, clients, deviceClients, deviceDependencies, locations, onSave, onBack }: MonthlyEntryProps) {
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [month, setMonth] = useState(currentMonthStr);
  const [rows, setRows] = useState<Record<string, RowData>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [filterLocation, setFilterLocation] = useState<string>('');

  // Initialize / refresh row data when month or readings change
  useEffect(() => {
    const monthDate = `${month}-01`;
    const newRows: Record<string, RowData> = {};

    for (const device of devices) {
      const deviceReadings = readings
        .filter((r) => r.device_id === device.id)
        .sort((a, b) => a.reading_date.localeCompare(b.reading_date));

      const existing = deviceReadings.find((r) => r.reading_date === monthDate);
      const prev = deviceReadings
        .filter((r) => r.reading_date < monthDate)
        .pop() ?? null;

      const prevKey = `${device.id}-${prev?.id ?? 'none'}`;
      const currentRow = rows[device.id];

      // For dependent devices, show raw_value as previous; for normal devices, show value
      const prevDisplayValue = prev
        ? (prev.raw_value !== null && prev.raw_value !== undefined ? prev.raw_value : prev.value)
        : null;

      // Preserve user edits if the underlying data hasn't changed
      if (currentRow && currentRow.previousValue === prevDisplayValue && currentRow.existingReadingId === (existing?.id ?? null)) {
        newRows[device.id] = currentRow;
      } else {
        const displayValue = existing?.raw_value !== null && existing?.raw_value !== undefined
          ? String(existing.raw_value)
          : existing ? String(existing.value) : '';
        newRows[device.id] = {
          value: displayValue,
          note: existing?.note ?? '',
          existingReadingId: existing?.id ?? null,
          previousValue: prevDisplayValue,
          previousDate: prev?.reading_date ?? null,
          saved: !!existing,
          dirty: false,
        };
      }
    }

    setRows(newRows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, readings, devices]);

  // Clients available for the selected company
  const availableClients = useMemo(() => {
    if (!filterCompany) return clients;
    return clients.filter((c) => c.company_id === filterCompany);
  }, [clients, filterCompany]);

  const filteredDevices = useMemo(() => {
    let result = devices;
    if (filterCompany) {
      result = result.filter((d) => d.company_id === filterCompany);
    }
    if (filterLocation) {
      result = result.filter((d) => d.location_id === filterLocation);
    }
    if (filterClient) {
      const deviceIdsForClient = new Set(deviceClients.filter((dc) => dc.client_id === filterClient).map((dc) => dc.device_id));
      result = result.filter((d) => deviceIdsForClient.has(d.id));
    }
    return [...result].sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [devices, filterCompany, filterLocation, filterClient, deviceClients]);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusRef = useRef<string | null>(null);

  // After rows are rebuilt by the effect, focus the pending input
  useEffect(() => {
    if (pendingFocusRef.current) {
      const id = pendingFocusRef.current;
      pendingFocusRef.current = null;
      requestAnimationFrame(() => {
        const el = inputRefs.current[id];
        if (el && !el.readOnly) {
          el.focus();
          el.select();
        }
      });
    }
  }, [rows]);

  const focusNextInput = useCallback((currentDeviceId: string) => {
    const idx = filteredDevices.findIndex((d) => d.id === currentDeviceId);
    if (idx < 0) return;
    for (let i = idx + 1; i < filteredDevices.length; i++) {
      const nextId = filteredDevices[i].id;
      const el = inputRefs.current[nextId];
      if (el && !el.readOnly) {
        pendingFocusRef.current = nextId;
        return;
      }
    }
  }, [filteredDevices]);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-');
    return `${MONTH_NAMES_BG[parseInt(m) - 1]} ${y}`;
  }, [month]);

  const handleRowChange = (deviceId: string, field: 'value' | 'note', val: string) => {
    setRows((prev) => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], [field]: val, dirty: true, saved: false },
    }));
  };

  const handleSaveRow = async (deviceId: string) => {
    const row = rows[deviceId];
    if (!row) return;

    const numValue = parseFloat(row.value.replace(',', '.'));
    if (isNaN(numValue)) {
      setGlobalError('Моля, въведете валидно число за всички полета');
      return;
    }
    if (numValue < 0) {
      setGlobalError('Стойността не може да бъде отрицателна');
      return;
    }

    setSaving((prev) => ({ ...prev, [deviceId]: true }));
    setGlobalError(null);
    try {
      await onSave(deviceId, `${month}-01`, numValue, row.note.trim() || null, row.existingReadingId ?? undefined);
      setRows((prev) => ({
        ...prev,
        [deviceId]: { ...prev[deviceId], saved: true, dirty: false, existingReadingId: prev[deviceId].existingReadingId ?? 'new' },
      }));
      setSavedFlash(deviceId);
      setTimeout(() => setSavedFlash((cur) => (cur === deviceId ? null : cur)), 2500);
      // focusNextInput sets pendingFocusRef; the rows-effect will apply it after re-render
      focusNextInput(deviceId);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Грешка при запазване');
    } finally {
      setSaving((prev) => ({ ...prev, [deviceId]: false }));
    }
  };

  const handleSaveAll = async () => {
    const dirtyIds = Object.keys(rows).filter((id) => rows[id].dirty && rows[id].value.trim());
    if (dirtyIds.length === 0) {
      setGlobalError('Няма промени за запазване');
      return;
    }
    for (const id of dirtyIds) {
      await handleSaveRow(id);
    }
  };

  const dirtyCount = Object.values(rows).filter((r) => r.dirty && r.value.trim()).length;
  const filledCount = Object.values(rows).filter((r) => r.value.trim()).length;

  const getDeviceClients = (deviceId: string) => deviceClients.filter((dc) => dc.device_id === deviceId);

  const companyName = (companyId: string | null) => {
    if (!companyId) return null;
    return companies.find((c) => c.id === companyId)?.name ?? null;
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Top bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          <Icon name="ArrowLeft" size={18} />
          Обратно
        </button>

        <div className="flex flex-wrap items-end gap-3">
          {companies.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Фирма</label>
              <select
                value={filterCompany}
                onChange={(e) => { setFilterCompany(e.target.value); setFilterClient(''); setFilterLocation(''); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="">Всички фирми</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {(() => {
            const availableLocations = locations.filter((l) => !filterCompany || l.company_id === filterCompany);
            if (availableLocations.length === 0) return null;
            return (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Локация</label>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">Всички локации</option>
                  {availableLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            );
          })()}
          {availableClients.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Клиент</label>
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="">Всички клиенти</option>
                {availableClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Месец</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Въвеждане на показания</h2>
        <p className="mt-1 text-sm text-slate-500">
          {monthLabel} · {filteredDevices.length} уреда · {filledCount} въведени
          {dirtyCount > 0 && <span className="text-amber-600"> · {dirtyCount} незапазени</span>}
          {month < currentMonthStr && <span className="text-slate-400"> · само за преглед</span>}
        </p>
      </div>

      {globalError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <Icon name="AlertCircle" size={16} />
          {globalError}
          <button onClick={() => setGlobalError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {filteredDevices.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Icon name="Calendar" size={22} className="text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">
            {devices.length === 0
              ? 'Няма регистрирани уреди. Добавете уреди първо.'
              : filterClient
              ? 'Няма уреди за избрания клиент'
              : 'Няма уреди за избраната фирма'}
          </p>
        </div>
      ) : (
        <>
          {/* Entry table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Уред</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Предишно</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Текущо *</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Потребление</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-500">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredDevices.map((device) => {
                    const row = rows[device.id];
                    if (!row) return null;

                    const numValue = parseFloat(row.value.replace(',', '.')) || 0;
                    const depIds = deviceDependencies.filter((d) => d.device_id === device.id).map((d) => d.depends_on_device_id);
                    const depDevices = depIds.map((id) => devices.find((d) => d.id === id)).filter((d): d is Device => !!d);
                    const depSum = depIds.reduce((sum, depId) => {
                      const depReading = readings.find((r) => r.device_id === depId && r.reading_date === `${month}-01`);
                      return sum + (depReading?.value ?? 0);
                    }, 0);
                    const computedValue = depIds.length > 0 && row.value.trim()
                      ? Math.round((numValue - depSum) * 1000) / 1000
                      : null;
                    const prevDepSum = depIds.length > 0 && row.previousValue !== null
                      ? (() => {
                          let sum = 0;
                          for (const depId of depIds) {
                            const prevDepReading = readings.find((r) => r.device_id === depId && r.reading_date === row.previousDate);
                            if (prevDepReading) sum += prevDepReading.value;
                          }
                          return sum;
                        })()
                      : null;
                    const consumption = depIds.length > 0
                      ? (computedValue !== null && prevDepSum !== null ? Math.round((computedValue - (row.previousValue! - prevDepSum)) * 1000) / 1000 : null)
                      : (row.previousValue !== null && row.value.trim() ? numValue - row.previousValue : null);
                    const coefConsumption = consumption !== null ? consumption * device.coefficient : null;
                    const dcs = getDeviceClients(device.id);
                    const compName = companyName(device.company_id);
                    const isSaving = saving[device.id];
                    const justSaved = savedFlash === device.id;
                    const isPastMonth = month < currentMonthStr;

                    const iconForType = device.type === 'electricity' ? 'Zap' : device.type === 'water' ? 'Droplets' : device.type === 'gas' ? 'Flame' : device.type === 'heat' ? 'Thermometer' : 'Gauge';

                    return (
                      <>
                        <tr key={device.id} className={`transition-colors ${row.dirty ? 'bg-amber-50/30' : ''} ${justSaved ? 'bg-emerald-50/40' : ''} hover:bg-slate-50/50`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: device.color }} />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-700">{device.name}</p>
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                  <Icon name={iconForType} size={11} />
                                  <span>{device.unit}</span>
                                  {device.coefficient !== 1 && <span>· коеф. {device.coefficient}</span>}
                                  {compName && <span className="truncate">· {compName}</span>}
                                  {depDevices.length > 0 && (
                                    <span className="truncate text-sky-500">· − {depDevices.map((d) => d.name).join(', ')}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {row.previousValue !== null ? (
                              <span>{formatValue(row.previousValue)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              ref={(el) => { inputRefs.current[device.id] = el; }}
                              type="text"
                              inputMode="decimal"
                              value={row.value}
                              onChange={(e) => handleRowChange(device.id, 'value', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (row.dirty && row.value.trim()) {
                                    handleSaveRow(device.id);
                                  } else {
                                    focusNextInput(device.id);
                                  }
                                }
                              }}
                              placeholder="—"
                              readOnly={isPastMonth}
                              className={`w-28 rounded-lg border px-3 py-1.5 text-right text-sm transition-colors focus:outline-none focus:ring-2 ${
                                isPastMonth
                                  ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                                  : row.dirty
                                  ? 'border-amber-300 bg-amber-50/50 text-slate-900 focus:border-amber-400 focus:ring-amber-100'
                                  : 'border-slate-200 text-slate-900 focus:border-sky-400 focus:ring-sky-100'
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {consumption !== null ? (
                              <div>
                                <span className={`font-semibold ${consumption > 0 ? 'text-amber-600' : consumption < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                  {consumption > 0 ? '+' : ''}{formatValue(consumption)}
                                </span>
                                {device.coefficient !== 1 && coefConsumption !== null && (
                                  <span className="block text-xs text-slate-400">
                                    с коеф.: {formatValue(coefConsumption)}
                                  </span>
                                )}
                                {computedValue !== null && (
                                  <span className="block text-xs text-sky-500">
                                    изчислено: {formatValue(computedValue)}
                                  </span>
                                )}
                              </div>
                            ) : computedValue !== null ? (
                              <span className="text-xs text-sky-500">= {formatValue(computedValue)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center">
                              {isSaving ? (
                                <span className="text-xs text-slate-400">Запазване...</span>
                              ) : justSaved ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                  <Icon name="Check" size={13} />
                                  Запазено
                                </span>
                              ) : row.dirty ? (
                                <button
                                  onClick={() => handleSaveRow(device.id)}
                                  className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white transition-all hover:bg-sky-700"
                                >
                                  Запази
                                </button>
                              ) : row.existingReadingId ? (
                                <span className="text-xs text-slate-400">Въведено</span>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Client allocation breakdown row */}
                        {dcs.length > 0 && consumption !== null && (
                          <tr key={`${device.id}-clients`} className="bg-slate-50/30">
                            <td colSpan={5} className="px-4 py-2.5">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-5">
                                <span className="text-xs font-medium text-slate-400">Разпределение:</span>
                                {dcs.map((dc) => {
                                  const share = consumption * (dc.percentage / 100) * device.coefficient;
                                  return (
                                    <span key={dc.id} className="text-xs text-slate-600">
                                      {dc.client.name}: <span className="font-medium text-slate-700">{formatValue(share)} {device.unit}</span>
                                      <span className="text-slate-400"> ({formatValue(dc.percentage)}%)</span>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Save all bar */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
            <div className="text-sm text-slate-500">
              {dirtyCount > 0 ? (
                <span className="text-amber-600">{dirtyCount} незапазени промени</span>
              ) : (
                <span className="text-emerald-600">Всички промени са запазени</span>
              )}
            </div>
            <button
              onClick={handleSaveAll}
              disabled={dirtyCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="Save" size={16} />
              Запази всички
            </button>
          </div>
        </>
      )}
    </div>
  );
}

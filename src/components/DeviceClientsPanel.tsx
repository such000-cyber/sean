import { useState } from 'react';
import type { Client, DeviceClientWithClient } from '@/lib/supabase';
import { Icon } from './Icon';

interface DeviceClientsPanelProps {
  deviceClients: DeviceClientWithClient[];
  availableClients: Client[];
  deviceId: string;
  deviceColor: string;
  deviceUnit: string;
  onAddClient: (clientId: string, percentage: number) => Promise<void>;
  onUpdatePercentage: (deviceClientId: string, percentage: number) => Promise<void>;
  onRemoveClient: (deviceClientId: string) => Promise<void>;
}

function formatValue(v: number): string {
  return v.toLocaleString('bg-BG', { maximumFractionDigits: 2 });
}

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function DeviceClientsPanel({
  deviceClients,
  availableClients,
  deviceColor,
  onAddClient,
  onUpdatePercentage,
  onRemoveClient,
}: DeviceClientsPanelProps) {
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [addPercentage, setAddPercentage] = useState('100');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPercentage, setEditPercentage] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPercentage = deviceClients.reduce((sum, dc) => sum + dc.percentage, 0);
  const unlinkedClients = availableClients.filter(
    (c) => !deviceClients.some((dc) => dc.client_id === c.id)
  );

  const handleAdd = async () => {
    if (!selectedClientId) {
      setError('Моля, изберете клиент');
      return;
    }
    const pct = parseFloat(addPercentage.replace(',', '.'));
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setError('Процентът трябва да бъде между 0 и 100');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAddClient(selectedClientId, pct);
      setShowAddPicker(false);
      setSelectedClientId('');
      setAddPercentage('100');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePercentage = async (deviceClientId: string) => {
    const pct = parseFloat(editPercentage.replace(',', '.'));
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setError('Процентът трябва да бъде между 0 и 100');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdatePercentage(deviceClientId, pct);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${deviceColor}15` }}>
            <Icon name="Users" size={15} className="" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">
            Клиенти на уреда ({deviceClients.length})
          </h3>
        </div>
        {unlinkedClients.length > 0 && !showAddPicker && (
          <button
            onClick={() => setShowAddPicker(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
          >
            <Icon name="UserPlus" size={15} />
            Присъедини клиент
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <Icon name="AlertCircle" size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {/* Add picker */}
      {showAddPicker && (
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Клиент</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="">— Изберете клиент —</option>
                {unlinkedClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.identifier ? ` (${c.identifier})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-28">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Процент %</label>
              <input
                type="text"
                inputMode="decimal"
                value={addPercentage}
                onChange={(e) => setAddPercentage(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddPicker(false); setSelectedClientId(''); setError(null); }}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Отказ
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                <Icon name="Plus" size={15} />
                Добави
              </button>
            </div>
          </div>
        </div>
      )}

      {deviceClients.length === 0 && !showAddPicker ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Icon name="Users" size={22} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Няма присъединени клиенти</p>
          <p className="mt-1 text-sm text-slate-400">
            Присъединете клиенти към този уред и разпределете потреблението процентно
          </p>
          {availableClients.length > 0 && (
            <button
              onClick={() => setShowAddPicker(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
            >
              <Icon name="UserPlus" size={16} />
              Присъедини клиент
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Pie chart visualization */}
          {deviceClients.length >= 2 && (
            <div className="flex items-center gap-6 border-b border-slate-100 px-6 py-5">
              <AllocationPie
                slices={deviceClients.map((dc, i) => ({
                  percentage: dc.percentage,
                  color: PIE_COLORS[i % PIE_COLORS.length],
                  label: dc.client.name,
                }))}
              />
              <div className="flex-1 space-y-2">
                {deviceClients.map((dc, i) => (
                  <div key={dc.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="flex-1 truncate text-slate-700">{dc.client.name}</span>
                    <span className="font-semibold text-slate-900">{formatValue(dc.percentage)}%</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 border-t border-slate-100 pt-2 text-sm">
                  <span className="h-3 w-3 rounded-full bg-slate-300" />
                  <span className="flex-1 font-medium text-slate-500">Общо</span>
                  <span className={`font-bold ${totalPercentage === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatValue(totalPercentage)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Client list with percentage editing */}
          <div className="divide-y divide-slate-50">
            {deviceClients.map((dc, i) => (
              <div key={dc.id} className="flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-slate-50/50">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: deviceClients.length >= 2 ? PIE_COLORS[i % PIE_COLORS.length] : deviceColor }}
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{dc.client.name}</p>
                  {dc.client.identifier && (
                    <p className="truncate text-xs text-slate-400">{dc.client.identifier}</p>
                  )}
                </div>

                {editingId === dc.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editPercentage}
                      onChange={(e) => setEditPercentage(e.target.value)}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdatePercentage(dc.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <span className="text-xs text-slate-400">%</span>
                    <button
                      onClick={() => handleUpdatePercentage(dc.id)}
                      disabled={saving}
                      className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50"
                    >
                      <Icon name="Check" size={15} />
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setError(null); }}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100"
                    >
                      <Icon name="X" size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-900">{formatValue(dc.percentage)}%</span>
                      {deviceClients.length < 2 && (
                        <span className="text-xs text-slate-400">(100%)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(dc.id); setEditPercentage(String(dc.percentage)); }}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                        aria-label="Промени процент"
                      >
                        <Icon name="Edit3" size={14} />
                      </button>
                      {confirmRemoveId === dc.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { onRemoveClient(dc.id); setConfirmRemoveId(null); }}
                            className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100"
                          >
                            Потвърди
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            className="rounded-md px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                          >
                            Отказ
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemoveId(dc.id)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label="Премахни клиент"
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Total indicator */}
          {deviceClients.length >= 2 && (
            <div className="border-t border-slate-100 px-6 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-500">Общо разпределение</span>
                <span className={`font-bold ${totalPercentage === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {formatValue(totalPercentage)}%
                  {totalPercentage !== 100 && (
                    <span className="ml-1.5 text-xs font-normal text-amber-500">
                      {totalPercentage < 100 ? 'недостиг' : 'излишък'}
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AllocationPie({ slices }: { slices: { percentage: number; color: string; label: string }[] }) {
  const size = 80;
  const radius = size / 2 - 4;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const total = slices.reduce((sum, s) => sum + s.percentage, 0) || 1;

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={8} />
      {slices.map((slice, i) => {
        const dash = (slice.percentage / total) * circumference;
        const el = (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={8}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${center} ${center})`}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

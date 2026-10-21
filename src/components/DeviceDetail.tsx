import { useMemo, useState, useEffect } from 'react';
import type { Device, ReadingWithDelta, Client, DeviceClientWithClient } from '@/lib/supabase';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';
import { DeviceTypeBadge } from './DeviceTypeBadge';
import { DeviceClientsPanel } from './DeviceClientsPanel';

interface DeviceDetailProps {
  device: Device;
  readings: ReadingWithDelta[];
  deviceClients: DeviceClientWithClient[];
  availableClients: Client[];
  isAdmin?: boolean;
  currentMonth?: string;
  onBack: () => void;
  onAddReading: () => void;
  onEditReading: (reading: ReadingWithDelta) => void;
  onDeleteReading?: (reading: ReadingWithDelta) => void;
  onEditDevice?: () => void;
  onAddClient?: (clientId: string, percentage: number) => Promise<void>;
  onUpdateClientPercentage?: (deviceClientId: string, percentage: number) => Promise<void>;
  onRemoveClient?: (deviceClientId: string) => Promise<void>;
}

const MONTH_NAMES_BG_SHORT = [
  'Ян', 'Фев', 'Мар', 'Апр', 'Май', 'Юни',
  'Юли', 'Авг', 'Сеп', 'Окт', 'Ное', 'Дек',
];

const MONTH_NAMES_BG = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
];

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTH_NAMES_BG[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMonthShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTH_NAMES_BG_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function formatValue(v: number): string {
  return v.toLocaleString('bg-BG', { maximumFractionDigits: 3 });
}

export function DeviceDetail({
  device,
  readings,
  deviceClients,
  availableClients,
  isAdmin = false,
  currentMonth = '',
  onBack,
  onAddReading,
  onEditReading,
  onDeleteReading,
  onEditDevice,
  onAddClient,
  onUpdateClientPercentage,
  onRemoveClient,
}: DeviceDetailProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const sortedReadings = useMemo(
    () => [...readings].sort((a, b) => b.reading_date.localeCompare(a.reading_date)),
    [readings]
  );

  const chartData = useMemo(
    () => [...sortedReadings].reverse().slice(-24),
    [sortedReadings]
  );

  const stats = useMemo(() => {
    if (sortedReadings.length === 0) {
      return { avg: null, min: null, max: null, totalConsumption: null };
    }
    const values = sortedReadings.map((r) => r.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    let totalConsumption: number | null = null;
    if (sortedReadings.length >= 2) {
      const deltas = sortedReadings
        .map((r, i) => (i < sortedReadings.length - 1 ? r.value - sortedReadings[i + 1].value : null))
        .filter((d): d is number => d !== null && d >= 0);
      if (deltas.length > 0) {
        totalConsumption = deltas.reduce((a, b) => a + b, 0);
      }
    }

    return { avg, min, max, totalConsumption };
  }, [sortedReadings]);

  const iconForType =
    device.type === 'electricity' ? 'Zap'
    : device.type === 'water' ? 'Droplets'
    : device.type === 'gas' ? 'Flame'
    : device.type === 'heat' ? 'Thermometer'
    : 'Gauge';

  return (
    <div className={`mx-auto max-w-4xl transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          <Icon name="ArrowLeft" size={18} />
          Обратно към уредите
        </button>
        {isAdmin && onEditDevice && (
          <button
            onClick={onEditDevice}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Icon name="Edit3" size={15} />
            Редактирай уред
          </button>
        )}
      </div>

      {/* Device info card */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-2" style={{ backgroundColor: device.color }} />
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${device.color}18` }}
            >
              <Icon name={iconForType} size={26} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{device.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <DeviceTypeBadge type={device.type} color={device.color} size="sm" />
                <span className="text-sm text-slate-400">·</span>
                <span className="text-sm text-slate-500">Мерна единица: {device.unit}</span>
                {device.number && (
                  <>
                    <span className="text-sm text-slate-400">·</span>
                    <span className="text-sm text-slate-500">№ {device.number}</span>
                  </>
                )}
                {device.inventory_number && (
                  <>
                    <span className="text-sm text-slate-400">·</span>
                    <span className="text-sm text-slate-500">Инв. № {device.inventory_number}</span>
                  </>
                )}
                {device.coefficient !== 1 && (
                  <>
                    <span className="text-sm text-slate-400">·</span>
                    <span className="text-sm text-slate-500">Коефициент: {device.coefficient}</span>
                  </>
                )}
              </div>
              {device.location && (
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-400">
                  <Icon name="MapPin" size={13} />
                  {device.location}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {sortedReadings.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Показания" value={String(sortedReadings.length)} icon="BarChart3" color={device.color} />
          {stats.totalConsumption !== null && (
            <StatCard
              label={`Общо потребление (${device.unit})`}
              value={formatValue(stats.totalConsumption)}
              icon="TrendingUp"
              color={device.color}
            />
          )}
          {stats.min !== null && (
            <StatCard label="Мин. показание" value={formatValue(stats.min)} icon="TrendingDown" color={device.color} />
          )}
          {stats.max !== null && (
            <StatCard label="Макс. показание" value={formatValue(stats.max)} icon="TrendingUp" color={device.color} />
          )}
        </div>
      )}

      {/* Chart */}
      {chartData.length >= 2 && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">График на показанията</h3>
          <BigChart readings={chartData} color={device.color} unit={device.unit} />
        </div>
      )}

      {/* Clients panel */}
      {isAdmin && onAddClient && onUpdateClientPercentage && onRemoveClient && (
        <div className="mb-6">
          <DeviceClientsPanel
            deviceClients={deviceClients}
            availableClients={availableClients}
            deviceId={device.id}
            deviceColor={device.color}
            deviceUnit={device.unit}
            onAddClient={onAddClient}
            onUpdatePercentage={onUpdateClientPercentage}
            onRemoveClient={onRemoveClient}
          />
        </div>
      )}

      {/* Readings table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-700">
            Показания ({sortedReadings.length})
          </h3>
          <button
            onClick={onAddReading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700"
          >
            <Icon name="Plus" size={16} />
            Ново показание
          </button>
        </div>

        {sortedReadings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Icon name="FileText" size={24} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">Няма записани показания</p>
            <p className="mt-1 text-sm text-slate-400">Добавете първото показание за този уред</p>
            <button
              onClick={onAddReading}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700"
            >
              <Icon name="Plus" size={16} />
              Добави показание
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Месец</th>
                  <th className="px-6 py-3 text-right font-medium text-slate-500">Показание</th>
                  <th className="px-6 py-3 text-right font-medium text-slate-500">Разлика</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Бележка</th>
                  <th className="px-6 py-3 text-right font-medium text-slate-500">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedReadings.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 font-medium text-slate-700">{formatMonth(r.reading_date)}</td>
                    <td className="px-6 py-3.5 text-right font-semibold text-slate-900">
                      {formatValue(r.value)}
                      <span className="ml-1 text-xs text-slate-400">{device.unit}</span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {r.delta !== null ? (
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-medium ${
                            r.delta > 0
                              ? 'bg-amber-50 text-amber-700'
                              : r.delta < 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {r.delta > 0 ? '+' : ''}
                          {formatValue(r.delta)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-3.5 text-slate-500">
                      {r.note || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {(isAdmin || r.reading_date.slice(0, 7) === currentMonth) && (
                        <button
                          onClick={() => onEditReading(r)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                          aria-label="Редактиране"
                        >
                          <Icon name="Edit3" size={14} />
                        </button>
                        )}
                        {isAdmin && onDeleteReading && (confirmDeleteId === r.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { onDeleteReading(r); setConfirmDeleteId(null); }}
                              className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100"
                            >
                              Потвърди
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                            >
                              Отказ
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(r.id)}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label="Изтриване"
                          >
                            <Icon name="Trash2" size={14} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon name={icon} size={14} className="" />
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function BigChart({ readings, color, unit }: { readings: ReadingWithDelta[]; color: string; unit: string }) {
  const [animated, setAnimated] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = readings.map((r) => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = readings.length > 1 ? chartW / (readings.length - 1) : 0;

  const points = readings.map((r, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + chartH - ((r.value - min) / range) * chartH,
    reading: r,
  }));

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => min + (range * i) / yTicks);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 500 }}>
        <defs>
          <linearGradient id="big-chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis grid */}
        {tickValues.map((tv, i) => {
          const y = padding.top + chartH - ((tv - min) / range) * chartH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeWidth={1} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#94a3b8">
                {formatValue(tv)}
              </text>
            </g>
          );
        })}

        {/* Area */}
        <path
          d={areaD}
          fill="url(#big-chart-grad)"
          style={{ opacity: animated ? 1 : 0, transition: 'opacity 0.6s ease' }}
        />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 2000,
            strokeDashoffset: animated ? 0 : 2000,
            transition: 'stroke-dashoffset 1s ease',
          }}
        />

        {/* Points + hover */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === i ? 5 : 3}
              fill="white"
              stroke={color}
              strokeWidth={2}
              style={{ transition: 'r 0.15s ease' }}
            />
            <rect
              x={p.x - stepX / 2}
              y={padding.top}
              width={stepX}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
            {hoveredIdx === i && (
              <g>
                <line
                  x1={p.x}
                  y1={padding.top}
                  x2={p.x}
                  y2={padding.top + chartH}
                  stroke={color}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.4}
                />
                <g transform={`translate(${Math.min(p.x, width - 110)}, ${Math.max(p.y - 50, padding.top)})`}>
                  <rect width={105} height={42} rx={6} fill="#1e293b" opacity={0.95} />
                  <text x={8} y={16} fontSize={10} fill="#cbd5e1">
                    {formatMonthShort(p.reading.reading_date)}
                  </text>
                  <text x={8} y={32} fontSize={13} fill="white" fontWeight="bold">
                    {formatValue(p.reading.value)} {unit}
                  </text>
                </g>
              </g>
            )}
          </g>
        ))}

        {/* X-axis labels */}
        {points.map((p, i) => {
          if (readings.length > 12 && i % Math.ceil(readings.length / 8) !== 0 && i !== readings.length - 1) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
            >
              {formatMonthShort(p.reading.reading_date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

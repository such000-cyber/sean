import { useMemo, useState, useEffect } from 'react';
import type { Device, ReadingWithDelta } from '@/lib/supabase';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';

interface DeviceCardProps {
  device: Device;
  readings: ReadingWithDelta[];
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

const MONTH_NAMES_BG = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
];

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTH_NAMES_BG[d.getMonth()]} ${d.getFullYear()}`;
}

function formatValue(v: number): string {
  return v.toLocaleString('bg-BG', { maximumFractionDigits: 3 });
}

export function DeviceCard({ device, readings, onClick, onEdit, onDelete, onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true }: DeviceCardProps) {
  const [hovered, setHovered] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const sortedReadings = useMemo(
    () => [...readings].sort((a, b) => b.reading_date.localeCompare(a.reading_date)),
    [readings]
  );

  const latest = sortedReadings[0] ?? null;
  const previous = sortedReadings[1] ?? null;
  const delta = latest && previous ? latest.value - previous.value : null;

  const iconForType =
    device.type === 'electricity' ? 'Zap'
    : device.type === 'water' ? 'Droplets'
    : device.type === 'gas' ? 'Flame'
    : device.type === 'heat' ? 'Thermometer'
    : 'Gauge';

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${hovered ? 'shadow-lg border-slate-300 -translate-y-0.5' : ''}`}
      onMouseEnter={() => { setHovered(true); setShowActions(true); }}
      onMouseLeave={() => { setHovered(false); setShowActions(false); setConfirmDelete(false); }}
    >
      {/* Color accent bar */}
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: device.color }} />

      {/* Reorder buttons — always visible on the right edge */}
      {(onMoveUp || onMoveDown) && (
        <div
          className="absolute right-0 top-0 z-10 flex h-full flex-col items-center justify-center gap-1 bg-slate-50/80 px-1 opacity-60 transition-opacity hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {onMoveUp && (
            <button
              onClick={() => onMoveUp()}
              disabled={!canMoveUp}
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-sky-100 hover:text-sky-700 disabled:opacity-20 disabled:pointer-events-none"
              aria-label="Премести нагоре"
              title="Премести нагоре"
            >
              <Icon name="ChevronUp" size={18} />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={() => onMoveDown()}
              disabled={!canMoveDown}
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-sky-100 hover:text-sky-700 disabled:opacity-20 disabled:pointer-events-none"
              aria-label="Премести надолу"
              title="Премести надолу"
            >
              <Icon name="ChevronDown" size={18} />
            </button>
          )}
        </div>
      )}

      <div className="cursor-pointer p-5 pl-6 pr-10" onClick={onClick}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${device.color}18` }}
            >
              <Icon name={iconForType} size={20} className="" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 leading-tight">{device.name}</h3>
              {device.location && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                  <Icon name="MapPin" size={11} />
                  {device.location}
                </p>
              )}
              {/* Device numbers — prominent */}
              {(device.number || device.inventory_number) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {device.number && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      <Icon name="Hash" size={10} />
                      № {device.number}
                    </span>
                  )}
                  {device.inventory_number && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      <Icon name="Hash" size={10} />
                      Инв. № {device.inventory_number}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div
            className={`flex items-center gap-1 transition-opacity duration-200 ${
              showActions && (onEdit || onDelete) ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`
          }
            onClick={(e) => e.stopPropagation()}
          >
            {onEdit && (
            <button
              onClick={() => onEdit()}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600"
              aria-label="Редактиране"
            >
              <Icon name="Edit3" size={15} />
            </button>
            )}
            {onDelete && (confirmDelete ? (
              <button
                onClick={() => onDelete()}
                className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                Потвърди
              </button>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                aria-label="Изтриване"
              >
                <Icon name="Trash2" size={15} />
              </button>
            ))}
          </div>
        </div>

        {/* Latest reading */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            {latest ? (
              <>
                <p className="text-xs text-slate-400 mb-0.5">{formatMonth(latest.reading_date)}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">{formatValue(latest.value)}</span>
                  <span className="text-sm text-slate-400">{device.unit}</span>
                </div>
                {delta !== null && (
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    {delta > 0 ? (
                      <span className="flex items-center gap-0.5 text-amber-600">
                        <Icon name="TrendingUp" size={12} />
                        +{formatValue(delta)} {device.unit}
                      </span>
                    ) : delta < 0 ? (
                      <span className="flex items-center gap-0.5 text-emerald-600">
                        <Icon name="TrendingDown" size={12} />
                        {formatValue(delta)} {device.unit}
                      </span>
                    ) : (
                      <span className="text-slate-400">Без промяна</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-slate-400">
                <p>Няма показания</p>
                <p className="mt-0.5 text-xs">Натиснете, за да добавите</p>
              </div>
            )}
          </div>

          {sortedReadings.length >= 2 && (
            <div className="shrink-0">
              <Sparkline readings={sortedReadings.slice(0, 12).reverse()} color={device.color} width={100} height={36} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Icon name="Calendar" size={11} />
              {sortedReadings.length} показания
            </span>
          </div>
          <span className="flex items-center gap-0.5 text-xs font-medium text-slate-400 transition-colors group-hover:text-sky-600">
            Детайли
            <Icon name="ChevronRight" size={14} />
          </span>
        </div>
      </div>
    </div>
  );
}

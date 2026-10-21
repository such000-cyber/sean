import { DEVICE_TYPE_LABELS, type DeviceType } from '@/lib/supabase';
import { Icon } from './Icon';

export function DeviceTypeBadge({
  type,
  color,
  size = 'md',
}: {
  type: DeviceType;
  color: string;
  size?: 'sm' | 'md';
}) {
  const label = DEVICE_TYPE_LABELS[type];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-sm gap-1.5';
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses}`}
      style={{ backgroundColor: `${color}18`, color }}
    >
      <Icon name={type === 'electricity' ? 'Zap' : type === 'water' ? 'Droplets' : type === 'gas' ? 'Flame' : type === 'heat' ? 'Thermometer' : 'Gauge'} size={iconSize} />
      {label}
    </span>
  );
}

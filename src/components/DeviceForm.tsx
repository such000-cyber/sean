import { useState, useEffect } from 'react';
import type { Device, DeviceType, Company, CompanyLocation, DeviceDependency } from '@/lib/supabase';
import { DEVICE_TYPE_LABELS, DEVICE_COLORS, DEVICE_UNITS } from '@/lib/supabase';
import { Icon } from './Icon';

interface DeviceFormProps {
  device: Device | null;
  companies: Company[];
  locations: CompanyLocation[];
  allDevices: Device[];
  deviceDependencies: DeviceDependency[];
  onSave: (data: Omit<Device, 'id' | 'created_at' | 'sort_order'> & { dependencyIds: string[] }) => Promise<void>;
  onCancel: () => void;
}

export function DeviceForm({ device, companies, locations, allDevices, deviceDependencies, onSave, onCancel }: DeviceFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType>('electricity');
  const [unit, setUnit] = useState('kWh');
  const [number, setNumber] = useState('');
  const [inventoryNumber, setInventoryNumber] = useState('');
  const [coefficient, setCoefficient] = useState('1');
  const [isBase, setIsBase] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [priceGroup, setPriceGroup] = useState('');
  const [location, setLocation] = useState('');
  const [color, setColor] = useState(DEVICE_COLORS[0]);
  const [companyId, setCompanyId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [dependencyIds, setDependencyIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (device) {
      setName(device.name);
      setType(device.type);
      setUnit(device.unit);
      setNumber(device.number ?? '');
      setInventoryNumber(device.inventory_number ?? '');
      setCoefficient(String(Number(device.coefficient).toFixed(5).replace(/\.?0+$/, '')));
      setIsBase(device.is_base);
      setIsManual(!!device.is_manual);
      setPriceGroup(device.price_group ?? '');
      setLocation(device.location ?? '');
      setColor(device.color);
      setCompanyId(device.company_id ?? '');
      setLocationId(device.location_id ?? '');
      setDependencyIds(deviceDependencies.filter((d) => d.device_id === device.id).sort((a, b) => a.sort_order - b.sort_order).map((d) => d.depends_on_device_id));
    } else {
      setName('');
      setType('electricity');
      setUnit('kWh');
      setNumber('');
      setInventoryNumber('');
      setCoefficient('1');
      setIsBase(false);
      setIsManual(false);
      setPriceGroup('');
      setLocation('');
      setColor(DEVICE_COLORS[0]);
      setCompanyId('');
      setLocationId('');
      setDependencyIds([]);
    }
  }, [device]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Моля, въведете име на уреда');
      return;
    }
    const coefVal = parseFloat(coefficient.replace(',', '.'));
    if (isNaN(coefVal) || coefVal <= 0) {
      setError('Коефициентът трябва да бъде положително число');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        type,
        unit: unit.trim() || 'kWh',
        number: number.trim() || null,
        inventory_number: inventoryNumber.trim() || null,
        coefficient: coefVal,
        is_base: isBase,
        // полето се изпраща само ако е включено или вече съществува (за да работи и преди миграцията)
        ...(isManual || device?.is_manual !== undefined ? { is_manual: isManual } : {}),
        ...(priceGroup.trim() || device?.price_group !== undefined ? { price_group: priceGroup.trim() || null } : {}),
        location: location.trim() || null,
        location_id: locationId || null,
        company_id: companyId || null,
        color,
        dependencyIds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Възникна грешка');
    } finally {
      setSaving(false);
    }
  };

  const iconForType = type === 'electricity' ? 'Zap' : type === 'water' ? 'Droplets' : type === 'gas' ? 'Flame' : type === 'heat' ? 'Thermometer' : 'Gauge';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <form onSubmit={handleSubmit} className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl animate-[fadeIn_0.2s_ease]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {device ? 'Редактиране на уред' : 'Добавяне на уред'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <Icon name="AlertCircle" size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Фирма</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="">— Без фирма —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {companyId && locations.filter((l) => l.company_id === companyId).length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Локация на фирмата</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="">— Без локация —</option>
                {locations.filter((l) => l.company_id === companyId).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Име на уреда *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="напр. Електричество на апартамента"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Тип уред</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(Object.keys(DEVICE_TYPE_LABELS) as DeviceType[]).map((t) => {
                const active = type === t;
                const iconName = t === 'electricity' ? 'Zap' : t === 'water' ? 'Droplets' : t === 'gas' ? 'Flame' : t === 'heat' ? 'Thermometer' : 'Gauge';
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all ${
                      active
                        ? 'border-sky-400 bg-sky-50 text-sky-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon name={iconName} size={18} />
                    {DEVICE_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Мерна единица</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                list="units-list"
                placeholder="kWh"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <datalist id="units-list">
                {DEVICE_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">№ на уреда</label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Сериен номер"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Инвентарен номер</label>
              <input
                type="text"
                value={inventoryNumber}
                onChange={(e) => setInventoryNumber(e.target.value)}
                placeholder="напр. INV-001"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Коефициент</label>
              <input
                type="text"
                inputMode="decimal"
                value={coefficient}
                onChange={(e) => setCoefficient(e.target.value)}
                placeholder="1"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <p className="mt-1 text-xs text-slate-400">Множител за потреблението (напр. трансформатор)</p>
            </div>
          </div>

          <div>
            <label className="mb-3 flex items-center gap-3 text-sm font-medium text-slate-700">
              <button
                type="button"
                onClick={() => setIsBase(!isBase)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  isBase ? 'bg-sky-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    isBase ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
              Базов уред (ръчна цена)
            </label>
            <p className="-mt-2 mb-4 text-xs text-slate-400">Маркирайте за уреди с фиксирана цена (напр. вода база), вместо цена от доставчик</p>
          </div>

          <div>
            <label className="mb-3 flex items-center gap-3 text-sm font-medium text-slate-700">
              <button
                type="button"
                onClick={() => setIsManual(!isManual)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  isManual ? 'bg-sky-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    isManual ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
              Ръчен уред (без брояч)
            </label>
            <p className="-mt-2 mb-4 text-xs text-slate-400">Всеки месец се въвежда направо потреблението (напр. чилър 1640 kWh), а не показание на брояч. Коефициентът не се прилага.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Ценова група (абонат)</label>
            <input
              type="text"
              list="price-group-options"
              value={priceGroup}
              onChange={(e) => setPriceGroup(e.target.value)}
              placeholder="напр. Аб. 95308012 или Промишлена вода"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <datalist id="price-group-options">
              {Array.from(new Set(allDevices.map((d) => d.price_group).filter((g): g is string => !!g))).sort().map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-slate-400">Уредът се оценява по фактурите със същата група. Празно = общата цена за локацията.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Местоположение</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="напр. Апартамент, Гараж..."
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>

          {/* Device dependencies (subtract readings from other devices) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Изваждане на показания от други уреди</label>
            <p className="mb-2 text-xs text-slate-400">Показанието на този уред ще се изчислява като: въведено показание минус сумата от показанията на избраните уреди</p>
            <div className="space-y-2">
              {dependencyIds.map((depId) => {
                const depDevice = allDevices.find((d) => d.id === depId);
                if (!depDevice) return null;
                return (
                  <div key={depId} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: depDevice.color }} />
                    <span className="flex-1 truncate text-sm text-slate-700">{depDevice.name}</span>
                    <span className="text-xs text-slate-400">{depDevice.unit}</span>
                    <button
                      type="button"
                      onClick={() => setDependencyIds(dependencyIds.filter((id) => id !== depId))}
                      className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                );
              })}
              {(() => {
                const available = allDevices.filter((d) => d.id !== device?.id && !dependencyIds.includes(d.id));
                if (available.length === 0) return null;
                return (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setDependencyIds([...dependencyIds, e.target.value]);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-500 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">+ Добави уред за изваждане</option>
                    {available.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.unit})</option>
                    ))}
                  </select>
                );
              })()}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Цветови маркер</label>
            <div className="flex flex-wrap gap-2">
              {DEVICE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Цвят ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Hidden icon ref to satisfy import */}
          <span className="hidden">
            <Icon name={iconForType} size={1} />
          </span>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            Отказ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 disabled:opacity-50"
          >
            <Icon name="Save" size={16} />
            {saving ? 'Запазване...' : 'Запази'}
          </button>
        </div>
      </form>
    </div>
  );
}

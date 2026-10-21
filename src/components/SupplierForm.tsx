import { useState } from 'react';
import type { Supplier, ServiceType, Company, CompanyLocation } from '@/lib/supabase';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_ICONS } from '@/lib/supabase';
import { Icon } from './Icon';

interface SupplierFormProps {
  supplier: Supplier | null;
  companies: Company[];
  locations: CompanyLocation[];
  onSave: (data: { name: string; service_type: ServiceType; company_id: string | null; location_id: string | null; bulstat: string | null; address: string | null; phone: string | null; email: string | null }) => Promise<void>;
  onCancel: () => void;
}

export function SupplierForm({ supplier, companies, locations, onSave, onCancel }: SupplierFormProps) {
  const [name, setName] = useState(supplier?.name ?? '');
  const [serviceType, setServiceType] = useState<ServiceType>(supplier?.service_type ?? 'electricity');
  const [companyId, setCompanyId] = useState<string>(supplier?.company_id ?? '');
  const [locationId, setLocationId] = useState<string>(supplier?.location_id ?? '');
  const [bulstat, setBulstat] = useState(supplier?.bulstat ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Името е задължително');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        service_type: serviceType,
        company_id: companyId || null,
        location_id: (companyId && locationId) ? locationId : null,
        bulstat: bulstat.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при запазване');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {supplier ? 'Редактирай доставчик' : 'Нов доставчик'}
          </h2>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Име *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="напр. ЕВН България"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Вид услуга *</label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setServiceType(type)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                    serviceType === type
                      ? 'border-sky-400 bg-sky-50 text-sky-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Icon name={SERVICE_TYPE_ICONS[type]} size={16} />
                  <span className="truncate">{SERVICE_TYPE_LABELS[type]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Фирма</label>
            <select
              value={companyId}
              onChange={(e) => { setCompanyId(e.target.value); setLocationId(''); }}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="">Всички фирми</option>
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
            <label className="mb-1.5 block text-sm font-medium text-slate-700">ЕИК (Булстат)</label>
            <input
              type="text"
              value={bulstat}
              onChange={(e) => setBulstat(e.target.value)}
              placeholder="напр. 123456789"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Адрес</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Адрес на доставчика"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Телефон</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Телефон"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Имейл</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Имейл"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <Icon name="AlertCircle" size={16} />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Отказ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 disabled:opacity-50"
            >
              <Icon name="Save" size={16} />
              {saving ? 'Запазване...' : 'Запази'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

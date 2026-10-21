import { useState, useMemo } from 'react';
import type { SupplierInvoice, Supplier, ServiceType } from '@/lib/supabase';
import { Icon } from './Icon';

interface SupplierInvoiceFormProps {
  invoice: SupplierInvoice | null;
  supplier: Supplier;
  onSave: (data: {
    invoice_number: string;
    invoice_date: string;
    service_month: string;
    quantity: number;
    unit: string;
    amount: number;
    vat_amount: number;
    total_amount: number;
    note: string | null;
    id?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

const UNITS_BY_SERVICE: Record<ServiceType, string[]> = {
  electricity: ['kWh', 'kW', 'MWh'],
  water: ['m³', 'л'],
  gas: ['m³', 'kWh', 'MWh'],
  heat: ['GJ', 'kWh', 'MWh'],
  other: ['kWh', 'm³', 'GJ', 'т', 'kW', 'л', 'MW'],
};

function formatMoney(v: number): string {
  return v.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SupplierInvoiceForm({ invoice, supplier, onSave, onCancel }: SupplierInvoiceFormProps) {
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const currentDateStr = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);

  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoice_number ?? '');
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date ?? currentDateStr);
  const [serviceMonth, setServiceMonth] = useState(invoice?.service_month ?? currentMonthStr);
  const [quantity, setQuantity] = useState(invoice ? String(invoice.quantity) : '');
  const [unit, setUnit] = useState(invoice?.unit ?? UNITS_BY_SERVICE[supplier.service_type][0]);
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : '');
  const [vatAmount, setVatAmount] = useState(invoice ? String(invoice.vat_amount) : '');
  const [note, setNote] = useState(invoice?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = useMemo(() => {
    const a = parseFloat(amount.replace(',', '.')) || 0;
    const v = parseFloat(vatAmount.replace(',', '.')) || 0;
    return a + v;
  }, [amount, vatAmount]);

  const availableUnits = UNITS_BY_SERVICE[supplier.service_type] ?? UNITS_BY_SERVICE.other;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      setError('Номерът на фактурата е задължителен');
      return;
    }
    if (!quantity.trim()) {
      setError('Количеството е задължително');
      return;
    }
    if (!amount.trim()) {
      setError('Стойността е задължителна');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        service_month: serviceMonth,
        quantity: parseFloat(quantity.replace(',', '.')) || 0,
        unit,
        amount: parseFloat(amount.replace(',', '.')) || 0,
        vat_amount: parseFloat(vatAmount.replace(',', '.')) || 0,
        total_amount: totalAmount,
        note: note.trim() || null,
        id: invoice?.id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при запазване');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {invoice ? 'Редактирай фактура' : 'Нова фактура'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">Доставчик: {supplier.name}</p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">№ фактура *</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="напр. 123456789"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Дата *</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Месец на услугата *</label>
            <input
              type="month"
              value={serviceMonth}
              onChange={(e) => setServiceMonth(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Количество *</label>
              <input
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="напр. 1500"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Мерна единица</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                {availableUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Стойност без ДДС *</label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">ДДС</label>
              <input
                type="text"
                inputMode="decimal"
                value={vatAmount}
                onChange={(e) => setVatAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Обща стойност с ДДС:</span>
              <span className="text-lg font-bold text-slate-900">{formatMoney(totalAmount)} €</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Бележка</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Допълнителна информация..."
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
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

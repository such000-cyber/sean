import { useState, useEffect } from 'react';
import type { Device, Reading } from '@/lib/supabase';
import { Icon } from './Icon';

interface ReadingFormProps {
  device: Device;
  existingReading: Reading | null;
  defaultMonth: string;
  onSave: (data: { reading_date: string; value: number; note: string | null; id?: string }) => Promise<void>;
  onCancel: () => void;
}

export function ReadingForm({ device, existingReading, defaultMonth, onSave, onCancel }: ReadingFormProps) {
  const [month, setMonth] = useState(defaultMonth);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingReading) {
      setMonth(existingReading.reading_date.slice(0, 7));
      setValue(String(existingReading.raw_value ?? existingReading.value));
      setNote(existingReading.note ?? '');
    } else {
      setMonth(defaultMonth);
      setValue('');
      setNote('');
    }
  }, [existingReading, defaultMonth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = parseFloat(value.replace(',', '.'));
    if (isNaN(numValue)) {
      setError('Моля, въведете валидно число');
      return;
    }
    if (numValue < 0) {
      setError('Стойността не може да бъде отрицателна');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: existingReading?.id,
        reading_date: `${month}-01`,
        value: numValue,
        note: note.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Възникна грешка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl animate-[fadeIn_0.2s_ease]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {existingReading ? 'Редактиране на показание' : 'Ново показание'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{device.name}</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <Icon name="AlertCircle" size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Месец *</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Показание ({device.unit}) *
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="напр. 1234.5"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Въведете стойността, която виждате на уреда
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Бележка (по желание)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Допълнителна информация..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
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
    </div>
  );
}

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Device, Client, DeviceDependency, DeviceClientWithClient } from '@/lib/supabase';
import { EXCEL_CONFIG_09_2026, EXCEL_CONFIG_COMPANY_ID, type DeviceRef } from '@/lib/excelConfig';
import { Icon } from './Icon';

interface ExcelConfigPanelProps {
  devices: Device[];
  clients: Client[];
  deviceDependencies: DeviceDependency[];
  deviceClients: DeviceClientWithClient[];
  onDone: () => Promise<void>;
  onBack: () => void;
}

interface ResolvedItem {
  label: string;
  deviceId: string | null;
  subtractIds: string[] | null; // null = не се променя
  clientRows: { clientId: string; percentage: number }[] | null; // null = не се променя
  currentSubtracts: string;
  newSubtracts: string | null;
  currentClients: string;
  newClients: string | null;
  errors: string[];
}

function fmtPct(p: number) {
  return `${Number(p).toLocaleString('bg-BG', { maximumFractionDigits: 2 })}%`;
}

export function ExcelConfigPanel({ devices, clients, deviceDependencies, deviceClients, onDone, onBack }: ExcelConfigPanelProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [log, setLog] = useState<string[]>([]);

  const companyDevices = useMemo(() => devices.filter((d) => d.company_id === EXCEL_CONFIG_COMPANY_ID), [devices]);
  const deviceName = (id: string) => devices.find((d) => d.id === id)?.name ?? id;

  const resolveDevice = (ref: DeviceRef): { id: string | null; error: string | null } => {
    const found = companyDevices.filter((d) => d.name === ref.name && (ref.number === undefined || d.number === ref.number));
    if (found.length === 1) return { id: found[0].id, error: null };
    return {
      id: null,
      error: `Уред „${ref.name}“${ref.number ? ` (номер ${ref.number})` : ''}: намерени ${found.length}, очаква се 1`,
    };
  };

  const resolveClient = (name: string): { id: string | null; error: string | null } => {
    let found = clients.filter((c) => c.name === name);
    if (found.length > 1) found = found.filter((c) => c.company_id === EXCEL_CONFIG_COMPANY_ID);
    if (found.length === 1) return { id: found[0].id, error: null };
    return { id: null, error: `Клиент „${name}“: намерени ${found.length}, очаква се 1` };
  };

  const items: ResolvedItem[] = useMemo(() => {
    return EXCEL_CONFIG_09_2026.map((cfg) => {
      const errors: string[] = [];
      const dev = resolveDevice(cfg.device);
      if (dev.error) errors.push(dev.error);

      let subtractIds: string[] | null = null;
      if (cfg.subtracts) {
        subtractIds = [];
        for (const s of cfg.subtracts) {
          const r = resolveDevice(s);
          if (r.error) errors.push(r.error);
          else subtractIds.push(r.id!);
        }
      }
      let clientRows: { clientId: string; percentage: number }[] | null = null;
      if (cfg.clients) {
        clientRows = [];
        for (const c of cfg.clients) {
          const r = resolveClient(c.name);
          if (r.error) errors.push(r.error);
          else clientRows.push({ clientId: r.id!, percentage: c.percentage });
        }
      }

      const curDeps = dev.id
        ? deviceDependencies.filter((d) => d.device_id === dev.id).sort((a, b) => a.sort_order - b.sort_order).map((d) => deviceName(d.depends_on_device_id))
        : [];
      const curClients = dev.id
        ? deviceClients.filter((dc) => dc.device_id === dev.id).map((dc) => `${dc.client?.name ?? '?'} ${fmtPct(dc.percentage)}`)
        : [];

      return {
        label: cfg.device.name + (cfg.device.number ? ` (№ ${cfg.device.number})` : ''),
        deviceId: dev.id,
        subtractIds,
        clientRows,
        currentSubtracts: curDeps.join('; ') || '—',
        newSubtracts: cfg.subtracts ? (cfg.subtracts.map((s) => s.name).join('; ') || 'без изваждане') : null,
        currentClients: curClients.join('; ') || '—',
        newClients: cfg.clients ? (cfg.clients.map((c) => `${c.name} ${fmtPct(c.percentage)}`).join('; ') || 'без клиенти') : null,
        errors,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyDevices, clients, deviceDependencies, deviceClients]);

  const allErrors = items.flatMap((i) => i.errors);

  const handleApply = async () => {
    if (allErrors.length > 0) return;
    setStatus('saving');
    const messages: string[] = [];
    for (const it of items) {
      const id = it.deviceId!;
      if (it.subtractIds) {
        const del = await supabase.from('device_dependencies').delete().eq('device_id', id);
        if (del.error) { messages.push(`✗ ${it.label} – зависимости: ${del.error.message}`); continue; }
        if (it.subtractIds.length > 0) {
          const ins = await supabase.from('device_dependencies').insert(
            it.subtractIds.map((sub, i) => ({ device_id: id, depends_on_device_id: sub, sort_order: i })),
          );
          if (ins.error) { messages.push(`✗ ${it.label} – зависимости: ${ins.error.message}`); continue; }
        }
      }
      if (it.clientRows) {
        const del = await supabase.from('device_clients').delete().eq('device_id', id);
        if (del.error) { messages.push(`✗ ${it.label} – клиенти: ${del.error.message}`); continue; }
        if (it.clientRows.length > 0) {
          const ins = await supabase.from('device_clients').insert(
            it.clientRows.map((c) => ({ device_id: id, client_id: c.clientId, percentage: c.percentage })),
          );
          if (ins.error) { messages.push(`✗ ${it.label} – клиенти: ${ins.error.message}`); continue; }
        }
      }
      messages.push(`✓ ${it.label}`);
    }
    setLog(messages);
    await onDone();
    setStatus('done');
  };

  const failed = log.filter((l) => l.startsWith('✗')).length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Настройки от Excel – м.09.2026</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Зависимостите („изважда“) и процентите на клиентите за {items.length} уреда в София, така че сметката да съвпада с месечния Excel.
            Останалите уреди не се променят. Може да се пусне повторно – резултатът е същият.
          </p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <Icon name="ArrowLeft" size={16} />
          Обратно
        </button>
      </div>

      {allErrors.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Не може да се приложи: някои имена не съвпадат с уредите или клиентите в приложението.</p>
          <ul className="mt-1 list-disc pl-5">
            {allErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {status === 'done' && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${failed ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <p className="font-semibold">{failed ? `Готово с ${failed} грешки.` : 'Готово. Всички настройки са записани.'}</p>
          {failed > 0 && <ul className="mt-1 list-disc pl-5">{log.filter((l) => l.startsWith('✗')).map((l, i) => <li key={i}>{l}</li>)}</ul>}
          <p className="mt-1">Отворете Справката за септември, за да видите новите суми.</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Уред</th>
              <th className="px-4 py-3">Изважда – сега</th>
              <th className="px-4 py-3">Изважда – след</th>
              <th className="px-4 py-3">Клиенти – сега</th>
              <th className="px-4 py-3">Клиенти – след</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 align-top">
            {items.map((it, i) => (
              <tr key={i} className={it.errors.length ? 'bg-red-50/40' : ''}>
                <td className="px-4 py-3 font-medium text-slate-700">{it.label}</td>
                <td className="px-4 py-3 text-slate-500">{it.newSubtracts === null ? <span className="text-slate-300">без промяна</span> : it.currentSubtracts}</td>
                <td className="px-4 py-3 text-slate-800">{it.newSubtracts ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-slate-500">{it.newClients === null ? <span className="text-slate-300">без промяна</span> : it.currentClients}</td>
                <td className="px-4 py-3 text-slate-800">{it.newClients ?? <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          onClick={handleApply}
          disabled={allErrors.length > 0 || status === 'saving'}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="Save" size={16} />
          {status === 'saving' ? 'Записване…' : 'Приложи настройките'}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Device, Client, DeviceDependency, DeviceClientWithClient, Reading } from '@/lib/supabase';
import {
  EXCEL_CONFIG_09_2026,
  EXCEL_MANUAL_DEVICES_09_2026,
  EXCEL_ADJUSTMENTS_09_2026,
  EXCEL_CONFIG_COMPANY_ID,
  EXCEL_CONFIG_MONTH,
  type DeviceRef,
} from '@/lib/excelConfig';
import { Icon } from './Icon';

interface ExcelConfigPanelProps {
  devices: Device[];
  readings: Reading[];
  clients: Client[];
  deviceDependencies: DeviceDependency[];
  deviceClients: DeviceClientWithClient[];
  onDone: () => Promise<void>;
  onBack: () => void;
}

const NEW_PREFIX = 'new:';

function fmtPct(p: number) {
  return `${Number(p).toLocaleString('bg-BG', { maximumFractionDigits: 2 })}%`;
}
function fmtNum(v: number) {
  return v.toLocaleString('bg-BG', { maximumFractionDigits: 3 });
}

export function ExcelConfigPanel({ devices, readings, clients, deviceDependencies, deviceClients, onDone, onBack }: ExcelConfigPanelProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [log, setLog] = useState<string[]>([]);
  // null = проверява се; true/false = има ли новите полета в базата
  const [hasNewColumns, setHasNewColumns] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const a = await supabase.from('readings').select('adjustment').limit(1);
      const b = await supabase.from('devices').select('is_manual').limit(1);
      if (!cancelled) setHasNewColumns(!a.error && !b.error);
    })();
    return () => { cancelled = true; };
  }, []);

  const companyDevices = useMemo(() => devices.filter((d) => d.company_id === EXCEL_CONFIG_COMPANY_ID), [devices]);
  const deviceName = (id: string) => devices.find((d) => d.id === id)?.name ?? id;
  const manualEnabled = hasNewColumns === true;

  // Ръчни уреди: съществуват ли вече
  const manualPlan = useMemo(() => EXCEL_MANUAL_DEVICES_09_2026.map((m) => {
    const existing = companyDevices.filter((d) => d.name === m.name);
    const like = companyDevices.filter((d) => d.name === m.likeDevice.name);
    return { cfg: m, existingId: existing.length === 1 ? existing[0].id : null, duplicate: existing.length > 1, like: like.length === 1 ? like[0] : null };
  }), [companyDevices]);
  const manualNames = new Set(EXCEL_MANUAL_DEVICES_09_2026.map((m) => m.name));

  const resolveDevice = (ref: DeviceRef): { id: string | null; error: string | null; skip?: boolean } => {
    const found = companyDevices.filter((d) => d.name === ref.name && (ref.number === undefined || d.number === ref.number));
    if (found.length === 1) return { id: found[0].id, error: null };
    if (found.length === 0 && manualNames.has(ref.name)) {
      // ръчен уред, който ще бъде създаден
      return manualEnabled ? { id: NEW_PREFIX + ref.name, error: null } : { id: null, error: null, skip: true };
    }
    return { id: null, error: `Уред „${ref.name}“${ref.number ? ` (номер ${ref.number})` : ''}: намерени ${found.length}, очаква се 1` };
  };

  const resolveClient = (name: string): { id: string | null; error: string | null } => {
    let found = clients.filter((c) => c.name === name);
    if (found.length > 1) found = found.filter((c) => c.company_id === EXCEL_CONFIG_COMPANY_ID);
    if (found.length === 1) return { id: found[0].id, error: null };
    return { id: null, error: `Клиент „${name}“: намерени ${found.length}, очаква се 1` };
  };

  const items = useMemo(() => EXCEL_CONFIG_09_2026.map((cfg) => {
    const errors: string[] = [];
    const dev = resolveDevice(cfg.device);
    if (dev.error) errors.push(dev.error);
    let subtractIds: string[] | null = null;
    const skipped: string[] = [];
    if (cfg.subtracts) {
      subtractIds = [];
      for (const s of cfg.subtracts) {
        const r = resolveDevice(s);
        if (r.error) errors.push(r.error);
        else if (r.skip) skipped.push(s.name);
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
    const realId = dev.id && !dev.id.startsWith(NEW_PREFIX) ? dev.id : null;
    const curDeps = realId
      ? deviceDependencies.filter((d) => d.device_id === realId).sort((a, b) => a.sort_order - b.sort_order).map((d) => deviceName(d.depends_on_device_id))
      : [];
    const curClients = realId
      ? deviceClients.filter((dc) => dc.device_id === realId).map((dc) => `${dc.client?.name ?? '?'} ${fmtPct(dc.percentage)}`)
      : [];
    return {
      label: cfg.device.name + (cfg.device.number ? ` (№ ${cfg.device.number})` : ''),
      deviceId: dev.id,
      subtractIds,
      clientRows,
      currentSubtracts: curDeps.join('; ') || '—',
      newSubtracts: cfg.subtracts
        ? (cfg.subtracts.filter((s) => !skipped.includes(s.name)).map((s) => s.name).join('; ') || 'без изваждане')
        : null,
      currentClients: curClients.join('; ') || '—',
      newClients: cfg.clients ? (cfg.clients.map((c) => `${c.name} ${fmtPct(c.percentage)}`).join('; ') || 'без клиенти') : null,
      errors,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [companyDevices, clients, deviceDependencies, deviceClients, manualEnabled]);

  const adjustmentPlan = useMemo(() => EXCEL_ADJUSTMENTS_09_2026.map((a) => {
    const dev = resolveDevice(a.device);
    const reading = dev.id ? readings.find((r) => r.device_id === dev.id && r.reading_date === EXCEL_CONFIG_MONTH) : undefined;
    return { cfg: a, deviceId: dev.id, error: dev.error, reading, current: Number(reading?.adjustment ?? 0) || 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [companyDevices, readings]);

  const manualErrors = manualEnabled
    ? manualPlan.flatMap((m) => [
        ...(m.duplicate ? [`Ръчен уред „${m.cfg.name}“ съществува повече от веднъж`] : []),
        ...(!m.existingId && !m.like ? [`Уред „${m.cfg.likeDevice.name}“ (образец за „${m.cfg.name}“) не е намерен`] : []),
        ...m.cfg.clients.map((c) => resolveClient(c.name).error).filter((e): e is string => !!e),
      ])
    : [];
  const adjustmentErrors = manualEnabled
    ? adjustmentPlan.flatMap((a) => [
        ...(a.error ? [a.error] : []),
        ...(!a.error && !a.reading ? [`Няма показание за 09.2026 на „${a.cfg.device.name}“ – корекцията ще се запише, след като се въведе показание`] : []),
      ])
    : [];
  const allErrors = [...items.flatMap((i) => i.errors), ...manualErrors];

  const handleApply = async () => {
    if (allErrors.length > 0 || hasNewColumns === null) return;
    setStatus('saving');
    const messages: string[] = [];
    const createdIds = new Map<string, string>(); // име → id

    // 1) Ръчни уреди и тяхното количество за месеца
    if (manualEnabled) {
      for (const m of manualPlan) {
        let id = m.existingId;
        if (!id) {
          const like = m.like!;
          const ins = await supabase.from('devices').insert({
            name: m.cfg.name,
            type: like.type,
            unit: like.unit,
            number: null,
            inventory_number: null,
            coefficient: 1,
            is_base: false,
            is_manual: true,
            location: null,
            location_id: like.location_id,
            company_id: like.company_id,
            color: like.color,
            sort_order: like.sort_order,
          }).select('id').single();
          if (ins.error || !ins.data) { messages.push(`✗ ${m.cfg.name} – създаване: ${ins.error?.message}`); continue; }
          id = ins.data.id as string;
        } else {
          await supabase.from('devices').update({ is_manual: true }).eq('id', id);
        }
        createdIds.set(m.cfg.name, id);
        const rd = await supabase.from('readings').upsert(
          { device_id: id, reading_date: EXCEL_CONFIG_MONTH, value: m.cfg.value, raw_value: m.cfg.value, note: m.cfg.note },
          { onConflict: 'device_id,reading_date' },
        );
        if (rd.error) { messages.push(`✗ ${m.cfg.name} – количество: ${rd.error.message}`); continue; }
        const delC = await supabase.from('device_clients').delete().eq('device_id', id);
        if (delC.error) { messages.push(`✗ ${m.cfg.name} – клиенти: ${delC.error.message}`); continue; }
        const insC = await supabase.from('device_clients').insert(
          m.cfg.clients.map((c) => ({ device_id: id, client_id: resolveClient(c.name).id, percentage: c.percentage })),
        );
        if (insC.error) { messages.push(`✗ ${m.cfg.name} – клиенти: ${insC.error.message}`); continue; }
        messages.push(`✓ ${m.cfg.name}: ${fmtNum(m.cfg.value)}`);
      }
    }
    const realId = (id: string) => (id.startsWith(NEW_PREFIX) ? createdIds.get(id.slice(NEW_PREFIX.length)) ?? null : id);

    // 2) Зависимости и клиенти
    for (const it of items) {
      const id = it.deviceId ? realId(it.deviceId) : null;
      if (!id) { messages.push(`✗ ${it.label} – уредът не е намерен`); continue; }
      if (it.subtractIds) {
        const subs = it.subtractIds.map(realId).filter((s): s is string => !!s);
        const del = await supabase.from('device_dependencies').delete().eq('device_id', id);
        if (del.error) { messages.push(`✗ ${it.label} – зависимости: ${del.error.message}`); continue; }
        if (subs.length > 0) {
          const ins = await supabase.from('device_dependencies').insert(subs.map((sub, i) => ({ device_id: id, depends_on_device_id: sub, sort_order: i })));
          if (ins.error) { messages.push(`✗ ${it.label} – зависимости: ${ins.error.message}`); continue; }
        }
      }
      if (it.clientRows) {
        const del = await supabase.from('device_clients').delete().eq('device_id', id);
        if (del.error) { messages.push(`✗ ${it.label} – клиенти: ${del.error.message}`); continue; }
        if (it.clientRows.length > 0) {
          const ins = await supabase.from('device_clients').insert(it.clientRows.map((c) => ({ device_id: id, client_id: c.clientId, percentage: c.percentage })));
          if (ins.error) { messages.push(`✗ ${it.label} – клиенти: ${ins.error.message}`); continue; }
        }
      }
      messages.push(`✓ ${it.label}`);
    }

    // 3) Корекции за месеца
    if (manualEnabled) {
      for (const a of adjustmentPlan) {
        if (!a.deviceId || !a.reading) { messages.push(`– ${a.cfg.device.name}: корекцията е пропусната (няма показание за 09.2026)`); continue; }
        const up = await supabase.from('readings').update({ adjustment: a.cfg.value }).eq('id', a.reading.id);
        if (up.error) messages.push(`✗ ${a.cfg.device.name} – корекция: ${up.error.message}`);
        else messages.push(`✓ ${a.cfg.device.name}: корекция ${a.cfg.value > 0 ? '+' : ''}${fmtNum(a.cfg.value)}`);
      }
    }

    setLog(messages);
    await onDone();
    setStatus('done');
  };

  const failed = log.filter((l) => l.startsWith('✗'));
  const skippedMsgs = log.filter((l) => l.startsWith('–'));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Настройки от Excel – м.09.2026</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Зависимостите („изважда“), процентите на клиентите, ръчните количества и корекциите за уредите в София, така че сметката да съвпада с месечния Excel.
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

      {hasNewColumns === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Ръчните количества и корекциите ще бъдат пропуснати: в базата още няма новите полета.</p>
          <p className="mt-1">
            В чата на Bolt напишете: <span className="select-all rounded bg-white px-1.5 py-0.5 font-mono text-xs">Apply the migration supabase/migrations/20261022090000_add_manual_devices_and_adjustments.sql</span>
            {' '}и след това отворете този екран отново. Зависимостите и процентите може да се запишат и сега.
          </p>
        </div>
      )}

      {allErrors.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Не може да се приложи: някои имена не съвпадат с уредите или клиентите в приложението.</p>
          <ul className="mt-1 list-disc pl-5">{allErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {status === 'done' && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${failed.length ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <p className="font-semibold">{failed.length ? `Готово с ${failed.length} грешки.` : 'Готово. Всички настройки са записани.'}</p>
          {(failed.length > 0 || skippedMsgs.length > 0) && <ul className="mt-1 list-disc pl-5">{[...failed, ...skippedMsgs].map((l, i) => <li key={i}>{l}</li>)}</ul>}
          <p className="mt-1">Отворете Справката за септември, за да видите новите суми.</p>
        </div>
      )}

      {manualEnabled && (
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Ръчни уреди (фиксирани количества от Excel)</h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">Уред</th>
                  <th className="px-4 py-3">Състояние</th>
                  <th className="px-4 py-3 text-right">Количество 09.2026</th>
                  <th className="px-4 py-3">Клиент</th>
                  <th className="px-4 py-3">Откъде</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 align-top">
                {manualPlan.map((m) => (
                  <tr key={m.cfg.name}>
                    <td className="px-4 py-3 font-medium text-slate-700">{m.cfg.name}</td>
                    <td className="px-4 py-3 text-slate-500">{m.existingId ? 'съществува' : 'ще бъде създаден'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtNum(m.cfg.value)} kWh</td>
                    <td className="px-4 py-3 text-slate-800">{m.cfg.clients.map((c) => `${c.name} ${fmtPct(c.percentage)}`).join('; ')}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{m.cfg.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {manualEnabled && (
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Корекции за 09.2026</h3>
          {adjustmentErrors.length > 0 && (
            <ul className="mb-2 list-disc pl-5 text-xs text-amber-700">{adjustmentErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">Уред</th>
                  <th className="px-4 py-3 text-right">Сега</th>
                  <th className="px-4 py-3 text-right">След</th>
                  <th className="px-4 py-3">Откъде</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {adjustmentPlan.map((a) => (
                  <tr key={a.cfg.device.name}>
                    <td className="px-4 py-3 font-medium text-slate-700">{a.cfg.device.name}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500">{fmtNum(a.current)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{a.cfg.value > 0 ? '+' : ''}{fmtNum(a.cfg.value)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{a.cfg.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <h3 className="mb-2 text-sm font-semibold text-slate-700">Зависимости и клиенти</h3>
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
          disabled={allErrors.length > 0 || status === 'saving' || hasNewColumns === null}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="Save" size={16} />
          {status === 'saving' ? 'Записване…' : hasNewColumns === null ? 'Проверка…' : 'Приложи настройките'}
        </button>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { Device, Reading, Company, Client, DeviceClientWithClient, CompanyLocation, DeviceDependency } from '@/lib/supabase';
import { computeNetConsumptions } from '@/lib/consumption';
import { Icon } from './Icon';

interface CompensationReportProps {
  devices: Device[];
  readings: Reading[];
  deviceDependencies: DeviceDependency[];
  companies: Company[];
  clients: Client[];
  deviceClients: DeviceClientWithClient[];
  locations: CompanyLocation[];
  onBack: () => void;
}

const MONTH_NAMES_BG = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
];

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-');
  return `${MONTH_NAMES_BG[parseInt(m) - 1]} ${y}`;
}

// SAP company codes (BUKRS)
const COMPANY_CODES: Record<string, string> = {
  '6069387e-d90a-4299-ae85-611af0f53d1e': '2500', // Виена Реал Естейт Видин ЕООД
  '2842e653-c555-4e33-ba40-81daf29373cb': '2800', // Индустриален Парк Драгоман ЕООД
  '52ed2e37-1ecc-4026-94d6-17f52ee5fb36': '2200', // Виена Реал Естейт ЕАД
  '1c6bc81e-b396-41e2-9590-dd2a7e7a8637': '2700', // Русе Пропъртис ЕООД
};

// PRCTR (profit center) per company — Виена Реал Естейт ЕАД has per-location codes
const PRCTR_BY_COMPANY: Record<string, string> = {
  '6069387e-d90a-4299-ae85-611af0f53d1e': '259001',
  '2842e653-c555-4e33-ba40-81daf29373cb': '285001',
  '1c6bc81e-b396-41e2-9590-dd2a7e7a8637': '275001',
};

const PRCTR_BY_LOCATION: Record<string, string> = {
  'София': '221001',
  'Бургас': '224001',
  'Видин': '229001',
};

// GSBER (business area) per company — Виена Реал Естейт ЕАД has per-location codes
const GSBER_BY_COMPANY: Record<string, string> = {
  '6069387e-d90a-4299-ae85-611af0f53d1e': '2291',
  '2842e653-c555-4e33-ba40-81daf29373cb': '2251',
  '1c6bc81e-b396-41e2-9590-dd2a7e7a8637': '2251',
};

const GSBER_BY_LOCATION: Record<string, string> = {
  'София': '2211',
  'Бургас': '2241',
  'Видин': '2291',
};

// Column headers for the SAP export (33 columns)
const SAP_COLUMNS = [
  'STYPE', 'TCODE', 'BLDAT', 'BLART', 'BUKRS', 'BUDAT', 'WAERS', 'XBLNR', 'BKTXT',
  'STYPE', 'NEWBS', 'XNEGP', 'NEWKO', 'WRBTR', 'WMWST', 'MWSKZ', 'KOSTL', 'PRCTR', 'GSBER', 'AUFNR', 'ZUONR', 'SGTXT',
  'STYPE', 'NEWBS', 'XNEGP', 'NEWKO', 'HKONT', 'WRBTR', 'WMWST', 'MWSKZ', 'GSBER', 'ZUONR', 'SGTXT',
] as const;

interface DeviceConsumptionInfo {
  device: Device;
  consumption: number;
  unit: string;
}

interface ClientCompensationRow {
  client: Client;
  company: Company;
  location: CompanyLocation | null;
  kwhConsumed: number;
  compensationAmount: number;
}

export function CompensationReport({
  devices,
  readings,
  deviceDependencies,
  companies,
  clients,
  deviceClients,
  locations,
  onBack,
}: CompensationReportProps) {
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [month, setMonth] = useState(currentMonthStr);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [manualDate, setManualDate] = useState<string>(currentMonthStr + '-01');
  const [unitPrice, setUnitPrice] = useState<number>(0.15);
  const [invoiceStartNumber, setInvoiceStartNumber] = useState<number>(1);

  // Locations available for the selected company
  const availableLocations = useMemo(() => {
    if (selectedCompanyId === 'all') return [];
    return locations.filter((l) => l.company_id === selectedCompanyId).sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, selectedCompanyId]);

  // Companies with electricity devices
  const companiesWithElectricity = useMemo(() => {
    const companyIds = new Set(
      devices.filter((d) => d.type === 'electricity' && d.company_id).map((d) => d.company_id!)
    );
    return companies.filter((c) => companyIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, devices]);

  // Compute electricity consumption per device for the selected month
  const deviceConsumptions = useMemo(() => {
    const result: Record<string, DeviceConsumptionInfo | null> = {};
    const monthDate = `${month}-01`;

    const relevantDevices = selectedCompanyId === 'all'
      ? devices.filter((d) => d.type === 'electricity')
      : devices.filter((d) => d.type === 'electricity' && d.company_id === selectedCompanyId);
    const locationFiltered = selectedLocationId === 'all'
      ? relevantDevices
      : relevantDevices.filter((d) => d.location_id === selectedLocationId);

    const nets = computeNetConsumptions(devices, readings, deviceDependencies, monthDate);
    for (const device of locationFiltered) {
      const n = nets.get(device.id);
      result[device.id] = n ? { device, consumption: n.net, unit: device.unit } : null;
    }
    return result;
  }, [devices, readings, deviceDependencies, month, selectedCompanyId, selectedLocationId]);

  // Total kWh consumed per company (sum of all electricity devices in that company)
  const totalKwhByCompany = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [deviceId, info] of Object.entries(deviceConsumptions)) {
      if (!info || info.consumption <= 0) continue;
      const companyId = info.device.company_id ?? '';
      totals[companyId] = (totals[companyId] ?? 0) + info.consumption;
    }
    return totals;
  }, [deviceConsumptions]);

  // Build per-client compensation rows, merging by SAP number (client identifier)
  const compensationRows = useMemo(() => {
    const map = new Map<string, ClientCompensationRow>();
    const relevantDeviceClients = selectedCompanyId === 'all'
      ? deviceClients
      : deviceClients.filter((dc) => {
          const device = devices.find((d) => d.id === dc.device_id);
          return device?.company_id === selectedCompanyId;
        });

    for (const dc of relevantDeviceClients) {
      const info = deviceConsumptions[dc.device_id];
      if (!info || info.consumption <= 0) continue;
      const device = info.device;
      if (device.type !== 'electricity') continue;

      const client = clients.find((c) => c.id === dc.client_id);
      if (!client) continue;

      const company = companies.find((c) => c.id === client.company_id);
      if (!company) continue;

      const location = device.location_id ? locations.find((l) => l.id === device.location_id) ?? null : null;

      const isSelfClient = company.name.trim().toLowerCase() === client.name.trim().toLowerCase();
      if (isSelfClient) continue;

      const clientShareKwh = info.consumption * (dc.percentage / 100);
      const amount = clientShareKwh * unitPrice;
      const key = client.identifier ?? client.id;

      const existing = map.get(key);
      if (existing) {
        existing.kwhConsumed += clientShareKwh;
        existing.compensationAmount += amount;
      } else {
        map.set(key, {
          client,
          company,
          location,
          kwhConsumed: clientShareKwh,
          compensationAmount: amount,
        });
      }
    }

    const rows = Array.from(map.values());
    rows.sort((a, b) => {
      const compCmp = a.company.name.localeCompare(b.company.name);
      if (compCmp !== 0) return compCmp;
      return a.client.name.localeCompare(b.client.name);
    });

    return rows;
  }, [deviceClients, deviceConsumptions, clients, companies, locations, devices, selectedCompanyId, unitPrice]);

  // Group rows by company for display
  const groupedByCompany = useMemo(() => {
    const groups: { company: Company; rows: ClientCompensationRow[]; totalKwh: number; totalAmount: number }[] = [];
    for (const row of compensationRows) {
      const existing = groups.find((g) => g.company.id === row.company.id);
      if (existing) {
        existing.rows.push(row);
        existing.totalKwh += row.kwhConsumed;
        existing.totalAmount += row.compensationAmount;
      } else {
        groups.push({
          company: row.company,
          rows: [row],
          totalKwh: row.kwhConsumed,
          totalAmount: row.compensationAmount,
        });
      }
    }
    return groups;
  }, [compensationRows]);

  const grandTotalKwh = useMemo(() => compensationRows.reduce((sum, r) => sum + r.kwhConsumed, 0), [compensationRows]);
  const grandTotalAmount = useMemo(() => compensationRows.reduce((sum, r) => sum + r.compensationAmount, 0), [compensationRows]);

  const hasData = compensationRows.length > 0;

  // Format date as yyyymmdd
  const formatDateSAP = (dateStr: string): string => {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  // Get PRCTR for a company/location
  const getPrctr = (companyId: string, locationName: string | null): string => {
    if (companyId === '52ed2e37-1ecc-4026-94d6-17f52ee5fb36' && locationName) {
      return PRCTR_BY_LOCATION[locationName] ?? '221001';
    }
    return PRCTR_BY_COMPANY[companyId] ?? '';
  };

  // Get GSBER for a company/location
  const getGsber = (companyId: string, locationName: string | null): string => {
    if (companyId === '52ed2e37-1ecc-4026-94d6-17f52ee5fb36' && locationName) {
      return GSBER_BY_LOCATION[locationName] ?? '2211';
    }
    return GSBER_BY_COMPANY[companyId] ?? '';
  };

  const handleExportExcel = () => {
    if (!hasData) return;

    const bldat = formatDateSAP(manualDate);
    const budat = bldat;
    const [year, monthNum] = month.split('-');
    const sgtxt = `Компенсация ел.енергия ${monthNum} ${year}`;
    const bktxt = 'Компенсация ел.енергия ПМС';

    // Group rows by company to generate one document per company
    const dataRows: (string | number)[][] = [];
    let invoiceNumber = invoiceStartNumber;

    for (const group of groupedByCompany) {
      const bukrs = COMPANY_CODES[group.company.id] ?? '';
      if (!bukrs) continue;

      for (const row of group.rows) {
        const xblnr = String(invoiceNumber).padStart(10, '0');
        const wrbtr = Math.round(row.compensationAmount * 100) / 100;
        const newko = row.client.identifier ?? '';
        if (!newko) continue;

        const locationName = row.location?.name ?? null;
        const prctr = getPrctr(group.company.id, locationName);
        const gsberLine2 = getGsber(group.company.id, locationName);

        // Each SAP document is one row: header, debit and credit fields side by side.
        const dataRow: (string | number)[] = [
          '1', 'FB01', bldat, 'CN', bukrs, budat, 'EUR', xblnr, bktxt,
          '2', '40', 'X', '7030020040', wrbtr, '', '', '', prctr, '', '', '', sgtxt,
          '2', '14', 'X', newko, '', wrbtr, '', '', gsberLine2, xblnr, sgtxt,
        ];

        dataRows.push(dataRow);
        invoiceNumber++;
      }
    }

    // Build the worksheet with headers
    const wsData: (string | number)[][] = [SAP_COLUMNS as unknown as string[], ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = SAP_COLUMNS.map((col) => ({ wch: Math.max(col.length + 2, 12) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Компенсации');

    const fileName = `Компенсации_${month}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          <Icon name="ArrowLeft" size={18} />
          Обратно
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={!hasData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-40"
          >
            <Icon name="Download" size={16} />
            <span className="hidden sm:inline">Експорт в Excel</span>
          </button>
        </div>
      </div>

      {/* Title + selectors */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Справка компенсации</h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatMonthLabel(month)}
            {selectedCompanyId !== 'all' && companies.find((c) => c.id === selectedCompanyId)
              ? ` · ${companies.find((c) => c.id === selectedCompanyId)!.name}`
              : ''}
            {selectedLocationId !== 'all' && availableLocations.find((l) => l.id === selectedLocationId)
              ? ` · ${availableLocations.find((l) => l.id === selectedLocationId)!.name}`
              : ''}
            {' · '}{compensationRows.length} записа · общо {grandTotalAmount.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Фирма</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedLocationId('all'); }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="all">Всички фирми</option>
              {companiesWithElectricity.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {availableLocations.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Локация</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="all">Всички локации</option>
                {availableLocations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Месец</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>
        </div>
      </div>

      {/* Manual input fields */}
      <div className="mb-6 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="Settings" size={15} className="text-sky-500" />
          <span className="text-sm font-semibold text-slate-700">Параметри за експорт</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Дата на документа (BLDAT/BUDAT)</label>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Цена за kWh (€)</label>
            <input
              type="number"
              step="0.00001"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm font-semibold text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Начален номер фактура (XBLNR)</label>
            <input
              type="number"
              min="1"
              value={invoiceStartNumber}
              onChange={(e) => setInvoiceStartNumber(Math.max(1, Math.floor(parseFloat(e.target.value) || 1)))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm font-semibold text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Сумата (WRBTR) за всеки клиент = потребени kWh × цена. Номерът на фактурата (XBLNR) е ръчно въведеният пореден номер, който се увеличава с 1 за всеки следващ клиент.
        </p>
      </div>

      {/* Summary cards */}
      {hasData && (
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                <Icon name="Zap" size={14} className="text-amber-600" />
              </div>
              <span className="text-xs font-medium text-slate-500">Общо потребени kWh</span>
            </div>
            <p className="text-lg font-bold text-slate-900">
              {grandTotalKwh.toLocaleString('bg-BG', { maximumFractionDigits: 3 })} <span className="text-sm font-medium text-slate-400">kWh</span>
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                <Icon name="Euro" size={14} className="text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-slate-500">Обща сума компенсации</span>
            </div>
            <p className="text-lg font-bold text-slate-900">
              {grandTotalAmount.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-medium text-slate-400">€</span>
            </p>
          </div>
        </div>
      )}

      {/* Report table */}
      {!hasData ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Icon name="FileText" size={22} className="text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">
            Няма данни за компенсации за {formatMonthLabel(month)}.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Уверете се, че има въведени показания за електромерите за текущия и предходния месец.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByCompany.map((group) => (
            <div key={group.company.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Company header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                    <Icon name="Building2" size={18} className="text-sky-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{group.company.name}</h3>
                    <p className="text-xs text-slate-400">
                      BUKRS: {COMPANY_CODES[group.company.id] ?? '—'}
                      {' · '}{group.rows.length} клиента
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">
                    {group.totalKwh.toLocaleString('bg-BG', { maximumFractionDigits: 3 })} kWh
                  </div>
                  <p className="text-lg font-bold text-slate-900">
                    {group.totalAmount.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>
                </div>
              </div>

              {/* Clients table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2.5 pl-5 text-left font-medium text-slate-400">Клиент</th>
                      <th className="py-2.5 text-left font-medium text-slate-400">SAP номер</th>
                      <th className="py-2.5 text-left font-medium text-slate-400">Локация</th>
                      <th className="py-2.5 text-right font-medium text-slate-400">Потребени kWh</th>
                      <th className="py-2.5 text-right font-medium text-slate-400">PRCTR</th>
                      <th className="py-2.5 text-right font-medium text-slate-400">GSBER</th>
                      <th className="py-2.5 pr-5 text-right font-medium text-slate-400">Сума (€)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {group.rows.map((row) => {
                      const locationName = row.location?.name ?? null;
                      const prctr = getPrctr(group.company.id, locationName);
                      const gsber = getGsber(group.company.id, locationName);
                      return (
                        <tr key={row.client.id} className="hover:bg-slate-50/30">
                          <td className="py-3 pl-5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                                {row.client.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-slate-700">{row.client.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-slate-600 font-mono text-xs">{row.client.identifier ?? '—'}</td>
                          <td className="py-3 text-slate-500">{locationName ?? '—'}</td>
                          <td className="py-3 text-right text-slate-600">
                            {row.kwhConsumed.toLocaleString('bg-BG', { maximumFractionDigits: 3 })}
                          </td>
                          <td className="py-3 text-right text-slate-500 font-mono text-xs">{prctr}</td>
                          <td className="py-3 text-right text-slate-500 font-mono text-xs">{gsber}</td>
                          <td className="py-3 pr-5 text-right font-semibold text-slate-900">
                            {row.compensationAmount.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-100 bg-slate-50/30">
                      <td colSpan={3} className="py-3 pl-5 text-right font-medium text-slate-500">Общо:</td>
                      <td className="py-3 text-right font-medium text-slate-600">
                        {group.totalKwh.toLocaleString('bg-BG', { maximumFractionDigits: 3 })}
                      </td>
                      <td colSpan={2} />
                      <td className="py-3 pr-5 text-right font-bold text-slate-900">
                        {group.totalAmount.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          {/* Grand total */}
          <div className="flex items-center justify-between rounded-2xl border-2 border-slate-300 bg-slate-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
                <Icon name="Sigma" size={18} className="text-white" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-700">Общо за всички фирми</span>
                <p className="text-xs text-slate-400">{grandTotalKwh.toLocaleString('bg-BG', { maximumFractionDigits: 3 })} kWh</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {grandTotalAmount.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

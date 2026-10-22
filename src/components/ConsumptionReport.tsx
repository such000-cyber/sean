import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { Device, Reading, Company, Client, DeviceClientWithClient, SupplierInvoice, Supplier, DeviceType, CompanyLocation, DeviceDependency } from '@/lib/supabase';
import { computeNetConsumptions, type NetConsumption } from '@/lib/consumption';
import { DEVICE_TYPE_LABELS, DEVICE_TYPE_ICONS, SERVICE_TYPE_LABELS } from '@/lib/supabase';
import { Icon } from './Icon';

interface ConsumptionReportProps {
  devices: Device[];
  readings: Reading[];
  deviceDependencies: DeviceDependency[];
  companies: Company[];
  clients: Client[];
  deviceClients: DeviceClientWithClient[];
  suppliers: Supplier[];
  supplierInvoices: SupplierInvoice[];
  locations: CompanyLocation[];
  onBack: () => void;
}

const MONTH_NAMES_BG = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
];

function formatValue(v: number): string {
  return v.toLocaleString('bg-BG', { maximumFractionDigits: 3 });
}

function formatMoney(v: number): string {
  return v.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatUnitPrice(v: number): string {
  return v.toLocaleString('bg-BG', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-');
  return `${MONTH_NAMES_BG[parseInt(m) - 1]} ${y}`;
}

const DEVICE_TYPE_TO_SERVICE: Record<DeviceType, string> = {
  electricity: 'electricity',
  water: 'water',
  gas: 'gas',
  heat: 'heat',
  other: 'other',
};

const EXPORT_COLUMNS = [
  'SAP номер',
  'Наименование на фирма',
  'Електроенергия',
  'Вода',
  'Вода база',
  'Сметоизвозване',
  'Мотокар с оператор',
  'Контейнер',
  'Консумативи по дог.',
] as const;

function getDeviceServiceColumn(device: Device): string | null {
  if (device.type === 'electricity') return 'Електроенергия';
  if (device.type === 'water') return device.is_base ? 'Вода база' : 'Вода';
  const name = device.name.toLowerCase();
  if (name.includes('смето')) return 'Сметоизвозване';
  if (name.includes('мотокар')) return 'Мотокар с оператор';
  if (name.includes('контейнер')) return 'Контейнер';
  if (name.includes('консуматив')) return 'Консумативи по дог.';
  return null;
}

interface ClientConsumption {
  client: Client;
  company: Company | null;
  isSelfClient: boolean;
  devices: {
    device: Device;
    consumption: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }[];
  totalConsumptionByType: Record<string, { value: number; unit: string; amount: number }>;
  totalAmount: number;
}

export function ConsumptionReport({
  devices,
  readings,
  deviceDependencies,
  companies,
  clients,
  deviceClients,
  suppliers,
  supplierInvoices,
  locations,
  onBack,
}: ConsumptionReportProps) {
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [month, setMonth] = useState(currentMonthStr);
  const [waterUnitPrice, setWaterUnitPrice] = useState(255.65);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  // Locations available for the selected company
  const availableLocations = useMemo(() => {
    if (selectedCompanyId === 'all') return [];
    return locations.filter((l) => l.company_id === selectedCompanyId).sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, selectedCompanyId]);

  // Companies that have at least one client with consumption data
  const companiesWithClients = useMemo(() => {
    const clientCompanyIds = new Set(clients.map((c) => c.company_id).filter(Boolean));
    return companies.filter((c) => clientCompanyIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, clients]);

  const filteredClients = useMemo(() => {
    if (selectedCompanyId === 'all') return clients;
    return clients.filter((c) => c.company_id === selectedCompanyId);
  }, [clients, selectedCompanyId]);

  const devicesForReport = useMemo(() => {
    let result = devices;
    if (selectedCompanyId !== 'all') {
      result = result.filter((device) => device.company_id === selectedCompanyId);
    }
    if (selectedLocationId !== 'all') {
      result = result.filter((device) => device.location_id === selectedLocationId);
    }
    return result;
  }, [devices, selectedCompanyId, selectedLocationId]);

  // Filter supplier invoices by location when a location is selected
  const locationFilteredInvoices = useMemo(() => {
    if (selectedLocationId === 'all') return supplierInvoices;
    return supplierInvoices.filter((inv) => {
      const supplier = suppliers.find((s) => s.id === inv.supplier_id);
      return supplier?.location_id === selectedLocationId;
    });
  }, [supplierInvoices, suppliers, selectedLocationId]);

  // Compute unit prices from supplier invoices for the selected month, keyed by company+location+price group.
  // Key format: "<companyId>|<locationId>|<serviceKey>|<priceGroup>" (priceGroup е празно за фактури без група).
  // All invoice amounts for the same service type within a company+location are summed, but the quantity
  // is taken once (e.g. network + energy suppliers bill the same kWh).
  const unitPricesByCompany = useMemo(() => {
    const groups: Record<string, { totalAmount: number; quantity: number; unit: string; supplierNames: Set<string> }> = {};
    for (const inv of locationFilteredInvoices) {
      if (inv.service_month !== month) continue;
      const supplier = suppliers.find((s) => s.id === inv.supplier_id);
      if (!supplier) continue;
      const serviceKey = DEVICE_TYPE_TO_SERVICE[supplier.service_type as DeviceType] ?? 'other';
      const compKey = `${supplier.company_id ?? 'null'}|${supplier.location_id ?? 'null'}|${serviceKey}|${(inv.price_group ?? '').trim()}`;
      if (!groups[compKey]) {
        groups[compKey] = { totalAmount: 0, quantity: Number(inv.quantity), unit: inv.unit, supplierNames: new Set() };
      }
      groups[compKey].totalAmount += Number(inv.amount);
      groups[compKey].supplierNames.add(supplier.name);
    }
    const prices: Record<string, { price: number; unit: string; supplierName: string }> = {};
    for (const [key, g] of Object.entries(groups)) {
      if (g.quantity > 0) {
        prices[key] = {
          price: Math.round((g.totalAmount / g.quantity) * 100000) / 100000,
          unit: g.unit,
          supplierName: Array.from(g.supplierNames).join(', '),
        };
      }
    }
    return prices;
  }, [locationFilteredInvoices, suppliers, month]);

  // Flattened prices for display — when a specific company is selected, only show that company's prices.
  // When "all" companies are selected, show the first non-null company's price per service.
  const effectivePrices = useMemo(() => {
    const result: Record<string, { price: number; unit: string; supplierName: string }> = {};
    for (const [key, val] of Object.entries(unitPricesByCompany)) {
      const [compId, locId, serviceKey, group] = key.split('|');
      if (selectedCompanyId !== 'all' && compId !== selectedCompanyId) continue;
      if (selectedLocationId !== 'all' && locId !== selectedLocationId) continue;
      const displayKey = group ? `${serviceKey}|${group}` : serviceKey;
      if (!result[displayKey]) result[displayKey] = val;
    }
    return result;
  }, [unitPricesByCompany, selectedCompanyId, selectedLocationId]);

  // Ключ на цената за уред: с ценовата му група, ако за нея има фактура за месеца; иначе общата цена.
  const priceKeyFor = (device: Device): string => {
    const base = `${device.company_id ?? 'null'}|${device.location_id ?? 'null'}|${DEVICE_TYPE_TO_SERVICE[device.type]}|`;
    const group = (device.price_group ?? '').trim();
    return group && unitPricesByCompany[base + group] ? base + group : base;
  };

  // "Base" devices (is_base = true) use a manually-set unit price instead of invoice-derived pricing.
  // Only base water devices are shown with the manual price input; other base devices fall back to 0 if no invoice.
  const hasBaseWaterDevices = useMemo(
    () => devicesForReport.some((d) => d.type === 'water' && d.is_base),
    [devicesForReport]
  );

  const baseWaterUnit = useMemo(
    () => devicesForReport.find((d) => d.type === 'water' && d.is_base)?.unit ?? 'm³',
    [devicesForReport]
  );

  // Нето консумация за ВСИЧКИ уреди за месеца (нужна е и за загубите по абонат,
  // независимо от филтрите). Нето = бруто − Σ бруто на изважданите подуреди.
  const netConsumptions = useMemo(
    () => computeNetConsumptions(devices, readings, deviceDependencies, `${month}-01`),
    [devices, readings, deviceDependencies, month],
  );

  const deviceConsumptions = useMemo(() => {
    const result: Record<string, { consumption: number; unit: string } | null> = {};
    for (const device of devicesForReport) {
      const n = netConsumptions.get(device.id);
      result[device.id] = n ? { consumption: n.net, unit: device.unit } : null;
    }
    return result;
  }, [devicesForReport, netConsumptions]);

  // For non-base water devices, the price comes from supplier invoices (same as electricity).
  // Base devices get their price from the manual input; non-base devices use the invoice-derived price.

  // Коефициент на загубите за ток по абонат (фирма + локация), както в Excel:
  //   цена със загуби = сума по фактури / Σ нето kWh на всички уреди на абоната
  //   => коефициент = доставени kWh (по фактура) / Σ нето kWh − 1
  // Σ нето kWh = сборът на „контролните“ уреди, защото нето на главния + подуредите = бруто на главния.
  // Ключ: "<companyId>|<locationId>" (същият като за цените).
  const electricityLoss = useMemo(() => {
    const delivered: Record<string, number> = {};
    // количеството се взима веднъж на група (мрежа + доставка фактурират едни и същи kWh)
    const seenQty = new Set<string>();
    for (const inv of locationFilteredInvoices) {
      if (inv.service_month !== month) continue;
      const supplier = suppliers.find((s) => s.id === inv.supplier_id);
      if (!supplier || supplier.service_type !== 'electricity') continue;
      const key = `${supplier.company_id ?? 'null'}|${supplier.location_id ?? 'null'}|electricity|${(inv.price_group ?? '').trim()}`;
      if (seenQty.has(key)) continue;
      seenQty.add(key);
      delivered[key] = Number(inv.quantity);
    }
    const consumed: Record<string, number> = {};
    for (const n of netConsumptions.values()) {
      if (n.device.type !== 'electricity') continue;
      const key = priceKeyFor(n.device);
      consumed[key] = (consumed[key] ?? 0) + n.net;
    }
    const result: Record<string, number> = {};
    for (const key of Object.keys(delivered)) {
      const d = delivered[key];
      const c = consumed[key] ?? 0;
      result[key] = d > 0 && c > 0 ? d / c - 1 : 0;
    }
    return { coefficients: result, delivered, consumed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFilteredInvoices, suppliers, month, netConsumptions, unitPricesByCompany]);

  const electricityLossCoefficients = electricityLoss.coefficients;

  // Проверка по абонат: доставени kWh по фактура срещу сбор нето kWh от уредите.
  // Ако уредите са повече от фактурата, най-често на някой главен уред липсват подуредите,
  // които трябва да изважда, и консумацията се брои два пъти.
  const electricityCheckRows = useMemo(() => {
    return Object.keys(electricityLoss.delivered)
      .filter((key) => {
        const [compId, locId] = key.split('|');
        if (selectedCompanyId !== 'all' && compId !== selectedCompanyId) return false;
        if (selectedLocationId !== 'all' && locId !== selectedLocationId) return false;
        return true;
      })
      // фактура без уреди (напр. стара обща фактура, заменена от фактури по абонат) не се показва
      .filter((key) => (electricityLoss.consumed[key] ?? 0) !== 0)
      .map((key) => {
        const [compId, locId, , group] = key.split('|');
        const delivered = electricityLoss.delivered[key];
        const consumed = electricityLoss.consumed[key] ?? 0;
        const company = companies.find((c) => c.id === compId);
        const location = locations.find((l) => l.id === locId);
        const negatives = (Array.from(netConsumptions.values()) as NetConsumption[]).filter(
          (n) => n.device.type === 'electricity' && priceKeyFor(n.device) === key && n.net < 0,
        );
        return {
          key,
          label: [company?.name, location?.name, group || null].filter(Boolean).join(' · ') || 'Без фирма',
          delivered,
          consumed,
          lossPct: consumed > 0 ? (delivered / consumed - 1) * 100 : 0,
          negatives,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electricityLoss, selectedCompanyId, selectedLocationId, companies, locations, netConsumptions, unitPricesByCompany]);


  // Build report grouped by client
  const reportData = useMemo(() => {
    const clientMap: Record<string, ClientConsumption> = {};

    for (const client of filteredClients) {
      const company = companies.find((c) => c.id === client.company_id) ?? null;
      const isSelfClient = !!company && company.name.trim().toLowerCase() === client.name.trim().toLowerCase();
      clientMap[client.id] = {
        client,
        company,
        isSelfClient,
        devices: [],
        totalConsumptionByType: {},
        totalAmount: 0,
      };
    }

    for (const dc of deviceClients) {
      const clientEntry = clientMap[dc.client_id];
      if (!clientEntry) continue;

      const device = devicesForReport.find((d) => d.id === dc.device_id);
      if (!device) continue;

      const consumptionData = deviceConsumptions[device.id];
      if (!consumptionData || consumptionData.consumption === 0) continue;

      const clientShare = consumptionData.consumption * (dc.percentage / 100);
      const serviceKey = DEVICE_TYPE_TO_SERVICE[device.type];

      let unitPrice: number;
      if (device.is_base && device.type === 'water') {
        unitPrice = waterUnitPrice;
      } else {
        const compKey = priceKeyFor(device);
        const priceInfo = unitPricesByCompany[compKey] ?? (selectedCompanyId === 'all' ? effectivePrices[serviceKey] : undefined);
        unitPrice = priceInfo?.price ?? 0;
      }
      const amount = clientShare * unitPrice;
      const isElectricityDevice = device.type === 'electricity';
      const deviceLossCoeff = electricityLossCoefficients[priceKeyFor(device)] ?? 0;
      const finalAmount = isElectricityDevice ? amount * (1 + deviceLossCoeff) : amount;

      clientEntry.devices.push({
        device,
        consumption: clientShare,
        unit: consumptionData.unit,
        unitPrice: isElectricityDevice ? unitPrice * (1 + deviceLossCoeff) : unitPrice,
        amount: finalAmount,
      });

      const typeKey = serviceKey;
      if (!clientEntry.totalConsumptionByType[typeKey]) {
        clientEntry.totalConsumptionByType[typeKey] = { value: 0, unit: consumptionData.unit, amount: 0 };
      }
      clientEntry.totalConsumptionByType[typeKey].value += clientShare;
      clientEntry.totalConsumptionByType[typeKey].amount += finalAmount;
      clientEntry.totalAmount += finalAmount;
    }

    // Sort devices within each client by manual sort_order
    for (const entry of Object.values(clientMap)) {
      entry.devices.sort((a, b) => {
        if (a.device.sort_order !== b.device.sort_order) return a.device.sort_order - b.device.sort_order;
        return a.device.name.localeCompare(b.device.name);
      });
    }

    // Sort: self-clients last, then by company, then by client name
    return Object.values(clientMap)
      .filter((c) => c.devices.length > 0)
      .sort((a, b) => {
        if (a.isSelfClient !== b.isSelfClient) return a.isSelfClient ? 1 : -1;
        const compCmp = (a.company?.name ?? '—').localeCompare(b.company?.name ?? '—');
        if (compCmp !== 0) return compCmp;
        return a.client.name.localeCompare(b.client.name);
      });
  }, [filteredClients, companies, deviceClients, devicesForReport, deviceConsumptions, effectivePrices, unitPricesByCompany, electricityLossCoefficients, selectedCompanyId, selectedLocationId]);

  // Group by company
  const groupedByCompany = useMemo(() => {
    const groups: { company: Company | null; clients: ClientConsumption[]; companyTotal: number }[] = [];
    for (const entry of reportData) {
      const existing = groups.find((g) => (g.company?.id ?? null) === (entry.company?.id ?? null));
      if (existing) {
        existing.clients.push(entry);
        existing.companyTotal += entry.totalAmount;
      } else {
        groups.push({
          company: entry.company,
          clients: [entry],
          companyTotal: entry.totalAmount,
        });
      }
    }
    return groups;
  }, [reportData]);

  const grandTotal = useMemo(() => reportData.reduce((sum, c) => sum + c.totalAmount, 0), [reportData]);

  const exportableTotal = useMemo(
    () => reportData.filter((c) => !c.isSelfClient).reduce((sum, c) => sum + c.totalAmount, 0),
    [reportData],
  );

  const selfClientEntries = useMemo(
    () => reportData.filter((c) => c.isSelfClient),
    [reportData],
  );

  // Total physical consumption aggregated by unit (kWh, m³, etc.) across all devices
  const totalsByUnit = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const device of devicesForReport) {
      const data = deviceConsumptions[device.id];
      if (!data || data.consumption <= 0) continue;
      totals[data.unit] = (totals[data.unit] ?? 0) + data.consumption;
    }
    return totals;
  }, [devicesForReport, deviceConsumptions]);

  // Total consumption by device type (electricity → kWh, water → m³, etc.)
  const totalsByType = useMemo(() => {
    const totals: Record<string, { value: number; unit: string }> = {};
    for (const device of devicesForReport) {
      const data = deviceConsumptions[device.id];
      if (!data || data.consumption <= 0) continue;
      const typeKey = DEVICE_TYPE_TO_SERVICE[device.type];
      if (!totals[typeKey]) {
        totals[typeKey] = { value: 0, unit: data.unit };
      }
      totals[typeKey].value += data.consumption;
    }
    return totals;
  }, [devicesForReport, deviceConsumptions]);

  const hasData = reportData.length > 0;
  const hasPrices = Object.keys(effectivePrices).length > 0 || hasBaseWaterDevices;
  const showPricesPanel = hasPrices;

  const handleExportExcel = () => {
    const data: (string | number)[][] = [EXPORT_COLUMNS as unknown as string[]];

    for (const entry of reportData) {
      // Skip self-clients (company that is also its own client)
      if (entry.isSelfClient) continue;
      const row: Record<string, number> = {};
      for (const col of EXPORT_COLUMNS) row[col] = 0;

      for (const { device, amount } of entry.devices) {
        const col = getDeviceServiceColumn(device);
        if (!col) continue;
        row[col] += amount;
      }

      const dataRow: (string | number)[] = [
        entry.client.identifier ?? '',
        entry.client.name,
      ];
      for (let i = 2; i < EXPORT_COLUMNS.length; i++) {
        const val = row[EXPORT_COLUMNS[i]];
        dataRow.push(val > 0 ? Math.round(val * 100) / 100 : '');
      }
      data.push(dataRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = EXPORT_COLUMNS.map((col) => ({ wch: Math.max(col.length + 2, 14) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Справка');
    const fileName = selectedCompanyId !== 'all'
      ? `Справка_${companies.find((c) => c.id === selectedCompanyId)?.name ?? ''}_${month}.xlsx`
      : `Справка_${month}.xlsx`;
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
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
          >
            <Icon name="Printer" size={16} />
            <span className="hidden sm:inline">Печат</span>
          </button>
        </div>
      </div>

      {/* Title + month selector */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Справка за потреблението</h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatMonthLabel(month)}
            {selectedCompanyId !== 'all' && companies.find((c) => c.id === selectedCompanyId)
              ? ` · ${companies.find((c) => c.id === selectedCompanyId)!.name}`
              : ''}
            {selectedLocationId !== 'all' && availableLocations.find((l) => l.id === selectedLocationId)
              ? ` · ${availableLocations.find((l) => l.id === selectedLocationId)!.name}`
              : ''}
            {' · '}{reportData.length} клиента · общо {formatMoney(grandTotal)} €
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
              {companiesWithClients.map((c) => (
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

      {/* Consumption totals by unit for the selected month */}
      {hasData && Object.keys(totalsByUnit).length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(totalsByUnit).map(([unit, total]) => {
            const isElectricity = unit.toLowerCase().includes('kwh');
            const isWater = unit.toLowerCase().includes('m') || unit === 'm³';
            const cardClass = isElectricity
              ? 'border-amber-100 bg-amber-50/40'
              : isWater
              ? 'border-sky-100 bg-sky-50/40'
              : 'border-slate-200 bg-slate-50/40';
            const iconBgClass = isElectricity ? 'bg-amber-100' : isWater ? 'bg-sky-100' : 'bg-slate-200';
            const iconTextClass = isElectricity ? 'text-amber-600' : isWater ? 'text-sky-600' : 'text-slate-500';
            const label = isElectricity ? 'Електроенергия' : isWater ? 'Вода' : unit;
            const iconName = isElectricity ? 'Zap' : isWater ? 'Droplets' : 'Gauge';
            return (
              <div key={unit} className={`rounded-xl border p-4 ${cardClass}`}>
                <div className="mb-1.5 flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBgClass}`}>
                    <Icon name={iconName} size={14} className={iconTextClass} />
                  </div>
                  <span className="text-xs font-medium text-slate-500">{label}</span>
                </div>
                <p className="text-lg font-bold text-slate-900">
                  {formatValue(total)} <span className="text-sm font-medium text-slate-400">{unit}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Unit prices info */}
      {showPricesPanel && (
        <div className="mb-6 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon name="Info" size={15} className="text-sky-500" />
            <span className="text-sm font-semibold text-slate-700">Цени за {formatMonthLabel(month)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {Object.entries(effectivePrices)
              .filter(([key]) => key !== 'water')
              .map(([key, info]) => (
                <span key={key} className="text-xs text-slate-600">
                  <span className="font-medium text-slate-700">
                    {SERVICE_TYPE_LABELS[key.split('|')[0] as keyof typeof SERVICE_TYPE_LABELS] ?? key.split('|')[0]}
                    {key.includes('|') ? ` – ${key.split('|')[1]}` : ''}
                  </span>:
                  {' '}{formatUnitPrice(info.price)} €/{info.unit}
                  <span className="text-slate-400"> ({info.supplierName})</span>
                </span>
              ))}
            {hasBaseWaterDevices && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Вода (базова):</span>
                <div className="relative inline-flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={waterUnitPrice}
                    onChange={(e) => setWaterUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-24 rounded-lg border border-sky-200 bg-white px-2 py-1 text-right text-sm font-semibold text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <span className="ml-1 text-slate-500">€/{baseWaterUnit}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Проверка на тока по абонат */}
      {hasData && electricityCheckRows.length > 0 && (
        <div className="mb-6 space-y-2">
          {electricityCheckRows.map((row) => {
            const bad = row.consumed > row.delivered;
            return (
              <div
                key={row.key}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${bad ? 'border-red-200 bg-red-50/60' : 'border-amber-100 bg-amber-50/40'}`}
              >
                <Icon name={bad ? 'AlertTriangle' : 'Zap'} size={18} className={`mt-0.5 shrink-0 ${bad ? 'text-red-500' : 'text-amber-500'}`} />
                <div className={`text-sm ${bad ? 'text-red-800' : 'text-amber-800'}`}>
                  <p>
                    <span className="font-semibold">Ток – {row.label}:</span> по фактура {formatValue(row.delivered)} kWh,
                    {' '}сбор от уредите {formatValue(Math.round(row.consumed))} kWh,
                    {' '}загуби <span className="font-bold">{row.lossPct.toFixed(2)}%</span>
                    {' '}(цената за kWh се увеличава/намалява с толкова, за да се покрие фактурата).
                  </p>
                  {bad && (
                    <p className="mt-1">
                      Уредите показват с {formatValue(Math.round(row.consumed - row.delivered))} kWh повече от фактурата.
                      {' '}Най-вероятно на някой главен уред не са зададени подуредите, които трябва да изважда, и консумацията се брои два пъти.
                      {' '}Проверете полето „Изважда“ на главните уреди.
                    </p>
                  )}
                  {row.negatives.length > 0 && (
                    <p className="mt-1">
                      Отрицателно нето (подуредите са повече от главния): {row.negatives.map((n) => `${n.device.name} (${formatValue(n.net)})`).join(', ')}.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasPrices && hasData && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3.5">
          <Icon name="AlertTriangle" size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800">
            Няма въведени фактури от доставчици за {formatMonthLabel(month)}. Сумите за фактуриране ще бъдат 0.00 €.
            Добавете фактури в раздел "Доставчици", за да се изчислят цените.
          </p>
        </div>
      )}

      {/* Report */}
      {!hasData ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Icon name="FileText" size={22} className="text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">
            Няма данни за потребление за {formatMonthLabel(month)}.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Уверете се, че има въведени показания за текущия и предходния месец.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByCompany.map((group) => (
            <div key={group.company?.id ?? 'no-company'} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Company header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                    <Icon name="Building2" size={18} className="text-sky-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{group.company?.name ?? 'Без фирма'}</h3>
                    {group.company?.bulstat && <p className="text-xs text-slate-400">ЕИК: {group.company.bulstat}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Общо за фирмата</span>
                  <p className="text-lg font-bold text-slate-900">{formatMoney(group.companyTotal)} €</p>
                </div>
              </div>

              {/* Clients */}
              <div className="divide-y divide-slate-100">
                {group.clients.map((clientEntry) => (
                  <div key={clientEntry.client.id} className="p-5">
                    {/* Client header */}
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                          {clientEntry.client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {clientEntry.client.name}
                            {clientEntry.isSelfClient && (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                <Icon name="Info" size={10} />
                                не се фактурира
                              </span>
                            )}
                          </p>
                          {clientEntry.client.identifier && <p className="text-xs text-slate-400">{clientEntry.client.identifier}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400">Сума за фактуриране (без ДДС)</span>
                        <p className="text-base font-bold text-slate-900">{formatMoney(clientEntry.totalAmount)} €</p>
                      </div>
                    </div>

                    {/* Devices table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-2 text-left font-medium text-slate-400">Уред</th>
                            <th className="py-2 text-left font-medium text-slate-400">Тип</th>
                            <th className="py-2 text-right font-medium text-slate-400">Потребление</th>
                            <th className="py-2 text-right font-medium text-slate-400">Цена/ед.</th>
                            <th className="py-2 text-right font-medium text-slate-400">Сума без ДДС</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {clientEntry.devices.map(({ device, consumption, unit, unitPrice, amount }) => (
                            <tr key={device.id} className="hover:bg-slate-50/30">
                              <td className="py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: device.color }} />
                                  <span className="font-medium text-slate-700">{device.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5">
                                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                  <Icon name={DEVICE_TYPE_ICONS[device.type]} size={12} />
                                  {DEVICE_TYPE_LABELS[device.type]}
                                </span>
                              </td>
                              <td className="py-2.5 text-right text-slate-600">
                                {formatValue(consumption)} {unit}
                              </td>
                              <td className="py-2.5 text-right text-slate-500">
                                {unitPrice > 0 ? `${formatUnitPrice(unitPrice)} €/${unit}` : '—'}
                              </td>
                              <td className="py-2.5 text-right font-semibold text-slate-900">
                                {formatMoney(amount)} €
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-100">
                            <td colSpan={4} className="py-2.5 text-right font-medium text-slate-500">Общо:</td>
                            <td className="py-2.5 text-right font-bold text-slate-900">{formatMoney(clientEntry.totalAmount)} €</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Totals summary */}
          <div className="space-y-3">
            {/* Exportable companies total */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100">
                  <Icon name="Building2" size={16} className="text-sky-600" />
                </div>
                <span className="text-sm font-semibold text-slate-600">Сума за фактуриране към външни клиенти (без ДДС)</span>
              </div>
              <span className="text-xl font-bold text-slate-900">{formatMoney(exportableTotal)} €</span>
            </div>

            {/* Self-client totals */}
            {selfClientEntries.length > 0 && selfClientEntries.map((entry) => (
              <div key={entry.client.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/50 px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200">
                    <Icon name="Info" size={16} className="text-slate-500" />
                  </div>
                  <span className="text-sm font-semibold text-slate-500">{entry.client.name} (без фактуриране)</span>
                </div>
                <span className="text-xl font-bold text-slate-500">{formatMoney(entry.totalAmount)} €</span>
              </div>
            ))}

            {/* Grand total */}
            <div className="flex items-center justify-between rounded-2xl border-2 border-slate-300 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
                  <Icon name="Sigma" size={18} className="text-white" />
                </div>
                <span className="text-sm font-bold text-slate-700">Обща сума (без ДДС)</span>
              </div>
              <span className="text-2xl font-bold text-slate-900">{formatMoney(grandTotal)} €</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

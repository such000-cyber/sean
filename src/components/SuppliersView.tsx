import { useState, useMemo } from 'react';
import type { Supplier, SupplierInvoice, ServiceType, Company, CompanyLocation } from '@/lib/supabase';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_ICONS } from '@/lib/supabase';
import { Icon } from './Icon';
import { SupplierInvoiceForm } from './SupplierInvoiceForm';

interface SuppliersViewProps {
  suppliers: Supplier[];
  invoices: SupplierInvoice[];
  companies: Company[];
  locations: CompanyLocation[];
  isAdmin: boolean;
  onSaveSupplier: (data: { name: string; service_type: ServiceType; company_id: string | null; location_id: string | null; bulstat: string | null; address: string | null; phone: string | null; email: string | null }) => Promise<void>;
  onDeleteSupplier: (supplier: Supplier) => Promise<void>;
  onSaveInvoice: (supplierId: string, data: { invoice_number: string; invoice_date: string; service_month: string; quantity: number; unit: string; amount: number; vat_amount: number; total_amount: number; note: string | null; price_group?: string | null; id?: string }) => Promise<void>;
  onDeleteInvoice: (invoice: SupplierInvoice) => Promise<void>;
  onBack: () => void;
}

const MONTH_NAMES_BG = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
];

function formatMoney(v: number): string {
  return v.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-');
  return `${MONTH_NAMES_BG[parseInt(m) - 1]} ${y}`;
}

interface SupplierExpandedProps {
  supplier: Supplier;
  invs: SupplierInvoice[];
  confirmDeleteSupplier: string | null;
  confirmDeleteInvoice: string | null;
  isAdmin: boolean;
  onToggle: (id: string) => void;
  onAddInvoice: (s: Supplier) => void;
  onEditInvoice: (inv: SupplierInvoice, s: Supplier) => void;
  onDeleteInvoice: (inv: SupplierInvoice) => void;
  onDeleteSupplier: (s: Supplier) => void;
  setConfirmDeleteSupplier: (id: string | null) => void;
  setConfirmDeleteInvoice: (id: string | null) => void;
  formatMonthLabel: (m: string) => string;
  formatMoney: (v: number) => string;
  totalBySupplier: (id: string) => number;
}

function SupplierExpanded({
  supplier, invs, confirmDeleteSupplier, confirmDeleteInvoice, isAdmin,
  onToggle, onAddInvoice, onEditInvoice, onDeleteInvoice, onDeleteSupplier,
  setConfirmDeleteSupplier, setConfirmDeleteInvoice,
  formatMonthLabel, formatMoney,
}: SupplierExpandedProps) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/30">
      <div className="flex items-center justify-between px-5 py-3">
        <h4 className="text-sm font-semibold text-slate-600">Фактури</h4>
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddInvoice(supplier); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-sky-700"
          >
            <Icon name="Plus" size={14} />
            Нова фактура
          </button>
        )}
      </div>

      {invs.length === 0 ? (
        <div className="px-5 pb-5 text-center text-sm text-slate-400">Няма фактури за този доставчик</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-white/50">
                <th className="px-5 py-2.5 text-left font-medium text-slate-400">Месец</th>
                <th className="px-5 py-2.5 text-left font-medium text-slate-400">№ фактура</th>
                <th className="px-5 py-2.5 text-left font-medium text-slate-400">Дата</th>
                <th className="px-5 py-2.5 text-right font-medium text-slate-400">Количество</th>
                <th className="px-5 py-2.5 text-right font-medium text-slate-400">Сума</th>
                <th className="px-5 py-2.5 text-center font-medium text-slate-400">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invs.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-white/60">
                  <td className="px-5 py-3 font-medium text-slate-700">{formatMonthLabel(inv.service_month)}</td>
                  <td className="px-5 py-3 text-slate-600">{inv.invoice_number}{inv.price_group ? <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">{inv.price_group}</span> : null}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Date(inv.invoice_date).toLocaleDateString('bg-BG')}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {Number(inv.quantity).toLocaleString('bg-BG')} {inv.unit}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div>
                      <span className="font-semibold text-slate-900">{formatMoney(Number(inv.total_amount))} €</span>
                      {Number(inv.vat_amount) > 0 && (
                        <span className="block text-xs text-slate-400">
                          без ДДС: {formatMoney(Number(inv.amount))} €
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditInvoice(inv, supplier); }}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600"
                        >
                          <Icon name="Edit3" size={14} />
                        </button>
                      )}
                      {isAdmin && (
                        confirmDeleteInvoice === inv.id ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteInvoice(inv); setConfirmDeleteInvoice(null); }}
                            className="rounded-lg bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                          >
                            Потвърди
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteInvoice(inv.id); }}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <Icon name="Trash2" size={14} />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end border-t border-slate-100 px-5 py-3">
        {isAdmin && (
          confirmDeleteSupplier === supplier.id ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Сигурни ли сте? Това ще изтрие всички фактури.</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSupplier(supplier); setConfirmDeleteSupplier(null); }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Изтрий
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteSupplier(null); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                Отказ
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteSupplier(supplier.id); }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 transition-colors hover:text-red-700"
            >
              <Icon name="Trash2" size={13} />
              Изтрий доставчика
            </button>
          )
        )}
      </div>
    </div>
  );
}

export function SuppliersView({
  suppliers,
  invoices,
  companies,
  locations,
  isAdmin,
  onSaveSupplier,
  onDeleteSupplier,
  onSaveInvoice,
  onDeleteInvoice,
  onBack,
}: SuppliersViewProps) {
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [confirmDeleteSupplier, setConfirmDeleteSupplier] = useState<string | null>(null);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState<string | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SupplierInvoice | null>(null);
  const [invoiceFormSupplier, setInvoiceFormSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supplierInvoices = useMemo(() => {
    const map: Record<string, SupplierInvoice[]> = {};
    for (const inv of invoices) {
      if (!map[inv.supplier_id]) map[inv.supplier_id] = [];
      map[inv.supplier_id].push(inv);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.service_month.localeCompare(a.service_month));
    }
    return map;
  }, [invoices]);

  const groupedSuppliers = useMemo(() => {
    interface LocGroup { locationId: string | null; locationName: string; suppliers: Supplier[]; }
    interface CompanyGroup { companyId: string | null; companyName: string; locationGroups: LocGroup[]; suppliers: Supplier[]; }

    const groups: CompanyGroup[] = [];
    const noCompany: Supplier[] = [];

    for (const s of suppliers) {
      if (s.company_id) {
        let g = groups.find((g) => g.companyId === s.company_id);
        if (!g) {
          const c = companies.find((c) => c.id === s.company_id);
          g = { companyId: s.company_id, companyName: c?.name ?? '—', locationGroups: [], suppliers: [] };
          groups.push(g);
        }
        g.suppliers.push(s);
        const locId = s.location_id;
        let lg = g.locationGroups.find((lg) => lg.locationId === locId);
        if (!lg) {
          const loc = locId ? locations.find((l) => l.id === locId) : null;
          lg = { locationId: locId, locationName: loc?.name ?? 'Без локация', suppliers: [] };
          g.locationGroups.push(lg);
        }
        lg.suppliers.push(s);
      } else {
        noCompany.push(s);
      }
    }

    groups.sort((a, b) => a.companyName.localeCompare(b.companyName));
    groups.forEach((g) => {
      g.locationGroups.sort((a, b) => a.locationName.localeCompare(b.locationName));
      g.locationGroups.forEach((lg) => lg.suppliers.sort((a, b) => a.name.localeCompare(b.name)));
    });
    noCompany.sort((a, b) => a.name.localeCompare(b.name));
    if (noCompany.length > 0) {
      groups.push({ companyId: null, companyName: 'Без фирма', locationGroups: [], suppliers: noCompany });
    }
    return groups;
  }, [suppliers, companies, locations]);

  const toggleSupplier = (supplierId: string) => {
    setExpandedSupplierId((cur) => (cur === supplierId ? null : supplierId));
    setConfirmDeleteSupplier(null);
  };

  const handleAddInvoice = (supplier: Supplier) => {
    setEditingInvoice(null);
    setInvoiceFormSupplier(supplier);
    setShowInvoiceForm(true);
  };

  const handleEditInvoice = (invoice: SupplierInvoice, supplier: Supplier) => {
    setEditingInvoice(invoice);
    setInvoiceFormSupplier(supplier);
    setShowInvoiceForm(true);
  };

  const handleSaveInvoice = async (data: {
    invoice_number: string; invoice_date: string; service_month: string;
    quantity: number; unit: string; amount: number; vat_amount: number;
    total_amount: number; note: string | null; price_group?: string | null; id?: string;
  }) => {
    if (!invoiceFormSupplier) return;
    await onSaveInvoice(invoiceFormSupplier.id, data);
    setShowInvoiceForm(false);
    setEditingInvoice(null);
    setInvoiceFormSupplier(null);
  };

  const totalBySupplier = (supplierId: string): number => {
    return (supplierInvoices[supplierId] ?? []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          <Icon name="ArrowLeft" size={18} />
          Обратно
        </button>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Доставчици на услуги</h2>
        <p className="mt-1 text-sm text-slate-500">
          {suppliers.length} доставчика · {invoices.length} фактури
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <Icon name="AlertCircle" size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Icon name="Building2" size={22} className="text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">Няма регистрирани доставчици. Добавете доставчик чрез бутона горе.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSuppliers.map((group) => (
            <div key={group.companyId ?? '__nofirm'}>
              {/* Company group header */}
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <Icon name={group.companyId ? 'Building2' : 'Layers'} size={16} className="text-slate-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">{group.companyName}</h3>
                <span className="text-xs text-slate-400">{group.suppliers.length} доставчика</span>
              </div>

              {group.companyId && group.locationGroups.length > 0 ? (
                <div className="space-y-5">
                  {group.locationGroups.map((locGroup) => (
                    <div key={locGroup.locationId ?? '__noloc'}>
                      <div className="mb-2 flex items-center gap-1.5 pl-1">
                        <Icon name="MapPin" size={13} className="text-sky-400" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{locGroup.locationName}</span>
                        <span className="text-xs text-slate-300">· {locGroup.suppliers.length}</span>
                      </div>
                      <div className="space-y-4">
                        {locGroup.suppliers.map((supplier) => {
                          const isExpanded = expandedSupplierId === supplier.id;
                          const invs = supplierInvoices[supplier.id] ?? [];
                          return (
                            <div key={supplier.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                              <div
                                onClick={() => toggleSupplier(supplier.id)}
                                className="flex cursor-pointer items-center gap-4 p-5 transition-colors hover:bg-slate-50/50"
                              >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                                  <Icon name={SERVICE_TYPE_ICONS[supplier.service_type]} size={22} className="text-sky-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="truncate font-semibold text-slate-900">{supplier.name}</h3>
                                  <p className="mt-0.5 text-xs text-slate-400">
                                    {SERVICE_TYPE_LABELS[supplier.service_type]}
                                    {supplier.bulstat && <span> · ЕИК: {supplier.bulstat}</span>}
                                    <span> · {invs.length} фактури</span>
                                    {invs.length > 0 && <span> · общо {formatMoney(totalBySupplier(supplier.id))} €</span>}
                                  </p>
                                </div>
                                <Icon name="ChevronRight" size={20} className={`shrink-0 text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </div>
                              {isExpanded && (
                                <SupplierExpanded
                                  supplier={supplier}
                                  invs={invs}
                                  confirmDeleteSupplier={confirmDeleteSupplier}
                                  confirmDeleteInvoice={confirmDeleteInvoice}
                                  isAdmin={isAdmin}
                                  onToggle={toggleSupplier}
                                  onAddInvoice={handleAddInvoice}
                                  onEditInvoice={handleEditInvoice}
                                  onDeleteInvoice={onDeleteInvoice}
                                  onDeleteSupplier={onDeleteSupplier}
                                  setConfirmDeleteSupplier={setConfirmDeleteSupplier}
                                  setConfirmDeleteInvoice={setConfirmDeleteInvoice}
                                  formatMonthLabel={formatMonthLabel}
                                  formatMoney={formatMoney}
                                  totalBySupplier={totalBySupplier}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {group.suppliers.map((supplier) => {
                    const isExpanded = expandedSupplierId === supplier.id;
                    const invs = supplierInvoices[supplier.id] ?? [];
                    return (
                      <div key={supplier.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div
                          onClick={() => toggleSupplier(supplier.id)}
                          className="flex cursor-pointer items-center gap-4 p-5 transition-colors hover:bg-slate-50/50"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                            <Icon name={SERVICE_TYPE_ICONS[supplier.service_type]} size={22} className="text-sky-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="truncate font-semibold text-slate-900">{supplier.name}</h3>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {SERVICE_TYPE_LABELS[supplier.service_type]}
                              {supplier.bulstat && <span> · ЕИК: {supplier.bulstat}</span>}
                              <span> · {invs.length} фактури</span>
                              {invs.length > 0 && <span> · общо {formatMoney(totalBySupplier(supplier.id))} €</span>}
                            </p>
                          </div>
                          <Icon name="ChevronRight" size={20} className={`shrink-0 text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                        {isExpanded && (
                          <SupplierExpanded
                            supplier={supplier}
                            invs={invs}
                            confirmDeleteSupplier={confirmDeleteSupplier}
                            confirmDeleteInvoice={confirmDeleteInvoice}
                            isAdmin={isAdmin}
                            onToggle={toggleSupplier}
                            onAddInvoice={handleAddInvoice}
                            onEditInvoice={handleEditInvoice}
                            onDeleteInvoice={onDeleteInvoice}
                            onDeleteSupplier={onDeleteSupplier}
                            setConfirmDeleteSupplier={setConfirmDeleteSupplier}
                            setConfirmDeleteInvoice={setConfirmDeleteInvoice}
                            formatMonthLabel={formatMonthLabel}
                            formatMoney={formatMoney}
                            totalBySupplier={totalBySupplier}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showInvoiceForm && invoiceFormSupplier && (
        <SupplierInvoiceForm
          invoice={editingInvoice}
          supplier={invoiceFormSupplier}
          onSave={handleSaveInvoice}
          onCancel={() => { setShowInvoiceForm(false); setEditingInvoice(null); setInvoiceFormSupplier(null); }}
        />
      )}
    </div>
  );
}

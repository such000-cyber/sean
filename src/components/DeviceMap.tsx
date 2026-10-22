import { useMemo, useState } from 'react';
import type {
  Device,
  Company,
  CompanyLocation,
  Client,
  DeviceClientWithClient,
  DeviceDependency,
  DeviceType,
} from '@/lib/supabase';
import { DEVICE_TYPE_LABELS } from '@/lib/supabase';
import { Icon } from './Icon';

interface DeviceMapProps {
  devices: Device[];
  companies: Company[];
  locations: CompanyLocation[];
  clients: Client[];
  deviceClients: DeviceClientWithClient[];
  deviceDependencies: DeviceDependency[];
  onBack: () => void;
}

const TYPE_COLORS: Record<DeviceType, string> = {
  electricity: '#f59e0b',
  water: '#0ea5e9',
  gas: '#ef4444',
  heat: '#f97316',
  other: '#64748b',
};

function typeIcon(type: DeviceType): string {
  switch (type) {
    case 'electricity': return 'Zap';
    case 'water': return 'Droplets';
    case 'gas': return 'Flame';
    case 'heat': return 'Thermometer';
    default: return 'Gauge';
  }
}

export function DeviceMap({
  devices,
  companies,
  locations,
  clients,
  deviceClients,
  deviceDependencies,
  onBack,
}: DeviceMapProps) {
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  const toggleCompany = (id: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLocation = (id: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build dependency map: deviceId -> list of sub-deviceIds it depends on
  const depsByDevice = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const dep of deviceDependencies) {
      if (dep.device_id === dep.depends_on_device_id) continue;
      const list = map.get(dep.device_id);
      if (list) list.push(dep.depends_on_device_id);
      else map.set(dep.device_id, [dep.depends_on_device_id]);
    }
    return map;
  }, [deviceDependencies]);

  // Build device-client map: deviceId -> list of {client, percentage}
  const clientsByDevice = useMemo(() => {
    const map = new Map<string, { client: Client; percentage: number }[]>();
    for (const dc of deviceClients) {
      const list = map.get(dc.device_id);
      if (list) list.push({ client: dc.client, percentage: dc.percentage });
      else map.set(dc.device_id, [{ client: dc.client, percentage: dc.percentage }]);
    }
    return map;
  }, [deviceClients]);

  const deviceById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);

  // Group devices by company -> location
  const structure = useMemo(() => {
    const result: {
      company: Company;
      locations: {
        location: CompanyLocation | null;
        devices: Device[];
      }[];
    }[] = [];

    for (const company of companies) {
      const companyDevices = devices.filter((d) => d.company_id === company.id);
      if (companyDevices.length === 0) continue;

      const companyLocations = locations.filter((l) => l.company_id === company.id);
      const locGroups: { location: CompanyLocation | null; devices: Device[] }[] = [];

      for (const loc of companyLocations) {
        const locDevices = companyDevices.filter((d) => d.location_id === loc.id);
        if (locDevices.length > 0) {
          locGroups.push({ location: loc, devices: locDevices });
        }
      }

      const noLocDevices = companyDevices.filter((d) => !d.location_id);
      if (noLocDevices.length > 0) {
        locGroups.push({ location: null, devices: noLocDevices });
      }

      if (locGroups.length > 0) {
        result.push({ company, locations: locGroups });
      }
    }

    // Devices without company
    const noCompanyDevices = devices.filter((d) => !d.company_id);
    if (noCompanyDevices.length > 0) {
      result.push({
        company: { id: '__none__', name: 'Без фирма', bulstat: null, address: null, phone: null, email: null, created_at: '' },
        locations: [{ location: null, devices: noCompanyDevices }],
      });
    }

    return result;
  }, [devices, companies, locations]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-lg print:hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 shadow-sm">
                <Icon name="MapPin" size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">Схема по локации</h1>
                <p className="text-xs text-slate-400 leading-tight">Уреди, връзки и зависимости</p>
              </div>
            </div>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
            >
              <Icon name="ArrowLeft" size={16} />
              <span className="hidden sm:inline">Обратно</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {structure.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100">
              <Icon name="MapPin" size={36} className="text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Няма данни за схема</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Добавете уреди, фирми и локации, за да видите графичната схема на връзките.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {structure.map(({ company, locations: locGroups }) => {
              const companyExpanded = expandedCompanies.has(company.id);
              const totalDevices = locGroups.reduce((sum, g) => sum + g.devices.length, 0);

              return (
                <div
                  key={company.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* Company header */}
                  <button
                    onClick={() => toggleCompany(company.id)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                      <Icon name="Building2" size={20} className="text-sky-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate text-base font-bold text-slate-900">{company.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {totalDevices} уред{totalDevices === 1 ? '' : 'а'} · {locGroups.length} локаци{locGroups.length === 1 ? 'я' : 'и'}
                      </p>
                    </div>
                    <Icon
                      name="ChevronDown"
                      size={20}
                      className={`shrink-0 text-slate-400 transition-transform duration-200 ${companyExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Company body */}
                  {companyExpanded && (
                    <div className="space-y-4 p-4">
                      {locGroups.map(({ location, devices: locDevices }, locIdx) => {
                        const locKey = location?.id ?? `${company.id}__noloc`;
                        const locExpanded = expandedLocations.has(locKey);
                        const hasDeps = locDevices.some((d) => {
                          const deps = depsByDevice.get(d.id);
                          return deps && deps.length > 0;
                        });

                        return (
                          <div key={locKey} className="rounded-xl border border-slate-200">
                            {/* Location header */}
                            <button
                              onClick={() => toggleLocation(locKey)}
                              className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                                <Icon name="MapPin" size={15} className="text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold text-slate-700">
                                  {location?.name ?? 'Без локация'}
                                </span>
                                <span className="ml-2 text-xs text-slate-400">
                                  {locDevices.length} уред{locDevices.length === 1 ? '' : 'а'}
                                </span>
                              </div>
                              <Icon
                                name="ChevronDown"
                                size={16}
                                className={`shrink-0 text-slate-400 transition-transform duration-200 ${locExpanded ? 'rotate-180' : ''}`}
                              />
                            </button>

                            {/* Location body: device tree */}
                            {locExpanded && (
                              <div className="border-t border-slate-100 p-4">
                                <div className="space-y-3">
                                  {locDevices.map((device) => (
                                    <DeviceTreeNode
                                      key={device.id}
                                      device={device}
                                      depsByDevice={depsByDevice}
                                      deviceById={deviceById}
                                      clientsByDevice={clientsByDevice}
                                      isLast={locIdx === locGroups.length - 1}
                                    />
                                  ))}
                                </div>
                                {hasDeps && (
                                  <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                                    <Icon name="Info" size={13} />
                                    Стрелките показват зависимост: главният уред изважда консумацията на подуредите.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:break-inside-avoid">
          <h4 className="mb-3 text-sm font-bold text-slate-700">Легенда</h4>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-100">
                <Icon name="Zap" size={12} className="text-amber-600" />
              </span>
              <span className="text-xs text-slate-600">Електричество</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-100">
                <Icon name="Droplets" size={12} className="text-sky-600" />
              </span>
              <span className="text-xs text-slate-600">Вода</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-red-100">
                <Icon name="Flame" size={12} className="text-red-600" />
              </span>
              <span className="text-xs text-slate-600">Газ</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-orange-100">
                <Icon name="Thermometer" size={12} className="text-orange-600" />
              </span>
              <span className="text-xs text-slate-600">Топлофикация</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100">
                <Icon name="Gauge" size={12} className="text-slate-600" />
              </span>
              <span className="text-xs text-slate-600">Друг</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                <span className="text-slate-300">—</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <span className="text-xs text-slate-600">Връзка с клиент (процент)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-600" />
                <span className="text-slate-400">↓</span>
                <span className="h-2 w-2 rounded-full bg-slate-400" />
              </div>
              <span className="text-xs text-slate-600">Зависимост (изваждане)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">БАЗОВ</span>
              <span className="text-xs text-slate-600">Главен уред за обекта</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">РЪЧЕН</span>
              <span className="text-xs text-slate-600">Уред без брояч (директно количество)</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function DeviceTreeNode({
  device,
  depsByDevice,
  deviceById,
  clientsByDevice,
  isLast: _isLast,
}: {
  device: Device;
  depsByDevice: Map<string, string[]>;
  deviceById: Map<string, Device>;
  clientsByDevice: Map<string, { client: Client; percentage: number }[]>;
  isLast: boolean;
}) {
  const subDeviceIds = depsByDevice.get(device.id) ?? [];
  const linkedClients = clientsByDevice.get(device.id) ?? [];
  const typeColor = TYPE_COLORS[device.type] ?? '#64748b';
  const iconName = typeIcon(device.type);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Device header */}
      <div className="flex items-start gap-3 p-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${typeColor}18` }}
        >
          <Icon name={iconName} size={17} style={{ color: typeColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{device.name}</span>
            {device.is_base && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">БАЗОВ</span>
            )}
            {device.is_manual && (
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">РЪЧЕН</span>
            )}
            {device.price_group && (
              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                {device.price_group}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
            <span>{DEVICE_TYPE_LABELS[device.type]}</span>
            <span>· {device.unit}</span>
            {device.number && <span>· № {device.number}</span>}
            {device.coefficient !== 1 && <span>· коеф. {device.coefficient}</span>}
          </div>
        </div>
      </div>

      {/* Linked clients */}
      {linkedClients.length > 0 && (
        <div className="border-t border-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-1.5">
            <Icon name="Users" size={11} />
            Клиенти
          </div>
          <div className="flex flex-wrap gap-1.5">
            {linkedClients.map((lc) => (
              <span
                key={lc.client.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {lc.client.name}
                <span className="font-bold">{lc.percentage}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sub-devices (dependencies) */}
      {subDeviceIds.length > 0 && (
        <div className="border-t border-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-2">
            <Icon name="ArrowRight" size={11} />
            Изваждани уреди ({subDeviceIds.length})
          </div>
          <div className="space-y-2">
            {subDeviceIds.map((subId) => {
              const sub = deviceById.get(subId);
              if (!sub) {
                return (
                  <div key={subId} className="flex items-center gap-2 pl-4 text-xs text-red-400">
                    <span className="text-slate-300">↓</span>
                    Изтрит уред
                  </div>
                );
              }
              const subColor = TYPE_COLORS[sub.type] ?? '#64748b';
              const subIcon = typeIcon(sub.type);
              return (
                <div key={subId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                  <span className="text-slate-300 text-sm leading-none">↓</span>
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${subColor}18` }}
                  >
                    <Icon name={subIcon} size={13} style={{ color: subColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-slate-700">{sub.name}</span>
                    <span className="ml-2 text-[11px] text-slate-400">
                      {DEVICE_TYPE_LABELS[sub.type]} · {sub.unit}
                      {sub.coefficient !== 1 && ` · коеф. ${sub.coefficient}`}
                    </span>
                  </div>
                  {sub.is_base && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">БАЗОВ</span>
                  )}
                  {sub.is_manual && (
                    <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">РЪЧЕН</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

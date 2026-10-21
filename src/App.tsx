import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabase,
  type Device,
  type Reading,
  type ReadingWithDelta,
  type Company,
  type CompanyLocation,
  type Client,
  type DeviceClientWithClient,
  type DeviceDependency,
  type Supplier,
  type SupplierInvoice,
  type ServiceType,
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/Icon';
import { DeviceCard } from '@/components/DeviceCard';
import { DeviceForm } from '@/components/DeviceForm';
import { ReadingForm } from '@/components/ReadingForm';
import { DeviceDetail } from '@/components/DeviceDetail';
import { CompanyForm } from '@/components/CompanyForm';
import { ClientForm } from '@/components/ClientForm';
import { MonthlyEntry } from '@/components/MonthlyEntry';
import { SupplierForm } from '@/components/SupplierForm';
import { SuppliersView } from '@/components/SuppliersView';
import { ConsumptionReport } from '@/components/ConsumptionReport';
import { CompensationReport } from '@/components/CompensationReport';
import { LoginPage } from '@/components/LoginPage';
import { UserManagementPanel } from '@/components/UserManagementPanel';
import { HelpPage } from '@/components/HelpPage';

type View = 'dashboard' | 'detail' | 'monthly' | 'suppliers' | 'report' | 'compensation' | 'users' | 'help';

export default function App() {
  const { session, profile, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-sky-500" />
          <p className="text-sm text-slate-400">Зареждане...</p>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return <LoginPage />;
  }

  return <AppContent />;
}

function AppContent() {
  const { session, profile, access, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [view, setView] = useState<View>('dashboard');
  const [devices, setDevices] = useState<Device[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [deviceClients, setDeviceClients] = useState<DeviceClientWithClient[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [showReadingForm, setShowReadingForm] = useState(false);
  const [editingReading, setEditingReading] = useState<ReadingWithDelta | null>(null);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showCompanyDetail, setShowCompanyDetail] = useState<Company | null>(null);
  const [showMonthlyEntry, setShowMonthlyEntry] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [deviceDependencies, setDeviceDependencies] = useState<DeviceDependency[]>([]);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Search & company filter
  const [search, setSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  const headerUserInfo = {
    name: profile?.full_name || session?.user?.email || 'Потребител',
    role: isAdmin ? 'Администратор' : 'Потребител по фирма',
  };
  const handleLogout = () => { signOut(); };

  // Companies this user can access
  const userCompanyIds = useMemo(() => {
    if (isAdmin) return null; // null = all companies
    if (access.length > 0) return access.map((a) => a.company_id);
    if (profile?.company_id) return [profile.company_id];
    return [];
  }, [isAdmin, access, profile?.company_id]);

  // Per-company location restrictions: companyId -> Set<locationId> | null (null = all locations for that company)
  const userAccessMap = useMemo(() => {
    if (isAdmin || access.length === 0) return null;
    const map: Record<string, Set<string> | null> = {};
    for (const a of access) {
      if (a.location_id) {
        if (!(a.company_id in map)) map[a.company_id] = new Set<string>();
        map[a.company_id]?.add(a.location_id);
      } else {
        map[a.company_id] = null; // all locations for this company
      }
    }
    return map;
  }, [isAdmin, access]);

  // Company users: if multiple companies, allow selection; if one, lock to it
  const effectiveCompanyId = isAdmin ? selectedCompanyId : (
    userCompanyIds && userCompanyIds.length === 1 ? userCompanyIds[0] : selectedCompanyId
  );

  const fetchDevices = useCallback(async () => {
    const { data, error } = await supabase.from('devices').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw error;
    return data as Device[];
  }, []);

  const fetchReadings = useCallback(async () => {
    const { data, error } = await supabase.from('readings').select('*').order('reading_date', { ascending: true });
    if (error) throw error;
    return data as Reading[];
  }, []);

  const fetchCompanies = useCallback(async () => {
    const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data as Company[];
  }, []);

  const fetchLocations = useCallback(async () => {
    const { data, error } = await supabase.from('company_locations').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data as CompanyLocation[];
  }, []);

  const fetchClients = useCallback(async () => {
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data as Client[];
  }, []);

  const fetchDeviceClients = useCallback(async () => {
    const { data, error } = await supabase
      .from('device_clients')
      .select('*, client:clients(*)')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data as unknown as DeviceClientWithClient[];
  }, []);

  const fetchSuppliers = useCallback(async () => {
    const { data, error } = await supabase.from('suppliers').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data as Supplier[];
  }, []);

  const fetchSupplierInvoices = useCallback(async () => {
    const { data, error } = await supabase.from('supplier_invoices').select('*').order('service_month', { ascending: false });
    if (error) throw error;
    return data as SupplierInvoice[];
  }, []);

  const fetchDeviceDependencies = useCallback(async () => {
    const { data, error } = await supabase.from('device_dependencies').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return data as DeviceDependency[];
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      fetchDevices(),
      fetchReadings(),
      fetchCompanies(),
      fetchLocations(),
      fetchClients(),
      fetchDeviceClients(),
      fetchSuppliers(),
      fetchSupplierInvoices(),
      fetchDeviceDependencies(),
    ]);
    const [devs, reads, comps, locs, clnts, devClnts, sups, supInvs, depDeps] = results;
    const failed: string[] = [];
    if (devs.status === 'fulfilled') setDevices(devs.value); else failed.push('уреди');
    if (reads.status === 'fulfilled') setReadings(reads.value); else failed.push('показания');
    if (comps.status === 'fulfilled') setCompanies(comps.value); else failed.push('фирми');
    if (locs.status === 'fulfilled') setLocations(locs.value); else failed.push('локации');
    if (clnts.status === 'fulfilled') setClients(clnts.value); else failed.push('клиенти');
    if (devClnts.status === 'fulfilled') setDeviceClients(devClnts.value); else failed.push('връзки');
    if (sups.status === 'fulfilled') setSuppliers(sups.value); else failed.push('доставчици');
    if (supInvs.status === 'fulfilled') setSupplierInvoices(supInvs.value); else failed.push('фактури');
    if (depDeps.status === 'fulfilled') setDeviceDependencies(depDeps.value); else failed.push('зависимости');
    if (failed.length > 0) {
      setError(`Грешка при зареждане на: ${failed.join(', ')}`);
    }
    setLoading(false);
  }, [fetchDevices, fetchReadings, fetchCompanies, fetchLocations, fetchClients, fetchDeviceClients, fetchSuppliers, fetchSupplierInvoices]);

  const refreshAll = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchDevices(),
      fetchReadings(),
      fetchCompanies(),
      fetchLocations(),
      fetchClients(),
      fetchDeviceClients(),
      fetchSuppliers(),
      fetchSupplierInvoices(),
    ]);
    const [devs, reads, comps, locs, clnts, devClnts, sups, supInvs] = results;
    if (devs.status === 'fulfilled') setDevices(devs.value);
    if (reads.status === 'fulfilled') setReadings(reads.value);
    if (comps.status === 'fulfilled') setCompanies(comps.value);
    if (locs.status === 'fulfilled') setLocations(locs.value);
    if (clnts.status === 'fulfilled') setClients(clnts.value);
    if (devClnts.status === 'fulfilled') setDeviceClients(devClnts.value);
    if (sups.status === 'fulfilled') setSuppliers(sups.value);
    if (supInvs.status === 'fulfilled') setSupplierInvoices(supInvs.value);
  }, [fetchDevices, fetchReadings, fetchCompanies, fetchLocations, fetchClients, fetchDeviceClients, fetchSuppliers, fetchSupplierInvoices, fetchDeviceDependencies]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime: refresh data silently when any table changes
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { refreshAll(); }, 300);
    };

    const channel = supabase
      .channel('realtime-all-tables')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        triggerRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'readings' },
        triggerRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        triggerRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        triggerRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_clients' },
        triggerRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suppliers' },
        triggerRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supplier_invoices' },
        triggerRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'company_locations' },
        triggerRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        triggerRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_company_access' },
        triggerRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_dependencies' },
        triggerRefresh,
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [refreshAll]);

  // Polling fallback: refresh every 5 seconds in case realtime events are missed
  useEffect(() => {
    const interval = setInterval(() => { refreshAll(); }, 5000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // Compute readings with delta for a device
  const getReadingsWithDelta = useCallback(
    (deviceId: string): ReadingWithDelta[] => {
      const deviceReadings = readings
        .filter((r) => r.device_id === deviceId)
        .sort((a, b) => a.reading_date.localeCompare(b.reading_date));
      return deviceReadings.map((r, i) => {
        const prev = i > 0 ? deviceReadings[i - 1] : null;
        return {
          ...r,
          delta: prev ? r.value - prev.value : null,
          previousValue: prev ? prev.value : null,
        };
      });
    },
    [readings]
  );

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  );

  const selectedReadings = useMemo(
    () => (selectedDeviceId ? getReadingsWithDelta(selectedDeviceId) : []),
    [selectedDeviceId, getReadingsWithDelta]
  );

  const selectedDeviceClients = useMemo(
    () => (selectedDeviceId ? deviceClients.filter((dc) => dc.device_id === selectedDeviceId) : []),
    [deviceClients, selectedDeviceId]
  );

  const availableClientsForDevice = useMemo(() => {
    if (!selectedDevice?.company_id) return clients;
    return clients.filter((c) => c.company_id === selectedDevice.company_id);
  }, [clients, selectedDevice]);

  const filteredDevices = useMemo(() => {
    let result = devices;
    // Filter by selected company (admin or multi-company user)
    if (effectiveCompanyId !== 'all') {
      result = result.filter((d) => d.company_id === effectiveCompanyId);
    } else if (!isAdmin && userCompanyIds) {
      result = result.filter((d) => d.company_id && userCompanyIds.includes(d.company_id));
    }
    // Filter by selected location
    if (selectedLocationId !== 'all') {
      result = result.filter((d) => d.location_id === selectedLocationId);
    }
    // Filter by per-company location restrictions
    if (!isAdmin && userAccessMap) {
      result = result.filter((d) => {
        if (!d.company_id) return false;
        const allowed = userAccessMap[d.company_id];
        if (allowed === undefined) return false;
        if (allowed === null) return true; // all locations for this company
        return d.location_id != null && allowed.has(d.location_id);
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.location?.toLowerCase().includes(q) ||
          d.number?.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [devices, search, effectiveCompanyId, selectedLocationId, isAdmin, userCompanyIds, userAccessMap]);

  const filteredClients = useMemo(() => {
    if (effectiveCompanyId !== 'all') {
      return clients.filter((c) => c.company_id === effectiveCompanyId);
    } else if (!isAdmin && userCompanyIds) {
      return clients.filter((c) => c.company_id && userCompanyIds.includes(c.company_id));
    }
    return clients;
  }, [clients, effectiveCompanyId, isAdmin, userCompanyIds]);

  // Company CRUD
  const handleSaveCompany = async (data: Omit<Company, 'id' | 'created_at'>) => {
    if (editingCompany) {
      const { error } = await supabase.from('companies').update(data).eq('id', editingCompany.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('companies').insert(data);
      if (error) throw error;
    }
    setShowCompanyForm(false);
    setEditingCompany(null);
    await refreshAll();
  };

  const handleDeleteCompany = async (company: Company) => {
    const { error } = await supabase.from('companies').delete().eq('id', company.id);
    if (error) {
      setError(error.message);
      return;
    }
    setShowCompanyDetail(null);
    await refreshAll();
  };

  // Client CRUD
  const handleSaveClient = async (data: Omit<Client, 'id' | 'created_at'>) => {
    if (editingClient) {
      const { error } = await supabase.from('clients').update(data).eq('id', editingClient.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('clients').insert(data);
      if (error) throw error;
    }
    setShowClientForm(false);
    setEditingClient(null);
    await refreshAll();
  };

  const handleDeleteClient = async (client: Client) => {
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (error) {
      setError(error.message);
      return;
    }
    await refreshAll();
  };

  // Device CRUD
  const handleSaveDevice = async (data: Omit<Device, 'id' | 'created_at' | 'sort_order'> & { dependencyIds: string[] }) => {
    const { dependencyIds, ...deviceData } = data;
    let deviceId: string;
    if (editingDevice) {
      const { error } = await supabase.from('devices').update(deviceData).eq('id', editingDevice.id);
      if (error) throw error;
      deviceId = editingDevice.id;
    } else {
      const { data: inserted, error } = await supabase.from('devices').insert(deviceData).select('id').single();
      if (error) throw error;
      deviceId = inserted.id;
    }

    // Sync dependencies: delete removed, insert new
    const existingDeps = deviceDependencies.filter((d) => d.device_id === deviceId);
    const existingDepIds = new Set(existingDeps.map((d) => d.depends_on_device_id));
    const newDepIds = new Set(dependencyIds);

    const toDelete = existingDeps.filter((d) => !newDepIds.has(d.depends_on_device_id));
    const toInsert = dependencyIds.filter((id) => !existingDepIds.has(id));

    for (const dep of toDelete) {
      await supabase.from('device_dependencies').delete().eq('id', dep.id);
    }
    for (let i = 0; i < toInsert.length; i++) {
      await supabase.from('device_dependencies').insert({
        device_id: deviceId,
        depends_on_device_id: toInsert[i],
        sort_order: i,
      });
    }

    setShowDeviceForm(false);
    setEditingDevice(null);
    await refreshAll();
  };

  const handleDeleteDevice = async (device: Device) => {
    const { error } = await supabase.from('devices').delete().eq('id', device.id);
    if (error) {
      setError(error.message);
      return;
    }
    await refreshAll();
  };

  const handleReorderDevice = async (device: Device, direction: 'up' | 'down') => {
    const sorted = [...filteredDevices].sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.created_at.localeCompare(b.created_at);
    });
    const idx = sorted.findIndex((d) => d.id === device.id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const reordered = [...sorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    for (let i = 0; i < reordered.length; i++) {
      const { error } = await supabase.from('devices').update({ sort_order: i }).eq('id', reordered[i].id);
      if (error) {
        setError(error.message);
        return;
      }
    }
    await refreshAll();
  };

  // Reading CRUD
  const handleSaveReading = async (data: {
    reading_date: string;
    value: number;
    note: string | null;
    id?: string;
  }) => {
    if (!selectedDeviceId) return;
    const depIds = deviceDependencies.filter((d) => d.device_id === selectedDeviceId).map((d) => d.depends_on_device_id);

    let finalValue = data.value;
    if (depIds.length > 0) {
      const subtractionSum = depIds.reduce((sum, depId) => {
        const depReading = readings.find((r) => r.device_id === depId && r.reading_date === data.reading_date);
        return sum + (depReading?.value ?? 0);
      }, 0);
      finalValue = Math.round((data.value - subtractionSum) * 1000) / 1000;
    }

    if (data.id) {
      const { error } = await supabase
        .from('readings')
        .update({ reading_date: data.reading_date, value: finalValue, raw_value: data.value, note: data.note })
        .eq('id', data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('readings').insert({
        device_id: selectedDeviceId,
        reading_date: data.reading_date,
        value: finalValue,
        raw_value: data.value,
        note: data.note,
      });
      if (error) throw error;
    }
    setShowReadingForm(false);
    setEditingReading(null);
    await refreshAll();

    // Recalculate dependent devices (devices that depend on this one)
    const dependents = deviceDependencies.filter((d) => d.depends_on_device_id === selectedDeviceId).map((d) => d.device_id);
    for (const depId of dependents) {
      const depExisting = (await supabase.from('readings').select('*').eq('device_id', depId).eq('reading_date', data.reading_date).maybeSingle()).data;
      if (depExisting && depExisting.raw_value !== null) {
        const allDepsOfDep = deviceDependencies.filter((d) => d.device_id === depId).map((d) => d.depends_on_device_id);
        const depSum = allDepsOfDep.reduce((sum, did) => {
          if (did === selectedDeviceId) return sum + finalValue;
          const r = readings.find((rr) => rr.device_id === did && rr.reading_date === data.reading_date);
          return sum + (r?.value ?? 0);
        }, 0);
        const newVal = Math.round((depExisting.raw_value - depSum) * 1000) / 1000;
        await supabase.from('readings').update({ value: newVal }).eq('id', depExisting.id);
      }
    }
    await refreshAll();
  };

  // Monthly entry save (inline upsert)
  const handleSaveMonthlyReading = async (deviceId: string, readingDate: string, value: number, note: string | null, existingId?: string) => {
    const depIds = deviceDependencies.filter((d) => d.device_id === deviceId).map((d) => d.depends_on_device_id);

    // If this device depends on others, compute value = raw - sum of depended_values
    let finalValue = value;
    if (depIds.length > 0) {
      const subtractionSum = depIds.reduce((sum, depId) => {
        const depReading = readings.find((r) => r.device_id === depId && r.reading_date === readingDate);
        return sum + (depReading?.value ?? 0);
      }, 0);
      finalValue = Math.round((value - subtractionSum) * 1000) / 1000;
    }

    if (existingId && existingId !== 'new') {
      const { error } = await supabase
        .from('readings')
        .update({ reading_date: readingDate, value: finalValue, raw_value: value, note })
        .eq('id', existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('readings').insert({
        device_id: deviceId,
        reading_date: readingDate,
        value: finalValue,
        raw_value: value,
        note,
      });
      if (error) throw error;
    }

    // After saving, recompute any devices that depend on this one
    await refreshAll();

    // Recalculate dependent devices' values for this month (devices that depend on this one)
    const dependents = deviceDependencies.filter((d) => d.depends_on_device_id === deviceId).map((d) => d.device_id);
    for (const depId of dependents) {
      const depExisting = readings.find((r) => r.device_id === depId && r.reading_date === readingDate)
        || (await supabase.from('readings').select('*').eq('device_id', depId).eq('reading_date', readingDate).maybeSingle()).data;
      if (depExisting && depExisting.raw_value !== null) {
        const allDepsOfDep = deviceDependencies.filter((d) => d.device_id === depId).map((d) => d.depends_on_device_id);
        const depSum = allDepsOfDep.reduce((sum, did) => {
          if (did === deviceId) return sum + finalValue;
          const r = readings.find((rr) => rr.device_id === did && rr.reading_date === readingDate);
          return sum + (r?.value ?? 0);
        }, 0);
        const newVal = Math.round((depExisting.raw_value - depSum) * 1000) / 1000;
        await supabase.from('readings').update({ value: newVal }).eq('id', depExisting.id);
      }
    }

    await refreshAll();
  };

  const handleDeleteReading = async (reading: ReadingWithDelta) => {
    const { error } = await supabase.from('readings').delete().eq('id', reading.id);
    if (error) {
      setError(error.message);
      return;
    }
    await refreshAll();
  };

  // Device-Client CRUD
  const handleAddDeviceClient = async (clientId: string, percentage: number) => {
    if (!selectedDeviceId) return;
    const { error } = await supabase.from('device_clients').insert({
      device_id: selectedDeviceId,
      client_id: clientId,
      percentage,
    });
    if (error) throw error;
    await refreshAll();
  };

  const handleUpdateDeviceClientPercentage = async (deviceClientId: string, percentage: number) => {
    const { error } = await supabase.from('device_clients').update({ percentage }).eq('id', deviceClientId);
    if (error) throw error;
    await refreshAll();
  };

  const handleRemoveDeviceClient = async (deviceClientId: string) => {
    const { error } = await supabase.from('device_clients').delete().eq('id', deviceClientId);
    if (error) {
      setError(error.message);
      return;
    }
    await refreshAll();
  };

  // Location CRUD
  const handleAddLocation = async (companyId: string, name: string) => {
    const { error } = await supabase.from('company_locations').insert({ company_id: companyId, name: name.trim() });
    if (error) throw error;
    await refreshAll();
  };

  const handleDeleteLocation = async (locationId: string) => {
    const { error } = await supabase.from('company_locations').delete().eq('id', locationId);
    if (error) throw error;
    await refreshAll();
  };

  // Supplier CRUD
  const handleSaveSupplier = async (data: { name: string; service_type: ServiceType; company_id: string | null; location_id: string | null; bulstat: string | null; address: string | null; phone: string | null; email: string | null }) => {
    if (editingSupplier) {
      const { error } = await supabase.from('suppliers').update(data).eq('id', editingSupplier.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('suppliers').insert(data);
      if (error) throw error;
    }
    setShowSupplierForm(false);
    setEditingSupplier(null);
    await refreshAll();
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', supplier.id);
    if (error) {
      setError(error.message);
      return;
    }
    await refreshAll();
  };

  // Supplier invoice CRUD
  const handleSaveSupplierInvoice = async (supplierId: string, data: { invoice_number: string; invoice_date: string; service_month: string; quantity: number; unit: string; amount: number; vat_amount: number; total_amount: number; note: string | null; id?: string }) => {
    if (data.id) {
      const { error } = await supabase
        .from('supplier_invoices')
        .update({
          invoice_number: data.invoice_number,
          invoice_date: data.invoice_date,
          service_month: data.service_month,
          quantity: data.quantity,
          unit: data.unit,
          amount: data.amount,
          vat_amount: data.vat_amount,
          total_amount: data.total_amount,
          note: data.note,
        })
        .eq('id', data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('supplier_invoices').insert({
        supplier_id: supplierId,
        ...data,
      });
      if (error) throw error;
    }
    await refreshAll();
  };

  const handleDeleteSupplierInvoice = async (invoice: SupplierInvoice) => {
    const { error } = await supabase.from('supplier_invoices').delete().eq('id', invoice.id);
    if (error) {
      setError(error.message);
      return;
    }
    await refreshAll();
  };

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Company detail view
  if (showCompanyDetail) {
    const companyClients = clients.filter((c) => c.company_id === showCompanyDetail.id);
    const companyDevices = devices.filter((d) => d.company_id === showCompanyDetail.id);
    const companyLocations = locations.filter((l) => l.company_id === showCompanyDetail.id);

    return (
      <div className="min-h-screen bg-slate-50">
        <Header
          onAddDevice={() => { setEditingDevice(null); setShowDeviceForm(true); }}
          showAddDevice={isAdmin}
          userInfo={headerUserInfo}
          onLogout={handleLogout}
          rightExtra={
            isAdmin && (
              <button
                onClick={() => { setEditingCompany(showCompanyDetail); setShowCompanyForm(true); }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="Edit3" size={16} />
                <span className="hidden sm:inline">Редактирай фирма</span>
              </button>
            )
          }
        />
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <button
            onClick={() => setShowCompanyDetail(null)}
            className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Icon name="ArrowLeft" size={18} />
            Обратно
          </button>

          {/* Company info */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-2 bg-sky-500" />
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
                  <Icon name="Building2" size={26} className="text-sky-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-900">{showCompanyDetail.name}</h2>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    {showCompanyDetail.bulstat && <span>ЕИК: {showCompanyDetail.bulstat}</span>}
                    {showCompanyDetail.address && (
                      <span className="flex items-center gap-1">
                        <Icon name="MapPin" size={13} />
                        {showCompanyDetail.address}
                      </span>
                    )}
                    {showCompanyDetail.phone && (
                      <span className="flex items-center gap-1">
                        <Icon name="Phone" size={13} />
                        {showCompanyDetail.phone}
                      </span>
                    )}
                    {showCompanyDetail.email && (
                      <span className="flex items-center gap-1">
                        <Icon name="Mail" size={13} />
                        {showCompanyDetail.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100">
                  <Icon name="Gauge" size={14} className="text-sky-600" />
                </div>
                <span className="text-xs font-medium text-slate-500">Уреди</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{companyDevices.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                  <Icon name="Users" size={14} className="text-emerald-600" />
                </div>
                <span className="text-xs font-medium text-slate-500">Клиенти</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{companyClients.length}</p>
            </div>
          </div>

          {/* Locations section */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-700">Локации ({companyLocations.length})</h3>
              {isAdmin && <LocationAddForm companyId={showCompanyDetail.id} onAdd={handleAddLocation} />}
            </div>
            {companyLocations.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <Icon name="MapPin" size={18} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">Няма добавени локации към тази фирма</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-4">
                {companyLocations.map((loc) => {
                  const deviceCount = companyDevices.filter((d) => d.location_id === loc.id).length;
                  return (
                    <span
                      key={loc.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                    >
                      <Icon name="MapPin" size={13} className="text-sky-500" />
                      {loc.name}
                      <span className="text-xs text-slate-400">({deviceCount} уреда)</span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteLocation(loc.id)}
                          className="ml-1 text-slate-300 transition-colors hover:text-red-500"
                        >
                          <Icon name="X" size={13} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clients section */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-700">Клиенти ({companyClients.length})</h3>
              <button
                onClick={() => { setEditingClient(null); setShowClientForm(true); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
              >
                <Icon name="UserPlus" size={15} />
                Нов клиент
              </button>
            </div>
            {companyClients.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Icon name="Users" size={22} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">Няма клиенти към тази фирма</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {companyClients.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-slate-50/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{c.name}</p>
                      {c.identifier && <p className="truncate text-xs text-slate-400">{c.identifier}</p>}
                    </div>
                    {c.phone && (
                      <span className="hidden text-xs text-slate-400 sm:flex sm:items-center sm:gap-1">
                        <Icon name="Phone" size={11} />
                        {c.phone}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingClient(c); setShowClientForm(true); }}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                      >
                        <Icon name="Edit3" size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(c)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Devices section */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-700">Уреди към фирмата ({companyDevices.length})</h3>
            </div>
            {companyDevices.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-500">Няма присъединени уреди към тази фирма</p>
                <p className="mt-1 text-xs text-slate-400">Създайте или редактирайте уред и изберете тази фирма</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {companyDevices.map((d) => {
                  const locName = locations.find((l) => l.id === d.location_id)?.name;
                  return (
                    <div
                      key={d.id}
                      className="flex cursor-pointer items-center gap-3 px-6 py-3.5 transition-colors hover:bg-slate-50/50"
                      onClick={() => { setSelectedDeviceId(d.id); setView('detail'); setShowCompanyDetail(null); }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">{d.name}</p>
                        <p className="text-xs text-slate-400">
                          {d.unit}
                          {locName && <span> · {locName}</span>}
                        </p>
                      </div>
                      <Icon name="ChevronRight" size={16} className="text-slate-300" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {showCompanyForm && (
          <CompanyForm
            company={editingCompany}
            onSave={handleSaveCompany}
            onCancel={() => { setShowCompanyForm(false); setEditingCompany(null); }}
          />
        )}
        {showClientForm && (
          <ClientForm
            client={editingClient}
            companies={companies}
            defaultCompanyId={showCompanyDetail?.id}
            onSave={handleSaveClient}
            onCancel={() => { setShowClientForm(false); setEditingClient(null); }}
          />
        )}
        {showDeviceForm && (
          <DeviceForm
            device={editingDevice}
            companies={companies}
            locations={locations}
            allDevices={devices}
            deviceDependencies={deviceDependencies}
            onSave={handleSaveDevice}
            onCancel={() => { setShowDeviceForm(false); setEditingDevice(null); }}
          />
        )}
      </div>
    );
  }

  // Monthly entry view
  if (showMonthlyEntry) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header
          onAddDevice={() => { setEditingDevice(null); setShowDeviceForm(true); }}
          showAddDevice={isAdmin}
          userInfo={headerUserInfo}
          onLogout={handleLogout}
          rightExtra={
            <button
              onClick={() => setShowMonthlyEntry(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
            >
              <Icon name="ArrowLeft" size={16} />
              <span className="hidden sm:inline">Обратно</span>
            </button>
          }
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <MonthlyEntry
            devices={devices}
            readings={readings}
            companies={companies}
            clients={clients}
            deviceClients={deviceClients}
            deviceDependencies={deviceDependencies}
            locations={locations}
            onSave={handleSaveMonthlyReading}
            onBack={() => setShowMonthlyEntry(false)}
          />
        </main>

        {showDeviceForm && (
          <DeviceForm
            device={editingDevice}
            companies={companies}
            locations={locations}
            allDevices={devices}
            deviceDependencies={deviceDependencies}
            onSave={handleSaveDevice}
            onCancel={() => { setShowDeviceForm(false); setEditingDevice(null); }}
          />
        )}
      </div>
    );
  }

  // Users view (admin only)
  if (view === 'users' && isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header
          onAddDevice={() => { setEditingDevice(null); setShowDeviceForm(true); }}
          showAddDevice={isAdmin}
          userInfo={headerUserInfo}
          onLogout={handleLogout}
          rightExtra={
            <button
              onClick={() => setView('dashboard')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
            >
              <Icon name="ArrowLeft" size={16} />
              <span className="hidden sm:inline">Обратно</span>
            </button>
          }
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <UserManagementPanel
            companies={companies}
            locations={locations}
            onBack={() => setView('dashboard')}
          />
        </main>
      </div>
    );
  }

  // Suppliers view
  if (view === 'suppliers') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header
          onAddDevice={() => { setEditingDevice(null); setShowDeviceForm(true); }}
          showAddDevice={isAdmin}
          userInfo={headerUserInfo}
          onLogout={handleLogout}
          rightExtra={
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => { setEditingSupplier(null); setShowSupplierForm(true); }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
                >
                  <Icon name="Plus" size={16} />
                  <span className="hidden sm:inline">Нов доставчик</span>
                  <span className="sm:hidden">Доставчик</span>
                </button>
              )}
              <button
                onClick={() => setView('dashboard')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="ArrowLeft" size={16} />
                <span className="hidden sm:inline">Обратно</span>
              </button>
            </div>
          }
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <SuppliersView
            suppliers={isAdmin ? suppliers : suppliers.filter((s) => {
              if (!userCompanyIds) return true;
              if (!s.company_id) return true;
              return userCompanyIds.includes(s.company_id);
            })}
            invoices={supplierInvoices}
            companies={isAdmin ? companies : companies.filter((c) => !userCompanyIds || userCompanyIds.includes(c.id))}
            locations={isAdmin ? locations : locations.filter((l) => {
              if (!userCompanyIds) return true;
              if (!userCompanyIds.includes(l.company_id)) return false;
              if (!userAccessMap) return true;
              const allowed = userAccessMap[l.company_id];
              if (allowed === undefined || allowed === null) return true;
              return allowed.has(l.id);
            })}
            onSaveSupplier={handleSaveSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onSaveInvoice={handleSaveSupplierInvoice}
            onDeleteInvoice={handleDeleteSupplierInvoice}
            onBack={() => setView('dashboard')}
            isAdmin={isAdmin}
          />
        </main>

        {showSupplierForm && (
          <SupplierForm
            supplier={editingSupplier}
            companies={companies}
            locations={locations}
            onSave={handleSaveSupplier}
            onCancel={() => { setShowSupplierForm(false); setEditingSupplier(null); }}
          />
        )}
      </div>
    );
  }

  // Compensation report view
  if (view === 'compensation') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header
          onAddDevice={() => { setEditingDevice(null); setShowDeviceForm(true); }}
          showAddDevice={isAdmin}
          userInfo={headerUserInfo}
          onLogout={handleLogout}
          rightExtra={
            <button
              onClick={() => setView('dashboard')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
            >
              <Icon name="ArrowLeft" size={16} />
              <span className="hidden sm:inline">Обратно</span>
            </button>
          }
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <CompensationReport
            devices={devices}
            readings={readings}
            companies={companies}
            clients={clients}
            deviceClients={deviceClients}
            locations={locations}
            onBack={() => setView('dashboard')}
          />
        </main>
      </div>
    );
  }

  // Consumption report view
  if (view === 'report') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header
          onAddDevice={() => { setEditingDevice(null); setShowDeviceForm(true); }}
          showAddDevice={isAdmin}
          userInfo={headerUserInfo}
          onLogout={handleLogout}
          rightExtra={
            <button
              onClick={() => setView('dashboard')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
            >
              <Icon name="ArrowLeft" size={16} />
              <span className="hidden sm:inline">Обратно</span>
            </button>
          }
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <ConsumptionReport
            devices={devices}
            readings={readings}
            companies={companies}
            clients={clients}
            deviceClients={deviceClients}
            suppliers={suppliers}
            supplierInvoices={supplierInvoices}
            locations={locations}
            onBack={() => setView('dashboard')}
          />
        </main>
      </div>
    );
  }

  // Help page view
  if (view === 'help') {
    return (
      <HelpPage onBack={() => setView('dashboard')} />
    );
  }

  // Render
  if (view === 'detail' && selectedDevice) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header
          onAddDevice={() => { setEditingDevice(null); setShowDeviceForm(true); }}
          showAddDevice={isAdmin}
          userInfo={headerUserInfo}
          onLogout={handleLogout}
          rightExtra={
            <button
              onClick={() => { setSelectedDeviceId(null); setView('dashboard'); }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
            >
              <Icon name="ArrowLeft" size={16} />
              <span className="hidden sm:inline">Обратно</span>
            </button>
          }
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <DeviceDetail
            device={selectedDevice}
            readings={selectedReadings}
            deviceClients={selectedDeviceClients}
            availableClients={availableClientsForDevice}
            isAdmin={isAdmin}
            currentMonth={currentMonth}
            onBack={() => { setView('dashboard'); setSelectedDeviceId(null); }}
            onAddReading={() => { setEditingReading(null); setShowReadingForm(true); }}
            onEditReading={(r) => { setEditingReading(r); setShowReadingForm(true); }}
            onDeleteReading={isAdmin ? handleDeleteReading : undefined}
            onEditDevice={isAdmin ? () => { setEditingDevice(selectedDevice); setShowDeviceForm(true); } : undefined}
            onAddClient={isAdmin ? handleAddDeviceClient : undefined}
            onUpdateClientPercentage={isAdmin ? handleUpdateDeviceClientPercentage : undefined}
            onRemoveClient={isAdmin ? handleRemoveDeviceClient : undefined}
          />
        </main>

        {showDeviceForm && (
          <DeviceForm
            device={editingDevice}
            companies={companies}
            locations={locations}
            allDevices={devices}
            deviceDependencies={deviceDependencies}
            onSave={handleSaveDevice}
            onCancel={() => { setShowDeviceForm(false); setEditingDevice(null); }}
          />
        )}
        {showReadingForm && (
          <ReadingForm
            device={selectedDevice}
            existingReading={editingReading}
            defaultMonth={currentMonth}
            onSave={handleSaveReading}
            onCancel={() => { setShowReadingForm(false); setEditingReading(null); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        onAddDevice={() => { setEditingDevice(null); setShowDeviceForm(true); }}
        showAddDevice={isAdmin}
        userInfo={headerUserInfo}
        onLogout={handleLogout}
        rightExtra={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setView('users')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="Users" size={16} />
                <span className="hidden sm:inline">Потребители</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setView('report')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="FileText" size={16} />
                <span className="hidden sm:inline">Справка</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setView('compensation')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="Receipt" size={16} />
                <span className="hidden sm:inline">Компенсации</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setView('suppliers')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="FileText" size={16} />
                <span className="hidden sm:inline">Доставчици</span>
              </button>
            )}
            {devices.length > 0 && (
              <button
                onClick={() => setShowMonthlyEntry(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="Calendar" size={16} />
                <span className="hidden sm:inline">Въвеждане на показания</span>
                <span className="sm:hidden">Показания</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setEditingCompany(null); setShowCompanyForm(true); }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="Building2" size={16} />
                <span className="hidden sm:inline">Нова фирма</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setEditingClient(null); setShowClientForm(true); }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="UserPlus" size={16} />
                <span className="hidden sm:inline">Нов клиент</span>
              </button>
            )}
            <button
              onClick={() => setView('help')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
            >
              <Icon name="HelpCircle" size={16} />
              <span className="hidden sm:inline">Помощ</span>
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <Icon name="AlertCircle" size={18} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <Icon name="X" size={16} />
            </button>
          </div>
        )}

          {/* Filter bar */}
          {devices.length > 0 && companies.length > 0 && (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-sm">
                <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Търсене на уред..."
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
              {isAdmin && (
                <div className="relative">
                  <Icon name="Building2" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedLocationId('all'); }}
                    className="w-full appearance-none rounded-lg border border-slate-200 py-2.5 pl-9 pr-8 text-sm font-medium text-slate-700 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 sm:w-auto"
                  >
                    <option value="all">Всички фирми</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <Icon name="ChevronDown" size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              )}
              {!isAdmin && userCompanyIds && userCompanyIds.length > 1 && (
                <div className="relative">
                  <Icon name="Building2" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedLocationId('all'); }}
                    className="w-full appearance-none rounded-lg border border-slate-200 py-2.5 pl-9 pr-8 text-sm font-medium text-slate-700 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 sm:w-auto"
                  >
                    <option value="all">Моите фирми</option>
                    {companies.filter((c) => userCompanyIds.includes(c.id)).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <Icon name="ChevronDown" size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              )}
              {(() => {
                const availableLocations = locations.filter((l) => {
                  if (effectiveCompanyId !== 'all') return l.company_id === effectiveCompanyId;
                  if (!isAdmin && userCompanyIds) return userCompanyIds.includes(l.company_id);
                  return true;
                });
                if (availableLocations.length === 0) return null;
                return (
                  <div className="relative">
                    <Icon name="MapPin" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-slate-200 py-2.5 pl-9 pr-8 text-sm font-medium text-slate-700 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 sm:w-auto"
                    >
                      <option value="all">Всички локации</option>
                      {availableLocations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <Icon name="ChevronDown" size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                );
              })()}
            </div>
          )}

          {loading ? (
            <LoadingState />
          ) : devices.length === 0 ? (
            <EmptyState onAdd={isAdmin ? () => { setEditingDevice(null); setShowDeviceForm(true); } : () => {}} />
          ) : (
            <div className="space-y-8">
              {/* Clients with their devices */}
              {filteredClients.map((client) => {
                const clientDeviceIds = deviceClients
                  .filter((dc) => dc.client_id === client.id)
                  .map((dc) => dc.device_id);
                const clientDevices = filteredDevices.filter((d) => clientDeviceIds.includes(d.id));
                if (clientDevices.length === 0) return null;
                return (
                  <ClientDevicesSection
                    key={client.id}
                    client={client}
                    devices={clientDevices}
                    getReadingsWithDelta={getReadingsWithDelta}
                    onDeviceClick={(d) => { setSelectedDeviceId(d.id); setView('detail'); }}
                    onDeviceEdit={isAdmin ? (d) => { setEditingDevice(d); setShowDeviceForm(true); } : undefined}
                    onDeviceDelete={isAdmin ? (d) => handleDeleteDevice(d) : undefined}
                    onDeviceMoveUp={isAdmin ? (d) => handleReorderDevice(d, 'up') : undefined}
                    onDeviceMoveDown={isAdmin ? (d) => handleReorderDevice(d, 'down') : undefined}
                  />
                );
              })}

              {/* Unassigned devices (not linked to any client) */}
              {(() => {
                const linkedDeviceIds = new Set(deviceClients.map((dc) => dc.device_id));
                const unassigned = filteredDevices.filter((d) => !linkedDeviceIds.has(d.id));
                if (unassigned.length === 0) return null;
                return (
                  <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Уреди без клиент</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {unassigned.map((device, i) => (
                        <DeviceCard
                          key={device.id}
                          device={device}
                          readings={getReadingsWithDelta(device.id)}
                          onClick={() => { setSelectedDeviceId(device.id); setView('detail'); }}
                          onEdit={isAdmin ? () => { setEditingDevice(device); setShowDeviceForm(true); } : undefined}
                          onDelete={isAdmin ? () => handleDeleteDevice(device) : undefined}
                          onMoveUp={isAdmin ? () => handleReorderDevice(device, 'up') : undefined}
                          onMoveDown={isAdmin ? () => handleReorderDevice(device, 'down') : undefined}
                          canMoveUp={i > 0}
                          canMoveDown={i < unassigned.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* No results from search */}
              {filteredDevices.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-500">
                    {search.trim()
                      ? `Не са намерени уреди по търсенето "${search}"`
                      : 'Няма уреди за избраната фирма'}
                  </p>
                </div>
              )}

              {/* No clients hint */}
              {clients.length === 0 && devices.length > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3.5">
                  <Icon name="Lightbulb" size={18} className="mt-0.5 shrink-0 text-sky-500" />
                  <p className="text-sm text-sky-800">
                    Присъединете клиенти към уредите, за да ги групирате по клиент и да разпределяте потреблението.
                  </p>
                </div>
              )}
            </div>
          )}
      </main>

      {showDeviceForm && (
        <DeviceForm
          device={editingDevice}
          companies={companies}
          locations={locations}
          allDevices={devices}
          deviceDependencies={deviceDependencies}
          onSave={handleSaveDevice}
          onCancel={() => { setShowDeviceForm(false); setEditingDevice(null); }}
        />
      )}
      {showReadingForm && selectedDevice && (
        <ReadingForm
          device={selectedDevice}
          existingReading={editingReading}
          defaultMonth={currentMonth}
          onSave={handleSaveReading}
          onCancel={() => { setShowReadingForm(false); setEditingReading(null); }}
        />
      )}
      {showCompanyForm && (
        <CompanyForm
          company={editingCompany}
          onSave={handleSaveCompany}
          onCancel={() => { setShowCompanyForm(false); setEditingCompany(null); }}
        />
      )}
      {showClientForm && (
        <ClientForm
          client={editingClient}
          companies={companies}
          defaultCompanyId={(showCompanyDetail as Company | null)?.id ?? undefined}
          onSave={handleSaveClient}
          onCancel={() => { setShowClientForm(false); setEditingClient(null); }}
        />
      )}
    </div>
  );
}

function ClientDevicesSection({
  client,
  devices,
  getReadingsWithDelta,
  onDeviceClick,
  onDeviceEdit,
  onDeviceDelete,
  onDeviceMoveUp,
  onDeviceMoveDown,
}: {
  client: Client;
  devices: Device[];
  getReadingsWithDelta: (deviceId: string) => ReadingWithDelta[];
  onDeviceClick: (device: Device) => void;
  onDeviceEdit?: (device: Device) => void;
  onDeviceDelete?: (device: Device) => void;
  onDeviceMoveUp?: (device: Device) => void;
  onDeviceMoveDown?: (device: Device) => void;
}) {
  return (
    <div>
      {/* Client header bar */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <Icon name="Users" size={20} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-base font-bold text-slate-900">{client.name}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {devices.length} уреда
            {client.identifier && <span> · {client.identifier}</span>}
            {client.phone && <span> · {client.phone}</span>}
          </p>
        </div>
      </div>

      {/* Devices grid under this client */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {devices.map((device, i) => (
          <DeviceCard
            key={device.id}
            device={device}
            readings={getReadingsWithDelta(device.id)}
            onClick={() => onDeviceClick(device)}
            onEdit={onDeviceEdit ? () => onDeviceEdit(device) : undefined}
            onDelete={onDeviceDelete ? () => onDeviceDelete(device) : undefined}
            onMoveUp={onDeviceMoveUp ? () => onDeviceMoveUp(device) : undefined}
            onMoveDown={onDeviceMoveDown ? () => onDeviceMoveDown(device) : undefined}
            canMoveUp={i > 0}
            canMoveDown={i < devices.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function Header({
  onAddDevice,
  rightExtra,
  showAddDevice = true,
  userInfo,
  onLogout,
}: {
  onAddDevice: () => void;
  rightExtra?: React.ReactNode;
  showAddDevice?: boolean;
  userInfo?: { name: string; role: string } | null;
  onLogout?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 shadow-sm">
              <Icon name="Gauge" size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Уреди и Показания</h1>
              <p className="text-xs text-slate-400 leading-tight">Управление на месечни показания</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rightExtra}
            {showAddDevice && (
              <button
                onClick={onAddDevice}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 active:scale-95"
              >
                <Icon name="Plus" size={17} />
                <span className="hidden sm:inline">Добави уред</span>
                <span className="sm:hidden">Уред</span>
              </button>
            )}
            {userInfo && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-semibold text-slate-700">{userInfo.name}</p>
                  <p className="text-xs text-slate-400">{userInfo.role}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                  <Icon name="User" size={15} className="text-slate-500" />
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Изход"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Icon name="LogOut" size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-slate-200" />
            <div className="flex-1">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
            </div>
          </div>
          <div className="mt-4 h-8 w-28 rounded bg-slate-100" />
          <div className="mt-4 h-px bg-slate-100" />
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-100 to-sky-50 shadow-sm">
        <Icon name="Gauge" size={36} className="text-sky-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">Няма регистрирани уреди</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Добавете първия си уред за следене на показанията — електричество, вода, газ
        или друг измервателен уред.
      </p>
      <button
        onClick={onAdd}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 active:scale-95"
      >
        <Icon name="Plus" size={18} />
        Добави първия уред
      </button>
    </div>
  );
}

function LocationAddForm({ companyId, onAdd }: { companyId: string; onAdd: (companyId: string, name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd(companyId, name.trim());
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      {error && <span className="text-xs text-red-500">{error}</span>}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Нова локация..."
        className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
      />
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 disabled:opacity-50"
      >
        <Icon name="Plus" size={14} />
        Добави
      </button>
    </form>
  );
}

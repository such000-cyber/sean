import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type DeviceType = 'electricity' | 'water' | 'gas' | 'heat' | 'other';

export interface Company {
  id: string;
  name: string;
  bulstat: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface CompanyLocation {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export interface Client {
  id: string;
  company_id: string;
  name: string;
  identifier: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface DeviceClient {
  id: string;
  device_id: string;
  client_id: string;
  percentage: number;
  created_at: string;
}

export interface DeviceClientWithClient extends DeviceClient {
  client: Client;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  unit: string;
  number: string | null;
  inventory_number: string | null;
  coefficient: number;
  location: string | null;
  location_id: string | null;
  is_base: boolean;
  /** Уред без брояч: показанието за месеца е самото потребление. Може да липсва, ако миграцията не е приложена. */
  is_manual?: boolean;
  color: string;
  company_id: string | null;
  sort_order: number;
  depends_on_device_id: string | null;
  created_at: string;
}

export interface Reading {
  id: string;
  device_id: string;
  reading_date: string;
  value: number;
  raw_value: number | null;
  /** Корекция към потреблението за месеца (+/−), след коефициента. Може да липсва, ако миграцията не е приложена. */
  adjustment?: number | null;
  note: string | null;
  created_at: string;
}

export interface ReadingWithDelta extends Reading {
  delta: number | null;
  previousValue: number | null;
}

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  electricity: 'Електричество',
  water: 'Вода',
  gas: 'Газ',
  heat: 'Топлофикация',
  other: 'Друг',
};

export const DEVICE_TYPE_ICONS: Record<DeviceType, string> = {
  electricity: 'Zap',
  water: 'Droplets',
  gas: 'Flame',
  heat: 'Thermometer',
  other: 'Gauge',
};

export const DEVICE_COLORS: string[] = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export const DEVICE_UNITS: string[] = ['kWh', 'm³', 'GJ', 'kW', 'л', 'MW'];

export type ServiceType = 'electricity' | 'water' | 'gas' | 'heat' | 'other';

export interface Supplier {
  id: string;
  name: string;
  service_type: ServiceType;
  company_id: string | null;
  location_id: string | null;
  bulstat: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface SupplierInvoice {
  id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  service_month: string;
  quantity: number;
  unit: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  note: string | null;
  created_at: string;
}

export interface SupplierInvoiceWithSupplier extends SupplierInvoice {
  supplier: Supplier;
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  electricity: 'Електричество',
  water: 'Вода',
  gas: 'Газ',
  heat: 'Топлофикация',
  other: 'Друг',
};

export const SERVICE_TYPE_ICONS: Record<ServiceType, string> = {
  electricity: 'Zap',
  water: 'Droplets',
  gas: 'Flame',
  heat: 'Thermometer',
  other: 'Gauge',
};

export type UserRole = 'admin' | 'company_user';

export interface UserProfile {
  id: string;
  role: UserRole;
  company_id: string | null;
  full_name: string | null;
  created_at: string;
}

export interface UserCompanyAccess {
  id: string;
  user_id: string;
  company_id: string;
  location_id: string | null;
  created_at: string;
}

export interface UserWithCompany extends UserProfile {
  email: string | null;
  company_name: string | null;
  access: UserCompanyAccess[];
}

export interface DeviceDependency {
  id: string;
  device_id: string;
  depends_on_device_id: string;
  sort_order: number;
  created_at: string;
}

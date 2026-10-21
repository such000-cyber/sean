import { useState, useEffect, useCallback } from 'react';
import { supabase, type Company, type CompanyLocation, type UserWithCompany, type UserRole, type UserCompanyAccess } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/Icon';

interface UserManagementPanelProps {
  companies: Company[];
  locations: CompanyLocation[];
  onBack: () => void;
}

interface AccessEntry {
  company_id: string;
  location_id: string | null;
  existing_id?: string;
}

export function UserManagementPanel({ companies, locations, onBack }: UserManagementPanelProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editAccessEntries, setEditAccessEntries] = useState<AccessEntry[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('company_user');
  const [accessEntries, setAccessEntries] = useState<AccessEntry[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (profilesError) throw profilesError;

      const { data: allAccess } = await supabase
        .from('user_company_access')
        .select('*');

      const accessByUser: Record<string, UserCompanyAccess[]> = {};
      for (const a of (allAccess as UserCompanyAccess[]) ?? []) {
        if (!accessByUser[a.user_id]) accessByUser[a.user_id] = [];
        accessByUser[a.user_id].push(a);
      }

      const enriched: UserWithCompany[] = (profiles ?? []).map((p) => {
        let email: string | null = null;
        if (p.id === user?.id && user) {
          email = user.email ?? null;
        }
        const access = accessByUser[p.id] ?? [];
        const companyName = access.length > 0
          ? access.map((a) => {
              const c = companies.find((c) => c.id === a.company_id);
              const loc = a.location_id ? locations.find((l) => l.id === a.location_id) : null;
              return loc ? `${c?.name ?? '—'} — ${loc.name}` : c?.name ?? '—';
            }).join(', ')
          : (p.company_id ? companies.find((c) => c.id === p.company_id)?.name ?? null : null);

        return { ...p, email, company_name: companyName, access };
      });

      setUsers(enriched);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Грешка при зареждане');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [companies, locations, user]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Polling fallback: silently refresh users every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => { fetchUsers(true); }, 5000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  const handleAddAccess = () => {
    setAccessEntries((prev) => [...prev, { company_id: '', location_id: null }]);
  };

  const handleRemoveAccess = (index: number) => {
    setAccessEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAccessChange = (index: number, field: 'company_id' | 'location_id', value: string) => {
    setAccessEntries((prev) => prev.map((entry, i) => {
      if (i !== index) return entry;
      if (field === 'company_id') return { company_id: value, location_id: null };
      return { ...entry, location_id: value || null };
    }));
  };

  // --- Edit access for existing user ---

  const startEditAccess = (u: UserWithCompany) => {
    setEditingUserId(u.id);
    setEditAccessEntries(
      u.access.map((a) => ({
        company_id: a.company_id,
        location_id: a.location_id,
        existing_id: a.id,
      }))
    );
  };

  const cancelEditAccess = () => {
    setEditingUserId(null);
    setEditAccessEntries([]);
  };

  const handleEditAddAccess = () => {
    setEditAccessEntries((prev) => [...prev, { company_id: '', location_id: null }]);
  };

  const handleEditRemoveAccess = (index: number) => {
    setEditAccessEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditAccessChange = (index: number, field: 'company_id' | 'location_id', value: string) => {
    setEditAccessEntries((prev) => prev.map((entry, i) => {
      if (i !== index) return entry;
      if (field === 'company_id') return { ...entry, company_id: value, location_id: null };
      return { ...entry, location_id: value || null };
    }));
  };

  const handleSaveAccess = async () => {
    if (!editingUserId) return;
    setSavingAccess(true);
    setError(null);

    try {
      const editingUser = users.find((u) => u.id === editingUserId);
      if (!editingUser) throw new Error('Потребителят не е намерен');

      const existingIds = new Set(editingUser.access.map((a) => a.id));
      const keptIds = new Set<string>();
      const toInsert: { user_id: string; company_id: string; location_id: string | null }[] = [];

      for (const entry of editAccessEntries) {
        if (!entry.company_id) continue;
        if (entry.existing_id) {
          keptIds.add(entry.existing_id);
        } else {
          toInsert.push({
            user_id: editingUserId,
            company_id: entry.company_id,
            location_id: entry.location_id ?? null,
          });
        }
      }

      const toDelete = [...existingIds].filter((id) => !keptIds.has(id));

      if (toDelete.length > 0) {
        const { error: delError } = await supabase
          .from('user_company_access')
          .delete()
          .in('id', toDelete);
        if (delError) throw delError;
      }

      if (toInsert.length > 0) {
        const { error: insError } = await supabase
          .from('user_company_access')
          .insert(toInsert);
        if (insError) throw insError;
      }

      setEditingUserId(null);
      setEditAccessEntries([]);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при запазване');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Няма активна сесия');

      const validAccess = accessEntries.filter((a) => a.company_id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            role,
            access: role === 'company_user' ? validAccess : undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Грешка при създаване на потребител');
      }

      setShowForm(false);
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('company_user');
      setAccessEntries([]);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при създаване');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          <Icon name="ArrowLeft" size={18} />
          Обратно
        </button>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 active:scale-95"
        >
          <Icon name="UserPlus" size={16} />
          <span className="hidden sm:inline">Нов потребител</span>
          <span className="sm:hidden">Потребител</span>
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Управление на потребители</h2>
        <p className="mt-1 text-sm text-slate-500">
          Създаване на администратори и потребители с достъп до фирми и локации
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Icon name="AlertCircle" size={18} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <Icon name="X" size={16} />
          </button>
        </div>
      )}

      {showForm && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/40 shadow-sm">
          <div className="border-b border-sky-100 bg-sky-50/60 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-700">Създаване на нов потребител</h3>
          </div>
          <form onSubmit={handleCreateUser} className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Име и фамилия</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="Иван Иванов"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Имейл</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="ivan@firma.bg"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Парола</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Роля</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="company_user">Потребител по фирма</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
            </div>

            {role === 'company_user' && (
              <AccessEditor
                entries={accessEntries}
                companies={companies}
                locations={locations}
                onAdd={handleAddAccess}
                onRemove={handleRemoveAccess}
                onChange={handleAccessChange}
              />
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 disabled:opacity-50"
              >
                {creating ? 'Създаване...' : 'Създай потребител'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                Отказ
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Зареждане...</div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Icon name="Users" size={22} className="text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">Няма регистрирани потребители</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-700">Потребители ({users.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {users.map((u) => {
              const isExpanded = expandedUserId === u.id;
              return (
                <div key={u.id}>
                  <div
                    className="flex cursor-pointer items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/50"
                    onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {u.role === 'admin' ? (
                        <Icon name="Shield" size={16} className="text-sky-600" />
                      ) : (
                        <Icon name="User" size={16} className="text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {u.full_name || u.email || 'Без име'}
                        {u.id === user?.id && <span className="ml-2 text-xs text-slate-400">(вие)</span>}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {u.email || '—'} · {u.role === 'admin' ? 'Администратор' : 'Потребител по фирма'}
                        {u.access.length > 0 && (
                          <span> · {u.access.length} {u.access.length === 1 ? 'достъп' : 'достъпа'}</span>
                        )}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.role === 'admin'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {u.role === 'admin' ? 'Админ' : 'Фирма'}
                    </span>
                    <Icon
                      name="ChevronRight"
                      size={16}
                      className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-50 bg-slate-50/30 px-5 py-4">
                      {u.role === 'admin' ? (
                        <p className="text-sm text-slate-500">Пълен достъп до всички фирми и локации</p>
                      ) : editingUserId === u.id ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-700">Редактиране на достъп</span>
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveAccess}
                                disabled={savingAccess}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-sky-700 disabled:opacity-50"
                              >
                                <Icon name="Check" size={14} />
                                {savingAccess ? 'Запазване...' : 'Запази'}
                              </button>
                              <button
                                onClick={cancelEditAccess}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50"
                              >
                                <Icon name="X" size={14} />
                                Отказ
                              </button>
                            </div>
                          </div>
                          <AccessEditor
                            entries={editAccessEntries}
                            companies={companies}
                            locations={locations}
                            onAdd={handleEditAddAccess}
                            onRemove={handleEditRemoveAccess}
                            onChange={handleEditAccessChange}
                          />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {u.access.length > 0 ? (
                            <div className="space-y-1.5">
                              {u.access.map((a) => {
                                const c = companies.find((c) => c.id === a.company_id);
                                const loc = a.location_id ? locations.find((l) => l.id === a.location_id) : null;
                                return (
                                  <div key={a.id} className="flex items-center gap-2 text-sm text-slate-600">
                                    <Icon name="Building2" size={13} className="text-slate-400" />
                                    <span className="font-medium">{c?.name ?? '—'}</span>
                                    {loc ? (
                                      <>
                                        <Icon name="ChevronRight" size={12} className="text-slate-300" />
                                        <span className="flex items-center gap-1">
                                          <Icon name="MapPin" size={12} className="text-sky-400" />
                                          {loc.name}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-xs text-slate-400">(всички локации)</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">
                              {u.company_name ? `Наследен достъп: ${u.company_name}` : 'Без фирмен достъп'}
                            </p>
                          )}
                          <button
                            onClick={() => startEditAccess(u)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
                          >
                            <Icon name="Edit3" size={14} />
                            Редактирай достъп
                          </button>
                        </div>
                      )}
                    </div>
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

interface AccessEditorProps {
  entries: AccessEntry[];
  companies: Company[];
  locations: CompanyLocation[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: 'company_id' | 'location_id', value: string) => void;
}

function AccessEditor({ entries, companies, locations, onAdd, onRemove, onChange }: AccessEditorProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Достъп до фирми и локации</label>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-emerald-700"
        >
          <Icon name="Plus" size={14} />
          Добави
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="py-3 text-center text-sm text-slate-400">
          Няма добавени фирми. Натиснете "Добави", за да дадете достъп.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => {
            const companyLocations = locations.filter((l) => l.company_id === entry.company_id);
            return (
              <div key={index} className="flex items-start gap-2">
                <select
                  value={entry.company_id}
                  onChange={(e) => onChange(index, 'company_id', e.target.value)}
                  required
                  className="flex-1 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">— Изберете фирма —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={entry.location_id ?? ''}
                  onChange={(e) => onChange(index, 'location_id', e.target.value)}
                  disabled={!entry.company_id || companyLocations.length === 0}
                  className="flex-1 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-40"
                >
                  <option value="">Всички локации</option>
                  {companyLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Icon name="Trash2" size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Ако изберете "Всички локации", потребителят ще вижда всички данни за избраната фирма. Ако изберете конкретна локация — само данните за нея.
      </p>
    </div>
  );
}

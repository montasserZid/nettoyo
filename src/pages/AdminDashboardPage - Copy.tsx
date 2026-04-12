import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { PaginationControls } from '../components/PaginationControls';
import { useAuth } from '../context/AuthContext';

type Tab = 'overview' | 'bookings' | 'clients' | 'cleaners' | 'settings';
type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'expired' | 'accepted';
type Paged<T> = { items: T[]; page: number; totalPages: number; total: number; pageSize: number };

type Stats = {
  totalUsers: number;
  totalClients: number;
  totalCleaners: number;
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  expiredBookings: number;
  newUsersThisMonth: number;
  platformFeeRevenue: { value: number; currency: string; sourceColumn: string; capped: boolean } | null;
};

type Booking = {
  id: string;
  serviceType: string | null;
  scheduledAt: string | null;
  status: BookingStatus;
  createdAt: string | null;
  city: string | null;
  client: { id: string | null; name: string | null; email: string | null };
  cleaner: { id: string | null; name: string | null; email: string | null };
};

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  zone: string | null;
  createdAt: string | null;
  active: boolean;
  bookingsCount: number;
  completedJobs: number;
  ratingAverage: number | null;
  ratingCount: number;
  services: string[];
};

type SettingsRes = {
  supported: boolean;
  createTableSql?: string;
  settings: {
    platformFeeAmount: number;
    sameDayLeadHours: number;
    featureToggles: Record<string, unknown>;
  };
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'bookings', label: 'Reservations' },
  { id: 'clients', label: 'Clients' },
  { id: 'cleaners', label: 'Nettoyeurs' },
  { id: 'settings', label: 'Parametres' }
];

const statuses: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'expired', 'accepted'];

function fmtDate(value: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function chip(status: string) {
  if (status === 'completed') return 'bg-[rgba(168,230,207,0.3)] text-[#065F46]';
  if (status === 'confirmed' || status === 'accepted') return 'bg-[rgba(79,195,247,0.18)] text-[#0369A1]';
  if (status === 'pending') return 'bg-[rgba(251,191,36,0.22)] text-[#92400E]';
  if (status === 'cancelled') return 'bg-[rgba(248,113,113,0.18)] text-[#B91C1C]';
  return 'bg-[rgba(156,163,175,0.24)] text-[#374151]';
}

export function AdminDashboardPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [bookings, setBookings] = useState<Paged<Booking> | null>(null);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingDraft, setBookingDraft] = useState<Record<string, BookingStatus>>({});
  const [bStatus, setBStatus] = useState('all');
  const [bDate, setBDate] = useState('');
  const [bCity, setBCity] = useState('');
  const [bId, setBId] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [clients, setClients] = useState<Paged<UserRow> | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<UserRow | null>(null);

  const [cleaners, setCleaners] = useState<Paged<UserRow> | null>(null);
  const [loadingCleaners, setLoadingCleaners] = useState(false);
  const [cleanerPage, setCleanerPage] = useState(1);
  const [cleanerSearch, setCleanerSearch] = useState('');
  const [selectedCleaner, setSelectedCleaner] = useState<{ row: UserRow; mode: 'profile' | 'activity' } | null>(
    null
  );

  const [settings, setSettings] = useState<SettingsRes | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const api = useCallback(
    async (url: string, init?: RequestInit) => {
      if (!token) throw new Error('Session admin invalide.');
      const response = await fetch(url, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${token}`,
          ...(init?.body ? { 'Content-Type': 'application/json' } : {})
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Erreur serveur.');
      return payload;
    },
    [token]
  );

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await api('/api/admin/overview');
      setStats(data.stats as Stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement stats impossible.');
    } finally {
      setLoadingStats(false);
    }
  }, [api]);

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const params = new URLSearchParams({ page: String(bookingPage), pageSize: '12' });
      if (bStatus !== 'all') params.set('status', bStatus);
      if (bDate) params.set('date', bDate);
      if (bCity) params.set('city', bCity);
      if (bId) params.set('bookingId', bId);
      const data = (await api(`/api/admin/bookings?${params.toString()}`)) as Paged<Booking>;
      setBookings(data);
      setBookingDraft((prev) => {
        const next = { ...prev };
        data.items.forEach((row) => {
          if (!next[row.id]) next[row.id] = row.status;
        });
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement reservations impossible.');
    } finally {
      setLoadingBookings(false);
    }
  }, [api, bCity, bDate, bId, bStatus, bookingPage]);

  const loadUsers = useCallback(
    async (mode: 'clients' | 'cleaners', page: number, search: string) => {
      const params = new URLSearchParams({ mode, page: String(page), pageSize: '12' });
      if (search.trim()) params.set('search', search.trim());
      return (await api(`/api/admin/users?${params.toString()}`)) as Paged<UserRow>;
    },
    [api]
  );

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      setClients(await loadUsers('clients', clientPage, clientSearch));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement clients impossible.');
    } finally {
      setLoadingClients(false);
    }
  }, [clientPage, clientSearch, loadUsers]);

  const loadCleaners = useCallback(async () => {
    setLoadingCleaners(true);
    try {
      setCleaners(await loadUsers('cleaners', cleanerPage, cleanerSearch));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement nettoyeurs impossible.');
    } finally {
      setLoadingCleaners(false);
    }
  }, [cleanerPage, cleanerSearch, loadUsers]);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      setSettings((await api('/api/admin/settings')) as SettingsRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement parametres impossible.');
    } finally {
      setLoadingSettings(false);
    }
  }, [api]);

  useEffect(() => {
    if (token) void loadStats();
  }, [token, loadStats]);

  useEffect(() => {
    if (tab === 'bookings' && token) void loadBookings();
  }, [tab, token, loadBookings]);

  useEffect(() => {
    if (tab === 'clients' && token) void loadClients();
  }, [tab, token, loadClients]);

  useEffect(() => {
    if (tab === 'cleaners' && token) void loadCleaners();
  }, [tab, token, loadCleaners]);

  useEffect(() => {
    if (tab === 'settings' && token) void loadSettings();
  }, [tab, token, loadSettings]);

  const saveBookingStatus = async (id: string, status: BookingStatus) => {
    try {
      await api('/api/admin/bookings', { method: 'PATCH', body: JSON.stringify({ bookingId: id, status }) });
      await Promise.all([loadBookings(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise a jour reservation impossible.');
    }
  };

  const cancelBooking = async (booking: Booking) => {
    if (booking.status === 'cancelled') return;
    if (!window.confirm('Annuler cette reservation ?')) return;
    await saveBookingStatus(booking.id, 'cancelled');
  };

  const userAction = async (mode: 'clients' | 'cleaners', id: string, action: 'deactivate' | 'reactivate' | 'delete') => {
    try {
      if (action === 'delete') {
        if (!window.confirm('Supprimer ce compte definitivement ?')) return;
        await api('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ userId: id }) });
      } else {
        await api('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ userId: id, action }) });
      }
      await Promise.all([loadStats(), mode === 'clients' ? loadClients() : loadCleaners()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action utilisateur impossible.');
    }
  };

  const saveSettings = async () => {
    if (!settings?.supported) return;
    setSavingSettings(true);
    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings.settings) });
      await Promise.all([loadSettings(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement parametres impossible.');
    } finally {
      setSavingSettings(false);
    }
  };

  const metricCards = useMemo(
    () =>
      stats
        ? [
            ['Utilisateurs', stats.totalUsers],
            ['Clients', stats.totalClients],
            ['Nettoyeurs', stats.totalCleaners],
            ['Reservations', stats.totalBookings],
            ['Pending', stats.pendingBookings],
            ['Confirmed', stats.confirmedBookings],
            ['Completed', stats.completedBookings],
            ['Cancelled', stats.cancelledBookings],
            ['Expired', stats.expiredBookings],
            ['Nouveaux (mois)', stats.newUsersThisMonth]
          ]
        : [],
    [stats]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.06)]">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#4FC3F7]">Nettoyo Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1A1A2E] sm:text-3xl">Dashboard d'administration</h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Gestion operationnelle: reservations, clients, nettoyeurs et parametres.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl bg-[rgba(220,38,38,0.08)] px-4 py-3 text-sm font-medium text-[#DC2626]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-[0_8px_24px_rgba(17,24,39,0.05)]">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                tab === item.id ? 'bg-[rgba(79,195,247,0.14)] text-[#0369A1]' : 'text-[#4B5563] hover:bg-[#F8FAFC]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.05)] sm:p-5">
          {tab === 'overview' ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#1A1A2E]">Vue d'ensemble</h2>
                <button
                  type="button"
                  onClick={() => void loadStats()}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D1E7F7] bg-[#F8FCFF] px-3 py-2 text-xs font-semibold text-[#0369A1]"
                >
                  <RefreshCw size={14} />
                  Actualiser
                </button>
              </div>

              {loadingStats ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-[#4FC3F7]" />
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {metricCards.map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-[#EEF2F7] bg-[#F8FAFC] px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">{label}</p>
                        <p className="mt-1 text-xl font-bold text-[#1A1A2E]">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#D1E7F7] bg-[#F8FCFF] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#0284C7]">Revenus frais plateforme</p>
                    <p className="mt-1 text-2xl font-bold text-[#1A1A2E]">
                      {stats?.platformFeeRevenue
                        ? `${stats.platformFeeRevenue.value.toFixed(2)} ${stats.platformFeeRevenue.currency}`
                        : 'Non disponible'}
                    </p>
                    {stats?.platformFeeRevenue ? (
                      <p className="mt-1 text-xs text-[#64748B]">
                        Source: {stats.platformFeeRevenue.sourceColumn}
                        {stats.platformFeeRevenue.capped ? ' (partiel)' : ''}
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {tab === 'bookings' ? (
            <div>
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Statut</label>
                  <select
                    value={bStatus}
                    onChange={(event) => {
                      setBStatus(event.target.value);
                      setBookingPage(1);
                    }}
                    className="rounded-xl border border-[#D1E7F7] bg-[#F8FCFF] px-3 py-2 text-sm"
                  >
                    <option value="all">Tous</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Date</label>
                  <input
                    type="date"
                    value={bDate}
                    onChange={(event) => {
                      setBDate(event.target.value);
                      setBookingPage(1);
                    }}
                    className="rounded-xl border border-[#D1E7F7] bg-[#F8FCFF] px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Ville</label>
                  <input
                    value={bCity}
                    onChange={(event) => {
                      setBCity(event.target.value);
                      setBookingPage(1);
                    }}
                    className="rounded-xl border border-[#D1E7F7] bg-[#F8FCFF] px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Booking ID</label>
                  <input
                    value={bId}
                    onChange={(event) => {
                      setBId(event.target.value);
                      setBookingPage(1);
                    }}
                    className="rounded-xl border border-[#D1E7F7] bg-[#F8FCFF] px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void loadBookings()}
                  className="h-[40px] rounded-xl bg-[#4FC3F7] px-4 text-sm font-semibold text-white"
                >
                  Recharger
                </button>
              </div>

              {loadingBookings ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-[#4FC3F7]" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-[#EEF2F7]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#F8FAFC] text-left text-xs uppercase tracking-wide text-[#6B7280]">
                        <tr>
                          <th className="px-3 py-2">ID</th>
                          <th className="px-3 py-2">Client</th>
                          <th className="px-3 py-2">Nettoyeur</th>
                          <th className="px-3 py-2">Ville</th>
                          <th className="px-3 py-2">Service</th>
                          <th className="px-3 py-2">Date/Heure</th>
                          <th className="px-3 py-2">Cree le</th>
                          <th className="px-3 py-2">Statut</th>
                          <th className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(bookings?.items ?? []).map((row) => (
                          <tr key={row.id} className="border-t border-[#EEF2F7]">
                            <td className="px-3 py-2 font-mono text-xs">{row.id.slice(0, 8)}...</td>
                            <td className="px-3 py-2">{row.client.name || row.client.email || '--'}</td>
                            <td className="px-3 py-2">{row.cleaner.name || row.cleaner.email || '--'}</td>
                            <td className="px-3 py-2">{row.city || '--'}</td>
                            <td className="px-3 py-2">{row.serviceType || '--'}</td>
                            <td className="px-3 py-2">{fmtDate(row.scheduledAt)}</td>
                            <td className="px-3 py-2">{fmtDate(row.createdAt)}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${chip(row.status)}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedBooking(row)}
                                  className="rounded-lg border border-[#D1E7F7] bg-[#F8FCFF] px-2 py-1 text-xs font-semibold text-[#0369A1]"
                                >
                                  Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void cancelBooking(row)}
                                  disabled={row.status === 'cancelled'}
                                  className="rounded-lg border border-[#FCA5A5] px-2 py-1 text-xs font-semibold text-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Annuler
                                </button>
                                <select
                                  value={bookingDraft[row.id] ?? row.status}
                                  onChange={(event) =>
                                    setBookingDraft((current) => ({
                                      ...current,
                                      [row.id]: event.target.value as BookingStatus
                                    }))
                                  }
                                  className="rounded-lg border border-[#D1E7F7] bg-[#F8FCFF] px-2 py-1 text-xs"
                                >
                                  {statuses.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => void saveBookingStatus(row.id, bookingDraft[row.id] ?? row.status)}
                                  className="rounded-lg bg-[#4FC3F7] px-2 py-1 text-xs font-bold text-white"
                                >
                                  MAJ
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <PaginationControls
                    page={bookings?.page ?? 1}
                    totalPages={bookings?.totalPages ?? 1}
                    onPageChange={setBookingPage}
                    labels={{ previous: 'Precedent', next: 'Suivant', page: 'Page' }}
                    className="mt-4"
                  />

                  {selectedBooking ? (
                    <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold uppercase tracking-[0.1em] text-[#64748B]">Booking details</p>
                        <button
                          type="button"
                          onClick={() => setSelectedBooking(null)}
                          className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-semibold text-[#64748B]"
                        >
                          Fermer
                        </button>
                      </div>
                      <div className="grid gap-3 text-sm text-[#1A1A2E] sm:grid-cols-2">
                        <p>
                          <span className="font-semibold">ID:</span> {selectedBooking.id}
                        </p>
                        <p>
                          <span className="font-semibold">Statut:</span> {selectedBooking.status}
                        </p>
                        <p>
                          <span className="font-semibold">Client:</span>{' '}
                          {selectedBooking.client.name || selectedBooking.client.email || '--'}
                        </p>
                        <p>
                          <span className="font-semibold">Nettoyeur:</span>{' '}
                          {selectedBooking.cleaner.name || selectedBooking.cleaner.email || '--'}
                        </p>
                        <p>
                          <span className="font-semibold">Ville:</span> {selectedBooking.city || '--'}
                        </p>
                        <p>
                          <span className="font-semibold">Service:</span> {selectedBooking.serviceType || '--'}
                        </p>
                        <p>
                          <span className="font-semibold">Date/Heure:</span> {fmtDate(selectedBooking.scheduledAt)}
                        </p>
                        <p>
                          <span className="font-semibold">Cree le:</span> {fmtDate(selectedBooking.createdAt)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {tab === 'clients' ? (
            <div>
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Recherche</label>
                  <input
                    value={clientSearch}
                    onChange={(event) => {
                      setClientSearch(event.target.value);
                      setClientPage(1);
                    }}
                    className="rounded-xl border border-[#D1E7F7] bg-[#F8FCFF] px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void loadClients()}
                  className="h-[40px] rounded-xl bg-[#4FC3F7] px-4 text-sm font-semibold text-white"
                >
                  Rechercher
                </button>
              </div>

              {loadingClients ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-[#4FC3F7]" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-[#EEF2F7]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#F8FAFC] text-left text-xs uppercase tracking-wide text-[#6B7280]">
                        <tr>
                          <th className="px-3 py-2">Nom</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Telephone</th>
                          <th className="px-3 py-2">Ville</th>
                          <th className="px-3 py-2">Bookings</th>
                          <th className="px-3 py-2">Cree le</th>
                          <th className="px-3 py-2">Statut</th>
                          <th className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(clients?.items ?? []).map((row) => (
                          <tr key={row.id} className="border-t border-[#EEF2F7]">
                            <td className="px-3 py-2 font-semibold">{row.name}</td>
                            <td className="px-3 py-2">{row.email || '--'}</td>
                            <td className="px-3 py-2">{row.phone || '--'}</td>
                            <td className="px-3 py-2">{row.city || '--'}</td>
                            <td className="px-3 py-2">{row.bookingsCount}</td>
                            <td className="px-3 py-2">{fmtDate(row.createdAt)}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                  row.active
                                    ? 'bg-[rgba(168,230,207,0.3)] text-[#065F46]'
                                    : 'bg-[rgba(248,113,113,0.18)] text-[#B91C1C]'
                                }`}
                              >
                                {row.active ? 'Actif' : 'Desactive'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedClient(row)}
                                  className="rounded-lg border border-[#D1E7F7] bg-[#F8FCFF] px-2 py-1 text-xs text-[#0369A1]"
                                >
                                  Voir profil
                                </button>
                                {row.active ? (
                                  <button
                                    type="button"
                                    onClick={() => void userAction('clients', row.id, 'deactivate')}
                                    className="rounded-lg border border-[#FCA5A5] px-2 py-1 text-xs text-[#B91C1C]"
                                  >
                                    Desactiver
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void userAction('clients', row.id, 'reactivate')}
                                    className="rounded-lg border border-[#86EFAC] px-2 py-1 text-xs text-[#166534]"
                                  >
                                    Reactiver
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void userAction('clients', row.id, 'delete')}
                                  className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs text-[#6B7280]"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <PaginationControls
                    page={clients?.page ?? 1}
                    totalPages={clients?.totalPages ?? 1}
                    onPageChange={setClientPage}
                    labels={{ previous: 'Precedent', next: 'Suivant', page: 'Page' }}
                    className="mt-4"
                  />

                  {selectedClient ? (
                    <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold uppercase tracking-[0.1em] text-[#64748B]">Profil client</p>
                        <button
                          type="button"
                          onClick={() => setSelectedClient(null)}
                          className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-semibold text-[#64748B]"
                        >
                          Fermer
                        </button>
                      </div>
                      <div className="grid gap-3 text-sm text-[#1A1A2E] sm:grid-cols-2">
                        <p>
                          <span className="font-semibold">Nom:</span> {selectedClient.name}
                        </p>
                        <p>
                          <span className="font-semibold">Email:</span> {selectedClient.email || '--'}
                        </p>
                        <p>
                          <span className="font-semibold">Telephone:</span> {selectedClient.phone || '--'}
                        </p>
                        <p>
                          <span className="font-semibold">Ville:</span> {selectedClient.city || '--'}
                        </p>
                        <p>
                          <span className="font-semibold">Bookings:</span> {selectedClient.bookingsCount}
                        </p>
                        <p>
                          <span className="font-semibold">Cree le:</span> {fmtDate(selectedClient.createdAt)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {tab === 'cleaners' ? (
            <div>
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Recherche</label>
                  <input
                    value={cleanerSearch}
                    onChange={(event) => {
                      setCleanerSearch(event.target.value);
                      setCleanerPage(1);
                    }}
                    className="rounded-xl border border-[#D1E7F7] bg-[#F8FCFF] px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void loadCleaners()}
                  className="h-[40px] rounded-xl bg-[#4FC3F7] px-4 text-sm font-semibold text-white"
                >
                  Rechercher
                </button>
              </div>

              {loadingCleaners ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-[#4FC3F7]" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-[#EEF2F7]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#F8FAFC] text-left text-xs uppercase tracking-wide text-[#6B7280]">
                        <tr>
                          <th className="px-3 py-2">Nom</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Ville/Zone</th>
                          <th className="px-3 py-2">Services</th>
                          <th className="px-3 py-2">Completed</th>
                          <th className="px-3 py-2">Rating</th>
                          <th className="px-3 py-2">Cree le</th>
                          <th className="px-3 py-2">Statut</th>
                          <th className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(cleaners?.items ?? []).map((row) => (
                          <tr key={row.id} className="border-t border-[#EEF2F7]">
                            <td className="px-3 py-2 font-semibold">{row.name}</td>
                            <td className="px-3 py-2">{row.email || '--'}</td>
                            <td className="px-3 py-2">{row.zone || row.city || '--'}</td>
                            <td className="px-3 py-2">{row.services.length > 0 ? row.services.join(', ') : '--'}</td>
                            <td className="px-3 py-2">{row.completedJobs}</td>
                            <td className="px-3 py-2">
                              {row.ratingAverage !== null ? `${row.ratingAverage.toFixed(2)} (${row.ratingCount})` : '--'}
                            </td>
                            <td className="px-3 py-2">{fmtDate(row.createdAt)}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                  row.active
                                    ? 'bg-[rgba(168,230,207,0.3)] text-[#065F46]'
                                    : 'bg-[rgba(248,113,113,0.18)] text-[#B91C1C]'
                                }`}
                              >
                                {row.active ? 'Actif' : 'Desactive'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCleaner({ row, mode: 'profile' })}
                                  className="rounded-lg border border-[#D1E7F7] bg-[#F8FCFF] px-2 py-1 text-xs text-[#0369A1]"
                                >
                                  Voir profil
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedCleaner({ row, mode: 'activity' })}
                                  className="rounded-lg border border-[#D1E7F7] bg-[#F8FCFF] px-2 py-1 text-xs text-[#0369A1]"
                                >
                                  Activite
                                </button>
                                {row.active ? (
                                  <button
                                    type="button"
                                    onClick={() => void userAction('cleaners', row.id, 'deactivate')}
                                    className="rounded-lg border border-[#FCA5A5] px-2 py-1 text-xs text-[#B91C1C]"
                                  >
                                    Desactiver
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void userAction('cleaners', row.id, 'reactivate')}
                                    className="rounded-lg border border-[#86EFAC] px-2 py-1 text-xs text-[#166534]"
                                  >
                                    Reactiver
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void userAction('cleaners', row.id, 'delete')}
                                  className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs text-[#6B7280]"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <PaginationControls
                    page={cleaners?.page ?? 1}
                    totalPages={cleaners?.totalPages ?? 1}
                    onPageChange={setCleanerPage}
                    labels={{ previous: 'Precedent', next: 'Suivant', page: 'Page' }}
                    className="mt-4"
                  />

                  {selectedCleaner ? (
                    <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold uppercase tracking-[0.1em] text-[#64748B]">
                          {selectedCleaner.mode === 'profile' ? 'Profil nettoyeur' : 'Activite nettoyeur'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedCleaner(null)}
                          className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-semibold text-[#64748B]"
                        >
                          Fermer
                        </button>
                      </div>

                      {selectedCleaner.mode === 'profile' ? (
                        <div className="grid gap-3 text-sm text-[#1A1A2E] sm:grid-cols-2">
                          <p>
                            <span className="font-semibold">Nom:</span> {selectedCleaner.row.name}
                          </p>
                          <p>
                            <span className="font-semibold">Email:</span> {selectedCleaner.row.email || '--'}
                          </p>
                          <p>
                            <span className="font-semibold">Ville:</span> {selectedCleaner.row.city || '--'}
                          </p>
                          <p>
                            <span className="font-semibold">Zone:</span> {selectedCleaner.row.zone || '--'}
                          </p>
                          <p>
                            <span className="font-semibold">Services:</span>{' '}
                            {selectedCleaner.row.services.length > 0 ? selectedCleaner.row.services.join(', ') : '--'}
                          </p>
                          <p>
                            <span className="font-semibold">Cree le:</span> {fmtDate(selectedCleaner.row.createdAt)}
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Bookings</p>
                            <p className="mt-1 text-xl font-bold text-[#1A1A2E]">{selectedCleaner.row.bookingsCount}</p>
                          </div>
                          <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Completed</p>
                            <p className="mt-1 text-xl font-bold text-[#1A1A2E]">{selectedCleaner.row.completedJobs}</p>
                          </div>
                          <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Rating</p>
                            <p className="mt-1 text-xl font-bold text-[#1A1A2E]">
                              {selectedCleaner.row.ratingAverage !== null
                                ? `${selectedCleaner.row.ratingAverage.toFixed(2)} (${selectedCleaner.row.ratingCount})`
                                : '--'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {tab === 'settings' ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#1A1A2E]">Parametres</h2>
                <button
                  type="button"
                  onClick={() => void loadSettings()}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D1E7F7] bg-[#F8FCFF] px-3 py-2 text-xs font-semibold text-[#0369A1]"
                >
                  <RefreshCw size={14} />
                  Actualiser
                </button>
              </div>

              {loadingSettings ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-[#4FC3F7]" />
                </div>
              ) : !settings?.supported ? (
                <div className="rounded-2xl border border-[#FDE68A] bg-[rgba(254,243,199,0.5)] p-4">
                  <p className="text-sm font-semibold text-[#92400E]">
                    Table admin_settings absente. Executez la migration SQL ci-dessous.
                  </p>
                  {settings?.createTableSql ? (
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-[#1A1A2E] p-3 text-xs text-[#E5E7EB]">
                      {settings.createTableSql}
                    </pre>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                        Frais plateforme (CAD)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={settings.settings.platformFeeAmount}
                        onChange={(event) =>
                          setSettings((current) =>
                            current
                              ? {
                                  ...current,
                                  settings: {
                                    ...current.settings,
                                    platformFeeAmount: Number(event.target.value)
                                  }
                                }
                              : current
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-[#D1E7F7] bg-[#F8FCFF] px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                        Lead time meme jour (h)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={settings.settings.sameDayLeadHours}
                        onChange={(event) =>
                          setSettings((current) =>
                            current
                              ? {
                                  ...current,
                                  settings: {
                                    ...current.settings,
                                    sameDayLeadHours: Number(event.target.value)
                                  }
                                }
                              : current
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-[#D1E7F7] bg-[#F8FCFF] px-3 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-medium text-[#1A1A2E]">
                      Reservation active
                      <input
                        type="checkbox"
                        checked={Boolean(settings.settings.featureToggles.bookingEnabled)}
                        onChange={(event) =>
                          setSettings((current) =>
                            current
                              ? {
                                  ...current,
                                  settings: {
                                    ...current.settings,
                                    featureToggles: {
                                      ...current.settings.featureToggles,
                                      bookingEnabled: event.target.checked
                                    }
                                  }
                                }
                              : current
                          )
                        }
                        className="h-4 w-4 rounded border-[#CBD5E1] text-[#4FC3F7]"
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-medium text-[#1A1A2E]">
                      Inscription nettoyeur active
                      <input
                        type="checkbox"
                        checked={Boolean(settings.settings.featureToggles.cleanerSignupEnabled)}
                        onChange={(event) =>
                          setSettings((current) =>
                            current
                              ? {
                                  ...current,
                                  settings: {
                                    ...current.settings,
                                    featureToggles: {
                                      ...current.settings.featureToggles,
                                      cleanerSignupEnabled: event.target.checked
                                    }
                                  }
                                }
                              : current
                          )
                        }
                        className="h-4 w-4 rounded border-[#CBD5E1] text-[#4FC3F7]"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={savingSettings}
                    onClick={() => void saveSettings()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#4FC3F7] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {savingSettings ? <Loader2 size={14} className="animate-spin" /> : null}
                    Enregistrer
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

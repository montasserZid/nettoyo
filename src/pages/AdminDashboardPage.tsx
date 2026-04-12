import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, RefreshCw, LayoutDashboard, CalendarCheck, Users, Sparkles,
  Star, DollarSign, BarChart3, Settings as SettingsIcon,
  Search, X, TrendingUp, Eye, Ban, Trash2, UserCheck, MapPin, Phone,
  Mail, Calendar, Activity, CheckCircle2, Clock, AlertTriangle, Shield,
  ChevronRight, ChevronDown, Menu, Zap, Package, CreditCard, ArrowUpRight,
} from 'lucide-react';
import { PaginationControls } from '../components/PaginationControls';
import { useAuth } from '../context/AuthContext';

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */
type Tab =
  | 'overview' | 'bookings' | 'clients' | 'cleaners'
  | 'revenue' | 'analytics' | 'settings';

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

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────────── */
const BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'expired', 'accepted'];

const NAV_ITEMS: Array<{ id: Tab; label: string; icon: React.ElementType; group?: string }> = [
  { id: 'overview',       label: "Vue d'ensemble",  icon: LayoutDashboard },
  { id: 'bookings',       label: 'Réservations',    icon: CalendarCheck,   group: 'Opérations' },
  { id: 'clients',        label: 'Clients',          icon: Users,           group: 'Opérations' },
  { id: 'cleaners',       label: 'Nettoyeurs',       icon: Sparkles,        group: 'Opérations' },
  { id: 'revenue',        label: 'Revenus',          icon: DollarSign,      group: 'Qualité' },
  { id: 'analytics',      label: 'Analytique',       icon: BarChart3,       group: 'Qualité' },
  { id: 'settings',       label: 'Paramètres',       icon: SettingsIcon,    group: 'Système' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function fmtDate(value: string | null, short = false) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  if (short) return new Intl.DateTimeFormat('fr-CA', { month: 'short', day: 'numeric' }).format(d);
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function fmt$(value: number, currency = 'CAD') {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

const STATUS_CFG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  confirmed:  { bg: 'bg-sky-50',    text: 'text-sky-700',     border: 'border-sky-200',     dot: 'bg-sky-400' },
  accepted:   { bg: 'bg-sky-50',    text: 'text-sky-700',     border: 'border-sky-200',     dot: 'bg-sky-400' },
  pending:    { bg: 'bg-amber-50',  text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400' },
  cancelled:  { bg: 'bg-red-50',    text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-400' },
  expired:    { bg: 'bg-gray-100',  text: 'text-gray-600',    border: 'border-gray-200',    dot: 'bg-gray-400' },
};

/* ─────────────────────────────────────────────────────────────────────────────
   ATOMS
───────────────────────────────────────────────────────────────────────────── */
function StatusChip({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.expired;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {status}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
      active
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-red-50 text-red-600 border-red-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-emerald-500' : 'bg-red-400'}`} />
      {active ? 'Actif' : 'Désactivé'}
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-[#4FC3F7]' : 'bg-[#D1D5DB]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function KPICard({
  label, value, icon: Icon, iconBg, iconColor, sub, trend,
}: {
  label: string; value: string | number; icon: React.ElementType;
  iconBg: string; iconColor: string; sub?: string; trend?: number;
}) {
  return (
    <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-5 hover:shadow-[0_4px_20px_rgba(17,24,39,0.08)] transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-[#1A1A2E] tracking-tight leading-none">{value}</p>
      <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">{label}</p>
      {sub && <p className="mt-1 text-xs text-[#9CA3AF]">{sub}</p>}
    </div>
  );
}

function RateBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#374151]">{label}</span>
        <span className="text-sm font-bold text-[#1A1A2E]">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-[#F0F4F8] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-[#4FC3F7]" />
    </div>
  );
}

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-[#1A1A2E]">{title}</h2>
        {sub && <p className="text-sm text-[#6B7280] mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function RefreshBtn({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-[#E8EEF4] bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:bg-[#F8FAFC] transition-colors shadow-sm"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      Actualiser
    </button>
  );
}

function DrawerField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[#1A1A2E]">{value || '—'}</p>
    </div>
  );
}

function DrawerGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 mb-5">{children}</div>;
}

function DetailDrawer({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-[#1A1A2E]/20 backdrop-blur-[2px] z-40"
          onClick={onClose}
        />
      )}
      <div
        className="fixed top-0 right-0 h-full w-[460px] max-w-full bg-white shadow-[−32px_0_64px_rgba(17,24,39,0.15)] z-50 flex flex-col"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EEF4] flex-shrink-0">
          <h3 className="font-bold text-[#1A1A2E] text-base">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F4F7FB] flex items-center justify-center text-[#6B7280] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   OVERVIEW SECTION
───────────────────────────────────────────────────────────────────────────── */
function OverviewSection({ stats, loading, onRefresh }: {
  stats: Stats | null; loading: boolean; onRefresh: () => void;
}) {
  const derived = useMemo(() => {
    if (!stats) return null;
    const total = stats.totalBookings || 1;
    return {
      completionRate: (stats.completedBookings / total) * 100,
      cancellationRate: (stats.cancelledBookings / total) * 100,
      expiryRate: (stats.expiredBookings / total) * 100,
      activeRate: ((stats.pendingBookings + stats.confirmedBookings) / total) * 100,
      supplyRatio: stats.totalClients > 0 ? (stats.totalCleaners / stats.totalClients) : 0,
    };
  }, [stats]);

  const statusBars = useMemo(() => {
    if (!stats) return [];
    const t = stats.totalBookings || 1;
    return [
      { key: 'completed', label: 'Complété',  pct: (stats.completedBookings / t) * 100,  color: 'bg-emerald-400' },
      { key: 'confirmed', label: 'Confirmé',  pct: (stats.confirmedBookings / t) * 100,  color: 'bg-sky-400' },
      { key: 'pending',   label: 'En attente', pct: (stats.pendingBookings / t) * 100,   color: 'bg-amber-400' },
      { key: 'cancelled', label: 'Annulé',    pct: (stats.cancelledBookings / t) * 100,  color: 'bg-red-400' },
      { key: 'expired',   label: 'Expiré',    pct: (stats.expiredBookings / t) * 100,    color: 'bg-gray-300' },
    ];
  }, [stats]);

  return (
    <div>
      <SectionHeader
        title="Vue d'ensemble"
        sub={`Tableau de bord opérationnel · ${new Date().toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
        action={<RefreshBtn onClick={onRefresh} loading={loading} />}
      />

      {loading ? <LoadingSpinner /> : !stats ? null : (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Utilisateurs total" value={stats.totalUsers}
              icon={Users} iconBg="bg-[#EFF8FD]" iconColor="text-[#4FC3F7]"
              sub={`+${stats.newUsersThisMonth} ce mois`}
            />
            <KPICard
              label="Réservations" value={stats.totalBookings}
              icon={CalendarCheck} iconBg="bg-indigo-50" iconColor="text-indigo-500"
            />
            <KPICard
              label="Revenu plateforme"
              value={stats.platformFeeRevenue ? fmt$(stats.platformFeeRevenue.value, stats.platformFeeRevenue.currency) : 'N/D'}
              icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              sub={stats.platformFeeRevenue?.capped ? 'Partiel' : 'Cumulatif'}
            />
            <KPICard
              label="Réservations actives"
              value={stats.pendingBookings + stats.confirmedBookings}
              icon={Activity} iconBg="bg-amber-50" iconColor="text-amber-600"
              sub={`${stats.pendingBookings} en attente`}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Clients" value={stats.totalClients}
              icon={Users} iconBg="bg-purple-50" iconColor="text-purple-600"
            />
            <KPICard
              label="Nettoyeurs" value={stats.totalCleaners}
              icon={Sparkles} iconBg="bg-[#F0FBF5]" iconColor="text-[#34A26B]"
              sub={derived ? `Ratio ${derived.supplyRatio.toFixed(2)} / client` : undefined}
            />
            <KPICard
              label="Complétés" value={stats.completedBookings}
              icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              sub={derived ? `${derived.completionRate.toFixed(1)}% du total` : undefined}
            />
            <KPICard
              label="Annulés + Expirés" value={stats.cancelledBookings + stats.expiredBookings}
              icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-500"
              sub={derived ? `${(derived.cancellationRate + derived.expiryRate).toFixed(1)}% taux perte` : undefined}
            />
          </div>

          {/* Status Distribution + Rates */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Distribution bar */}
            <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-5">
              <h3 className="text-sm font-bold text-[#1A1A2E] mb-4">Distribution des statuts</h3>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-4">
                {statusBars.map(b => (
                  <div
                    key={b.key}
                    className={`${b.color} transition-all duration-700`}
                    style={{ width: `${Math.max(b.pct, 0.5)}%` }}
                    title={`${b.label}: ${b.pct.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {statusBars.map(b => (
                  <div key={b.key} className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${b.color}`} />
                    <span>{b.label}</span>
                    <span className="ml-auto font-semibold text-[#374151]">{b.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rates */}
            {derived && (
              <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-5">
                <h3 className="text-sm font-bold text-[#1A1A2E] mb-4">Taux de performance</h3>
                <div className="space-y-4">
                  <RateBar label="Taux de complétion"   value={derived.completionRate}   color="bg-emerald-400" />
                  <RateBar label="Réservations actives" value={derived.activeRate}        color="bg-sky-400" />
                  <RateBar label="Taux d'annulation"    value={derived.cancellationRate}  color="bg-red-400" />
                  <RateBar label="Taux d'expiration"    value={derived.expiryRate}        color="bg-gray-300" />
                </div>
              </div>
            )}
          </div>

          {/* Platform health callout */}
          {derived && (
            <div className={`rounded-2xl border p-5 flex items-center gap-4 ${
              derived.completionRate >= 60
                ? 'bg-emerald-50 border-emerald-200'
                : derived.completionRate >= 35
                ? 'bg-amber-50 border-amber-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                derived.completionRate >= 60 ? 'bg-emerald-100' : derived.completionRate >= 35 ? 'bg-amber-100' : 'bg-red-100'
              }`}>
                <Shield size={18} className={derived.completionRate >= 60 ? 'text-emerald-600' : derived.completionRate >= 35 ? 'text-amber-600' : 'text-red-600'} />
              </div>
              <div>
                <p className="font-bold text-sm text-[#1A1A2E]">
                  Santé plateforme · {derived.completionRate.toFixed(1)}% completion
                </p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {derived.supplyRatio < 0.05
                    ? '⚠️ Pénurie de nettoyeurs — recrutement urgent recommandé.'
                    : derived.completionRate < 35
                    ? '⚠️ Taux de complétion faible — investiguer les annulations.'
                    : `${stats.totalCleaners} nettoyeurs actifs couvrant ${stats.totalClients} clients.`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   BOOKINGS SECTION
───────────────────────────────────────────────────────────────────────────── */
function BookingsSection({
  bookings, loading, page, onPageChange, onRefresh,
  bStatus, setBStatus, bDate, setBDate, bCity, setBCity, bId, setBId,
  onCancel, onStatusChange, onView,
}: {
  bookings: Paged<Booking> | null; loading: boolean; page: number;
  onPageChange: (p: number) => void; onRefresh: () => void;
  bStatus: string; setBStatus: (v: string) => void;
  bDate: string; setBDate: (v: string) => void;
  bCity: string; setBCity: (v: string) => void;
  bId: string; setBId: (v: string) => void;
  onCancel: (b: Booking) => void;
  onStatusChange: (id: string, status: BookingStatus) => void;
  onView: (b: Booking) => void;
}) {
  const [draft, setDraft] = useState<Record<string, BookingStatus>>({});

  useEffect(() => {
    if (bookings) {
      setDraft(prev => {
        const next = { ...prev };
        bookings.items.forEach(r => { if (!next[r.id]) next[r.id] = r.status; });
        return next;
      });
    }
  }, [bookings]);

  return (
    <div>
      <SectionHeader
        title="Réservations"
        sub={bookings ? `${bookings.total} réservations au total` : undefined}
        action={<RefreshBtn onClick={onRefresh} loading={loading} />}
      />

      {/* Filters */}
      <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-1.5">Statut</label>
            <select
              value={bStatus}
              onChange={e => { setBStatus(e.target.value); onPageChange(1); }}
              className="h-9 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#4FC3F7]/30"
            >
              <option value="all">Tous</option>
              {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-1.5">Date</label>
            <input type="date" value={bDate}
              onChange={e => { setBDate(e.target.value); onPageChange(1); }}
              className="h-9 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#4FC3F7]/30"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-1.5">Ville</label>
            <input value={bCity} placeholder="Montréal…"
              onChange={e => { setBCity(e.target.value); onPageChange(1); }}
              className="h-9 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#4FC3F7]/30 w-32"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-1.5">ID Réservation</label>
            <input value={bId} placeholder="uuid…"
              onChange={e => { setBId(e.target.value); onPageChange(1); }}
              className="h-9 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] px-3 text-sm font-mono text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#4FC3F7]/30 w-40"
            />
          </div>
          <button type="button" onClick={onRefresh}
            className="h-9 rounded-xl bg-[#4FC3F7] px-4 text-sm font-semibold text-white hover:bg-[#29B6F6] transition-colors shadow-sm">
            Filtrer
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E8EEF4]">
                  {['ID', 'Client', 'Nettoyeur', 'Ville', 'Service', 'Date planifiée', 'Créé le', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F8]">
                {(bookings?.items ?? []).length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-[#9CA3AF]">Aucune réservation trouvée</td></tr>
                ) : (bookings?.items ?? []).map(row => (
                  <tr key={row.id} className="hover:bg-[#FAFCFF] transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[#9CA3AF] bg-[#F4F7FB] px-2 py-0.5 rounded-lg">
                        {row.id.slice(0, 8)}…
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#1A1A2E] whitespace-nowrap">
                      {row.client.name || row.client.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#374151] whitespace-nowrap">
                      {row.cleaner.name || row.cleaner.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">{row.city || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#6B7280] max-w-[120px] truncate">{row.serviceType || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#374151] whitespace-nowrap">{fmtDate(row.scheduledAt)}</td>
                    <td className="px-4 py-3 text-sm text-[#9CA3AF] whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                    <td className="px-4 py-3"><StatusChip status={row.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onView(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E8EEF4] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F8FAFC] transition-colors">
                          <Eye size={12} /> Voir
                        </button>
                        <select
                          value={draft[row.id] ?? row.status}
                          onChange={e => setDraft(p => ({ ...p, [row.id]: e.target.value as BookingStatus }))}
                          className="h-7 rounded-lg border border-[#E8EEF4] bg-[#F8FAFC] px-2 text-xs text-[#374151]"
                        >
                          {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button type="button"
                          onClick={() => onStatusChange(row.id, draft[row.id] ?? row.status)}
                          className="h-7 rounded-lg bg-[#4FC3F7] px-2.5 text-xs font-bold text-white hover:bg-[#29B6F6] transition-colors">
                          OK
                        </button>
                        <button type="button" onClick={() => onCancel(row)}
                          disabled={row.status === 'cancelled'}
                          className="inline-flex items-center rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <Ban size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#F0F4F8]">
            <PaginationControls
              page={bookings?.page ?? 1}
              totalPages={bookings?.totalPages ?? 1}
              onPageChange={onPageChange}
              labels={{ previous: 'Précédent', next: 'Suivant', page: 'Page' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   USERS TABLE (Clients + Cleaners)
───────────────────────────────────────────────────────────────────────────── */
function UsersSection({
  mode, data, loading, page, onPageChange, search, onSearch, onRefresh,
  onView, onAction,
}: {
  mode: 'clients' | 'cleaners';
  data: Paged<UserRow> | null; loading: boolean; page: number;
  onPageChange: (p: number) => void;
  search: string; onSearch: (v: string) => void;
  onRefresh: () => void;
  onView: (row: UserRow) => void;
  onAction: (id: string, action: 'deactivate' | 'reactivate' | 'delete') => void;
}) {
  const isCleaners = mode === 'cleaners';
  const title = isCleaners ? 'Nettoyeurs' : 'Clients';

  function StarRating({ avg, count }: { avg: number | null; count: number }) {
    if (avg === null) return <span className="text-[#9CA3AF] text-sm">—</span>;
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1A1A2E]">
        <Star size={12} className="text-amber-400 fill-amber-400" />
        {avg.toFixed(1)}
        <span className="text-xs text-[#9CA3AF] font-normal">({count})</span>
      </span>
    );
  }

  return (
    <div>
      <SectionHeader
        title={title}
        sub={data ? `${data.total} ${isCleaners ? 'nettoyeurs' : 'clients'} enregistrés` : undefined}
        action={<RefreshBtn onClick={onRefresh} loading={loading} />}
      />

      <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-4 mb-4">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={search}
            onChange={e => { onSearch(e.target.value); onPageChange(1); }}
            placeholder={`Rechercher un ${isCleaners ? 'nettoyeur' : 'client'}…`}
            className="w-full h-9 pl-9 pr-4 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#4FC3F7]/30"
          />
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E8EEF4]">
                  {[
                    'Nom', 'Email', 'Téléphone', 'Ville',
                    ...(isCleaners ? ['Zone', 'Services', 'Complétés', 'Note'] : ['Réservations']),
                    'Créé le', 'Statut', 'Actions',
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F8]">
                {(data?.items ?? []).length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-12 text-center text-sm text-[#9CA3AF]">Aucun résultat</td></tr>
                ) : (data?.items ?? []).map(row => (
                  <tr key={row.id} className="hover:bg-[#FAFCFF] transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-[#1A1A2E] whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-[#6B7280] max-w-[160px] truncate">{row.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#6B7280] whitespace-nowrap">{row.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">{row.city || '—'}</td>
                    {isCleaners && (
                      <>
                        <td className="px-4 py-3 text-sm text-[#6B7280]">{row.zone || '—'}</td>
                        <td className="px-4 py-3 text-sm text-[#6B7280] max-w-[120px] truncate">
                          {row.services.length > 0 ? row.services.join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#1A1A2E]">{row.completedJobs}</td>
                        <td className="px-4 py-3"><StarRating avg={row.ratingAverage} count={row.ratingCount} /></td>
                      </>
                    )}
                    {!isCleaners && (
                      <td className="px-4 py-3 text-sm font-semibold text-[#1A1A2E]">{row.bookingsCount}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-[#9CA3AF] whitespace-nowrap">{fmtDate(row.createdAt, true)}</td>
                    <td className="px-4 py-3"><ActiveBadge active={row.active} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => onView(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E8EEF4] bg-white px-2 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F8FAFC] transition-colors">
                          <Eye size={11} /> Profil
                        </button>
                        {row.active ? (
                          <button type="button" onClick={() => onAction(row.id, 'deactivate')}
                            className="rounded-lg border border-amber-200 px-2 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors">
                            <Ban size={11} />
                          </button>
                        ) : (
                          <button type="button" onClick={() => onAction(row.id, 'reactivate')}
                            className="rounded-lg border border-emerald-200 px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors">
                            <UserCheck size={11} />
                          </button>
                        )}
                        <button type="button" onClick={() => onAction(row.id, 'delete')}
                          className="rounded-lg border border-[#E8EEF4] px-2 py-1.5 text-xs text-[#9CA3AF] hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#F0F4F8]">
            <PaginationControls
              page={data?.page ?? 1}
              totalPages={data?.totalPages ?? 1}
              onPageChange={onPageChange}
              labels={{ previous: 'Précédent', next: 'Suivant', page: 'Page' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   REVENUE SECTION
───────────────────────────────────────────────────────────────────────────── */
function RevenueSection({ stats, loading, onRefresh }: { stats: Stats | null; loading: boolean; onRefresh: () => void }) {
  const rev = stats?.platformFeeRevenue;
  const avgFee = rev && stats && stats.completedBookings > 0
    ? rev.value / stats.completedBookings
    : null;

  return (
    <div>
      <SectionHeader
        title="Revenus"
        sub="Frais plateforme et performance financière"
        action={<RefreshBtn onClick={onRefresh} loading={loading} />}
      />
      {loading ? <LoadingSpinner /> : !stats ? null : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard
              label="Revenu total plateforme"
              value={rev ? fmt$(rev.value, rev.currency) : 'Non disponible'}
              icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              sub={rev?.capped ? `Source: ${rev.sourceColumn} (partiel)` : rev ? `Source: ${rev.sourceColumn}` : undefined}
            />
            <KPICard
              label="Frais moyen / réservation complétée"
              value={avgFee !== null ? fmt$(avgFee, rev?.currency) : '—'}
              icon={CreditCard} iconBg="bg-sky-50" iconColor="text-sky-600"
              sub={`${stats.completedBookings} réservations complétées`}
            />
            <KPICard
              label="Nouveaux clients ce mois"
              value={stats.newUsersThisMonth}
              icon={ArrowUpRight} iconBg="bg-purple-50" iconColor="text-purple-600"
              sub="Potentiel de revenus futurs"
            />
          </div>

          {!rev && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">Données de revenus indisponibles</p>
                <p className="text-xs text-amber-700 mt-1">
                  La colonne de frais plateforme n'est pas encore configurée. Vérifier la table des réservations ou l'API admin.
                </p>
              </div>
            </div>
          )}

          {rev && (
            <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-5">
              <h3 className="text-sm font-bold text-[#1A1A2E] mb-4">Projection de revenus</h3>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs text-[#9CA3AF] mb-1">Revenu par réservation complétée</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-[#1A1A2E]">{avgFee !== null ? fmt$(avgFee, rev.currency) : '—'}</span>
                    <span className="text-sm text-[#9CA3AF] mb-0.5">/ réservation</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF] mb-1">Revenu estimé si 80% completion</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-[#1A1A2E]">
                      {avgFee !== null
                        ? fmt$(avgFee * stats.totalBookings * 0.8, rev.currency)
                        : '—'}
                    </span>
                    <span className="text-sm text-[#9CA3AF] mb-0.5">potentiel</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ANALYTICS SECTION
───────────────────────────────────────────────────────────────────────────── */
function AnalyticsSection({ stats, loading, onRefresh }: { stats: Stats | null; loading: boolean; onRefresh: () => void }) {
  const m = useMemo(() => {
    if (!stats) return null;
    const t = stats.totalBookings || 1;
    return {
      completionRate:    (stats.completedBookings / t) * 100,
      cancellationRate:  (stats.cancelledBookings / t) * 100,
      expiryRate:        (stats.expiredBookings / t) * 100,
      pendingRate:       (stats.pendingBookings / t) * 100,
      confirmedRate:     (stats.confirmedBookings / t) * 100,
      supplyRatio:       stats.totalClients > 0 ? (stats.totalCleaners / stats.totalClients) * 100 : 0,
      avgBookingsPerClient: stats.totalClients > 0 ? stats.totalBookings / stats.totalClients : 0,
    };
  }, [stats]);

  return (
    <div>
      <SectionHeader
        title="Analytique"
        sub="Métriques opérationnelles et indicateurs de croissance"
        action={<RefreshBtn onClick={onRefresh} loading={loading} />}
      />
      {loading ? <LoadingSpinner /> : !stats || !m ? null : (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <KPICard label="Taux de complétion"    value={`${m.completionRate.toFixed(1)}%`}   icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
            <KPICard label="Taux d'annulation"     value={`${m.cancellationRate.toFixed(1)}%`} icon={Ban}          iconBg="bg-red-50"     iconColor="text-red-500" />
            <KPICard label="Rés. moy. / client"    value={m.avgBookingsPerClient.toFixed(2)}    icon={BarChart3}    iconBg="bg-sky-50"     iconColor="text-sky-600" />
          </div>

          {/* Funnel */}
          <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-5">
            <h3 className="text-sm font-bold text-[#1A1A2E] mb-5">Entonnoir réservations</h3>
            <div className="space-y-3">
              {[
                { label: 'Total créées',  value: stats.totalBookings,    pct: 100,              color: 'bg-[#4FC3F7]' },
                { label: 'Confirmées',    value: stats.confirmedBookings, pct: m.confirmedRate,  color: 'bg-sky-400' },
                { label: 'Complétées',    value: stats.completedBookings, pct: m.completionRate, color: 'bg-emerald-400' },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-[#374151]">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#1A1A2E]">{row.value.toLocaleString()}</span>
                      <span className="text-xs text-[#9CA3AF] w-12 text-right">{row.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-3 bg-[#F0F4F8] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supply/demand */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-5">
              <h3 className="text-sm font-bold text-[#1A1A2E] mb-4">Offre vs Demande</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Users size={14} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-[#9CA3AF]">Clients (demande)</p>
                      <p className="text-base font-bold text-[#1A1A2E]">{stats.totalClients}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#F0FBF5] flex items-center justify-center">
                      <Sparkles size={14} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-[#9CA3AF]">Nettoyeurs (offre)</p>
                      <p className="text-base font-bold text-[#1A1A2E]">{stats.totalCleaners}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-[#6B7280]">Ratio offre / demande</span>
                    <span className="text-xs font-bold text-[#1A1A2E]">
                      {(stats.totalCleaners / (stats.totalClients || 1)).toFixed(2)} nettoyeur/client
                    </span>
                  </div>
                  <div className="h-2 bg-[#F0F4F8] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.supplyRatio >= 20 ? 'bg-emerald-400' : m.supplyRatio >= 8 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(m.supplyRatio, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-1">
                    {m.supplyRatio < 8 ? '⚠️ Sous-approvisionnement critique' : m.supplyRatio < 20 ? '⚡ Ratio acceptable' : '✅ Bonne couverture'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-5">
              <h3 className="text-sm font-bold text-[#1A1A2E] mb-4">Taux de perte</h3>
              <div className="space-y-4">
                <RateBar label="Taux d'expiration" value={m.expiryRate}       color="bg-gray-300" />
                <RateBar label="Taux d'annulation" value={m.cancellationRate} color="bg-red-400" />
                <div className="pt-2 border-t border-[#F0F4F8]">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Perte totale</span>
                    <span className="font-bold text-[#1A1A2E]">{(m.expiryRate + m.cancellationRate).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SETTINGS SECTION
───────────────────────────────────────────────────────────────────────────── */
function SettingsSection({ settings, loading, saving, onChange, onSave, onRefresh }: {
  settings: SettingsRes | null; loading: boolean; saving: boolean;
  onChange: (s: SettingsRes) => void;
  onSave: () => void;
  onRefresh: () => void;
}) {
  return (
    <div>
      <SectionHeader
        title="Paramètres"
        sub="Configuration opérationnelle de la plateforme"
        action={<RefreshBtn onClick={onRefresh} loading={loading} />}
      />
      {loading ? <LoadingSpinner /> : !settings?.supported ? (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800">Table admin_settings manquante</p>
              <p className="text-sm text-amber-700 mt-1">Exécutez la migration SQL ci-dessous pour activer les paramètres.</p>
            </div>
          </div>
          {settings?.createTableSql && (
            <pre className="overflow-x-auto rounded-xl bg-[#1A1A2E] p-4 text-xs text-[#E5E7EB] leading-relaxed">
              {settings.createTableSql}
            </pre>
          )}
        </div>
      ) : (
        <div className="space-y-5 max-w-2xl">
          {/* Numeric settings */}
          <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-5">
            <h3 className="text-sm font-bold text-[#1A1A2E] mb-4 flex items-center gap-2">
              <Package size={15} className="text-[#4FC3F7]" /> Tarification
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">
                  Frais plateforme (CAD)
                </label>
                <input
                  type="number" min={0} step="0.01"
                  value={settings.settings.platformFeeAmount}
                  onChange={e => onChange({ ...settings, settings: { ...settings.settings, platformFeeAmount: Number(e.target.value) } })}
                  className="w-full h-10 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] px-3 text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4FC3F7]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">
                  Lead-time même jour (heures)
                </label>
                <input
                  type="number" min={0} step={1}
                  value={settings.settings.sameDayLeadHours}
                  onChange={e => onChange({ ...settings, settings: { ...settings.settings, sameDayLeadHours: Number(e.target.value) } })}
                  className="w-full h-10 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] px-3 text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#4FC3F7]/30"
                />
              </div>
            </div>
          </div>

          {/* Feature toggles */}
          <div className="rounded-2xl bg-white border border-[#E8EEF4] shadow-[0_2px_12px_rgba(17,24,39,0.04)] p-5">
            <h3 className="text-sm font-bold text-[#1A1A2E] mb-4 flex items-center gap-2">
              <Zap size={15} className="text-[#4FC3F7]" /> Fonctionnalités
            </h3>
            <div className="space-y-4">
              {[
                { key: 'bookingEnabled',      label: 'Réservations activées',           desc: 'Permettre aux clients de créer des réservations.' },
                { key: 'cleanerSignupEnabled', label: 'Inscription nettoyeurs activée', desc: 'Permettre aux nettoyeurs de créer un compte.' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-[#F0F4F8] last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A2E]">{label}</p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">{desc}</p>
                  </div>
                  <Toggle
                    checked={Boolean(settings.settings.featureToggles[key])}
                    onChange={v => onChange({
                      ...settings,
                      settings: { ...settings.settings, featureToggles: { ...settings.settings.featureToggles, [key]: v } },
                    })}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A1A2E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#2D2D44] disabled:opacity-60 transition-colors shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Enregistrer les modifications
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export function AdminDashboardPage() {
  const { session, loading: loadingAuth } = useAuth();
  const token = useMemo(() => session?.access_token ?? null, [session?.access_token]);

  // Navigation
  const [tab, setTab] = useState<Tab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Global error
  const [error, setError] = useState<string | null>(null);

  // Overview
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Bookings
  const [bookings, setBookings] = useState<Paged<Booking> | null>(null);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingPage, setBookingPage] = useState(1);
  const [bStatus, setBStatus] = useState('all');
  const [bDate, setBDate] = useState('');
  const [bCity, setBCity] = useState('');
  const [bId, setBId] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Clients
  const [clients, setClients] = useState<Paged<UserRow> | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<UserRow | null>(null);

  // Cleaners
  const [cleaners, setCleaners] = useState<Paged<UserRow> | null>(null);
  const [loadingCleaners, setLoadingCleaners] = useState(false);
  const [cleanerPage, setCleanerPage] = useState(1);
  const [cleanerSearch, setCleanerSearch] = useState('');
  const [selectedCleaner, setSelectedCleaner] = useState<UserRow | null>(null);

  // Settings
  const [settings, setSettings] = useState<SettingsRes | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  /* API helper */
  const api = useCallback(async (url: string, init?: RequestInit) => {
    if (!token) throw new Error('Session admin invalide.');
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    const isJson = contentType.includes('application/json');
    const rawBody = await res.text();
    let payload: unknown = null;
    if (isJson && rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        throw new Error(`Réponse JSON invalide pour ${url}.`);
      }
    }

    if (!res.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : `Erreur serveur (${res.status}).`;
      throw new Error(message);
    }

    if (!isJson) {
      const preview = rawBody.slice(0, 80).replace(/\s+/g, ' ').trim();
      throw new Error(
        `Réponse non JSON pour ${url} (status ${res.status}, content-type: ${contentType || 'unknown'})${preview ? `: ${preview}` : ''}`
      );
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error(`Réponse JSON invalide pour ${url}.`);
    }

    return payload as Record<string, unknown>;
  }, [token]);

  const hasPagedShape = useCallback((payload: unknown): payload is Paged<unknown> => {
    if (!payload || typeof payload !== 'object') return false;
    const candidate = payload as Record<string, unknown>;
    return (
      Array.isArray(candidate.items) &&
      typeof candidate.page === 'number' &&
      typeof candidate.totalPages === 'number' &&
      typeof candidate.total === 'number' &&
      typeof candidate.pageSize === 'number'
    );
  }, []);

  /* Loaders */
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const d = await api('/api/admin/overview');
      if (!d?.stats || typeof d.stats !== 'object') {
        throw new Error(`Shape inattendue pour /api/admin/overview: ${JSON.stringify(d)}`);
      }
      setStats(d.stats as Stats);
      setError(null);
    } catch (err) {
      console.error('[Admin loadStats]', err);
      setError(err instanceof Error ? err.message : 'Impossible de charger les statistiques.');
    } finally {
      setLoadingStats(false);
    }
  }, [api]);

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const p = new URLSearchParams({ page: String(bookingPage), pageSize: '15' });
      if (bStatus !== 'all') p.set('status', bStatus);
      if (bDate) p.set('date', bDate);
      if (bCity) p.set('city', bCity);
      if (bId) p.set('bookingId', bId);
      const payload = await api(`/api/admin/bookings?${p.toString()}`);
      if (!hasPagedShape(payload)) {
        throw new Error(`Shape inattendue pour /api/admin/bookings: ${JSON.stringify(payload)}`);
      }
      setBookings(payload as Paged<Booking>);
      setError(null);
    } catch (err) {
      console.error('[Admin loadBookings]', err);
      setError(err instanceof Error ? err.message : 'Impossible de charger les réservations.');
    } finally {
      setLoadingBookings(false);
    }
  }, [api, bookingPage, bStatus, bDate, bCity, bId, hasPagedShape]);

  const loadUsers = useCallback(async (mode: 'clients' | 'cleaners', page: number, search: string) => {
    const p = new URLSearchParams({ mode, page: String(page), pageSize: '15' });
    if (search.trim()) p.set('search', search.trim());
    const payload = await api(`/api/admin/users?${p.toString()}`);
    if (!hasPagedShape(payload)) {
      throw new Error(`Shape inattendue pour /api/admin/users: ${JSON.stringify(payload)}`);
    }
    return payload as Paged<UserRow>;
  }, [api, hasPagedShape]);

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      setClients(await loadUsers('clients', clientPage, clientSearch));
      setError(null);
    } catch (err) {
      console.error('[Admin loadClients]', err);
      setError(err instanceof Error ? err.message : 'Impossible de charger les clients.');
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
      console.error('[Admin loadCleaners]', err);
      setError(err instanceof Error ? err.message : 'Impossible de charger les nettoyeurs.');
    } finally {
      setLoadingCleaners(false);
    }
  }, [cleanerPage, cleanerSearch, loadUsers]);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const payload = await api('/api/admin/settings');
      if (
        typeof payload?.supported !== 'boolean' ||
        !payload?.settings ||
        typeof payload.settings !== 'object'
      ) {
        throw new Error(`Shape inattendue pour /api/admin/settings: ${JSON.stringify(payload)}`);
      }
      setSettings(payload as SettingsRes);
      setError(null);
    } catch (err) {
      console.error('[Admin loadSettings]', err);
      setError(err instanceof Error ? err.message : 'Impossible de charger les paramètres.');
    } finally {
      setLoadingSettings(false);
    }
  }, [api]);

  /* Effects */
  useEffect(() => { if (token) void loadStats(); }, [token, loadStats]);
  useEffect(() => { if (tab === 'bookings' && token) void loadBookings(); }, [tab, token, loadBookings]);
  useEffect(() => { if (tab === 'clients' && token) void loadClients(); }, [tab, token, loadClients]);
  useEffect(() => { if (tab === 'cleaners' && token) void loadCleaners(); }, [tab, token, loadCleaners]);
  useEffect(() => { if ((tab === 'settings') && token) void loadSettings(); }, [tab, token, loadSettings]);

  /* Actions */
  const saveBookingStatus = async (id: string, status: BookingStatus) => {
    try {
      await api('/api/admin/bookings', { method: 'PATCH', body: JSON.stringify({ bookingId: id, status }) });
      await Promise.all([loadBookings(), loadStats()]);
    } catch (err) {
      console.error('[Admin saveBookingStatus]', err);
      setError(err instanceof Error ? err.message : 'Mise à jour impossible.');
    }
  };

  const cancelBooking = async (b: Booking) => {
    if (b.status === 'cancelled') return;
    if (!window.confirm('Annuler cette réservation ?')) return;
    try {
      await saveBookingStatus(b.id, 'cancelled');
    } catch (err) {
      console.error('[Admin cancelBooking]', err);
      setError(err instanceof Error ? err.message : 'Annulation impossible.');
    }
  };

  const userAction = async (mode: 'clients' | 'cleaners', id: string, action: 'deactivate' | 'reactivate' | 'delete') => {
    try {
      if (action === 'delete') {
        if (!window.confirm('Supprimer ce compte définitivement ?')) return;
        await api('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ userId: id }) });
      } else {
        await api('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ userId: id, action }) });
      }
      await Promise.all([loadStats(), mode === 'clients' ? loadClients() : loadCleaners()]);
    } catch (err) {
      console.error('[Admin userAction]', err);
      setError(err instanceof Error ? err.message : 'Action impossible.');
    }
  };

  const saveSettings = async () => {
    if (!settings?.supported) return;
    setSavingSettings(true);
    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings.settings) });
      await Promise.all([loadSettings(), loadStats()]);
    } catch (err) {
      console.error('[Admin saveSettings]', err);
      setError(err instanceof Error ? err.message : 'Sauvegarde impossible.');
    } finally {
      setSavingSettings(false);
    }
  };

  /* Nav groups */
  const groups = useMemo(() => {
    const out: Array<{ group: string | undefined; items: typeof NAV_ITEMS }> = [];
    const seen = new Set<string>();
    NAV_ITEMS.forEach(item => {
      const g = item.group;
      if (!seen.has(g ?? '__top')) {
        seen.add(g ?? '__top');
        out.push({ group: g, items: [] });
      }
      out[out.length - 1].items.push(item);
    });
    return out;
  }, []);

  const currentNav = NAV_ITEMS.find(n => n.id === tab);

  if (loadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F4F7FB]">
        <Loader2 size={28} className="animate-spin text-[#4FC3F7]" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F4F7FB]">
        <p className="text-sm font-medium text-[#9CA3AF]">Session admin requise.</p>
      </div>
    );
  }

  /* ── RENDER ── */
  return (
    <div className="fixed inset-0 flex bg-[#F4F7FB] overflow-hidden z-[100]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── SIDEBAR ── */}
      <aside
        className="flex-shrink-0 bg-white border-r border-[#E8EEF4] flex flex-col overflow-y-auto overflow-x-hidden transition-all duration-300"
        style={{ width: sidebarCollapsed ? 64 : 240 }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-[#E8EEF4] flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[#4FC3F7] flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(79,195,247,0.4)]">
            <Sparkles size={15} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1A1A2E] leading-none">Nettoyó</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5 font-semibold uppercase tracking-wider">Admin</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {groups.map(({ group, items }) => (
            <div key={group ?? '__top'} className="mb-1">
              {group && !sidebarCollapsed && (
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#C4CDD8]">{group}</p>
              )}
              {group && sidebarCollapsed && <div className="h-px mx-2 bg-[#F0F4F8] my-2" />}
              {items.map(item => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 relative ${
                      active
                        ? 'bg-[rgba(79,195,247,0.10)] text-[#0369A1]'
                        : 'text-[#6B7280] hover:bg-[#F8FAFC] hover:text-[#374151]'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#4FC3F7] rounded-r-full" />
                    )}
                    <Icon
                      size={17}
                      className={`flex-shrink-0 ${active ? 'text-[#4FC3F7]' : ''}`}
                    />
                    {!sidebarCollapsed && (
                      <span className={`truncate ${active ? 'font-semibold' : ''}`}>{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="flex-shrink-0 border-t border-[#E8EEF4] p-2">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(p => !p)}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs text-[#9CA3AF] hover:bg-[#F8FAFC] hover:text-[#374151] transition-colors"
          >
            <Menu size={14} />
            {!sidebarCollapsed && <span>Réduire</span>}
          </button>
        </div>
      </aside>

      {/* ── RIGHT COLUMN ── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">

        {/* ── TOPBAR ── */}
        <header className="h-16 bg-white border-b border-[#E8EEF4] flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-[#1A1A2E] flex items-center gap-2">
              {currentNav && <currentNav.icon size={16} className="text-[#4FC3F7] flex-shrink-0" />}
              <span className="truncate">{currentNav?.label ?? 'Admin'}</span>
            </h1>
          </div>

          {/* Search bar */}
          <div className="relative hidden sm:block">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4CDD8]" />
            <input
              placeholder="Recherche globale…"
              className="h-9 w-56 pl-9 pr-4 rounded-xl border border-[#E8EEF4] bg-[#F8FAFC] text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#4FC3F7]/30 placeholder-[#C4CDD8]"
            />
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E8EEF4] bg-white px-3 py-2 text-xs font-semibold text-[#374151] hover:bg-[#F8FAFC] transition-colors shadow-sm"
            onClick={() => {
              if (tab === 'overview' || tab === 'revenue' || tab === 'analytics') {
                void loadStats();
                return;
              }
              if (tab === 'bookings') {
                void loadBookings();
                return;
              }
              if (tab === 'clients') {
                void loadClients();
                return;
              }
              if (tab === 'cleaners') {
                void loadCleaners();
                return;
              }
              if (tab === 'settings') {
                void loadSettings();
              }
            }}
          >
            <RefreshCw size={13} />
            Actualiser
          </button>

          {/* Admin avatar */}
          <div className="w-9 h-9 rounded-xl bg-[#1A1A2E] flex items-center justify-center flex-shrink-0">
            <Shield size={15} className="text-[#4FC3F7]" />
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-4 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm font-medium text-red-700 flex-1">{error}</p>
              <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="p-6">
            {tab === 'overview' && (
              <OverviewSection stats={stats} loading={loadingStats} onRefresh={loadStats} />
            )}

            {tab === 'bookings' && (
              <BookingsSection
                bookings={bookings} loading={loadingBookings}
                page={bookingPage} onPageChange={setBookingPage} onRefresh={loadBookings}
                bStatus={bStatus} setBStatus={setBStatus}
                bDate={bDate} setBDate={setBDate}
                bCity={bCity} setBCity={setBCity}
                bId={bId} setBId={setBId}
                onCancel={b => void cancelBooking(b)}
                onStatusChange={(id, s) => void saveBookingStatus(id, s)}
                onView={setSelectedBooking}
              />
            )}

            {tab === 'clients' && (
              <UsersSection
                mode="clients" data={clients} loading={loadingClients}
                page={clientPage} onPageChange={setClientPage}
                search={clientSearch} onSearch={setClientSearch}
                onRefresh={loadClients}
                onView={setSelectedClient}
                onAction={(id, action) => void userAction('clients', id, action)}
              />
            )}

            {tab === 'cleaners' && (
              <UsersSection
                mode="cleaners" data={cleaners} loading={loadingCleaners}
                page={cleanerPage} onPageChange={setCleanerPage}
                search={cleanerSearch} onSearch={setCleanerSearch}
                onRefresh={loadCleaners}
                onView={setSelectedCleaner}
                onAction={(id, action) => void userAction('cleaners', id, action)}
              />
            )}


            {tab === 'revenue' && (
              <RevenueSection stats={stats} loading={loadingStats} onRefresh={loadStats} />
            )}

            {tab === 'analytics' && (
              <AnalyticsSection stats={stats} loading={loadingStats} onRefresh={loadStats} />
            )}


            {tab === 'settings' && (
              <SettingsSection
                settings={settings} loading={loadingSettings} saving={savingSettings}
                onChange={setSettings}
                onSave={() => void saveSettings()}
                onRefresh={loadSettings}
              />
            )}

          </div>
        </main>
      </div>

      {/* ── BOOKING DETAIL DRAWER ── */}
      <DetailDrawer
        open={selectedBooking !== null}
        onClose={() => setSelectedBooking(null)}
        title="Détail réservation"
      >
        {selectedBooking && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F4F8]">
              <div className="w-10 h-10 rounded-xl bg-[#EFF8FD] flex items-center justify-center flex-shrink-0">
                <CalendarCheck size={18} className="text-[#4FC3F7]" />
              </div>
              <div>
                <StatusChip status={selectedBooking.status} />
                <p className="text-xs text-[#9CA3AF] mt-1 font-mono">{selectedBooking.id}</p>
              </div>
            </div>

            <DrawerGrid>
              <DrawerField label="Service"   value={selectedBooking.serviceType} />
              <DrawerField label="Ville"     value={selectedBooking.city} />
              <DrawerField label="Date planifiée" value={fmtDate(selectedBooking.scheduledAt)} />
              <DrawerField label="Créé le"   value={fmtDate(selectedBooking.createdAt)} />
            </DrawerGrid>

            <div className="rounded-xl bg-[#F8FAFC] border border-[#E8EEF4] p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Client</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-purple-700">
                    {(selectedBooking.client.name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A2E]">{selectedBooking.client.name || '—'}</p>
                  <p className="text-xs text-[#9CA3AF]">{selectedBooking.client.email || '—'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#F8FAFC] border border-[#E8EEF4] p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Nettoyeur</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#EFF8FD] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#0369A1]">
                    {(selectedBooking.cleaner.name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A2E]">{selectedBooking.cleaner.name || '—'}</p>
                  <p className="text-xs text-[#9CA3AF]">{selectedBooking.cleaner.email || '—'}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#F0F4F8] flex gap-2">
              <button type="button"
                onClick={() => { void cancelBooking(selectedBooking); setSelectedBooking(null); }}
                disabled={selectedBooking.status === 'cancelled'}
                className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Annuler la réservation
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* ── CLIENT DETAIL DRAWER ── */}
      <DetailDrawer
        open={selectedClient !== null}
        onClose={() => setSelectedClient(null)}
        title="Profil client"
      >
        {selectedClient && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 pb-4 border-b border-[#F0F4F8]">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-purple-700">
                  {selectedClient.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-base font-bold text-[#1A1A2E]">{selectedClient.name}</p>
                <ActiveBadge active={selectedClient.active} />
              </div>
            </div>

            <DrawerGrid>
              <DrawerField label="Email"    value={selectedClient.email} />
              <DrawerField label="Téléphone" value={selectedClient.phone} />
              <DrawerField label="Ville"    value={selectedClient.city} />
              <DrawerField label="Inscrit le" value={fmtDate(selectedClient.createdAt)} />
            </DrawerGrid>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl bg-[#F8FAFC] border border-[#E8EEF4] p-4 flex items-center justify-between">
                <span className="text-sm text-[#6B7280]">Total réservations</span>
                <span className="text-2xl font-bold text-[#1A1A2E]">{selectedClient.bookingsCount}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#F0F4F8] flex gap-2">
              {selectedClient.active ? (
                <button type="button"
                  onClick={() => { void userAction('clients', selectedClient.id, 'deactivate'); setSelectedClient(null); }}
                  className="flex-1 rounded-xl border border-amber-200 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors">
                  Désactiver le compte
                </button>
              ) : (
                <button type="button"
                  onClick={() => { void userAction('clients', selectedClient.id, 'reactivate'); setSelectedClient(null); }}
                  className="flex-1 rounded-xl border border-emerald-200 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors">
                  Réactiver le compte
                </button>
              )}
              <button type="button"
                onClick={() => { void userAction('clients', selectedClient.id, 'delete'); setSelectedClient(null); }}
                className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* ── CLEANER DETAIL DRAWER ── */}
      <DetailDrawer
        open={selectedCleaner !== null}
        onClose={() => setSelectedCleaner(null)}
        title="Profil nettoyeur"
      >
        {selectedCleaner && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 pb-4 border-b border-[#F0F4F8]">
              <div className="w-14 h-14 rounded-2xl bg-[#EFF8FD] flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-[#0369A1]">
                  {selectedCleaner.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-base font-bold text-[#1A1A2E]">{selectedCleaner.name}</p>
                <ActiveBadge active={selectedCleaner.active} />
              </div>
            </div>

            <DrawerGrid>
              <DrawerField label="Email"     value={selectedCleaner.email} />
              <DrawerField label="Téléphone" value={selectedCleaner.phone} />
              <DrawerField label="Ville"     value={selectedCleaner.city} />
              <DrawerField label="Zone"      value={selectedCleaner.zone} />
              <DrawerField label="Inscrit le" value={fmtDate(selectedCleaner.createdAt)} />
              <DrawerField
                label="Services"
                value={selectedCleaner.services.length > 0 ? selectedCleaner.services.join(', ') : '—'}
              />
            </DrawerGrid>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Réservations', value: selectedCleaner.bookingsCount },
                { label: 'Complétés',    value: selectedCleaner.completedJobs },
                {
                  label: 'Note',
                  value: selectedCleaner.ratingAverage !== null
                    ? `${selectedCleaner.ratingAverage.toFixed(1)} ★`
                    : '—',
                },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-[#F8FAFC] border border-[#E8EEF4] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">{label}</p>
                  <p className="text-lg font-bold text-[#1A1A2E] mt-1">{value}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#F0F4F8] flex gap-2">
              {selectedCleaner.active ? (
                <button type="button"
                  onClick={() => { void userAction('cleaners', selectedCleaner.id, 'deactivate'); setSelectedCleaner(null); }}
                  className="flex-1 rounded-xl border border-amber-200 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors">
                  Désactiver
                </button>
              ) : (
                <button type="button"
                  onClick={() => { void userAction('cleaners', selectedCleaner.id, 'reactivate'); setSelectedCleaner(null); }}
                  className="flex-1 rounded-xl border border-emerald-200 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors">
                  Réactiver
                </button>
              )}
              <button type="button"
                onClick={() => { void userAction('cleaners', selectedCleaner.id, 'delete'); setSelectedCleaner(null); }}
                className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}


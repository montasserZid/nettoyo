import { CalendarDays, Loader2, Mail, MessageSquare, Phone, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { expirePendingBookingsByActor, shouldShowBookingContact } from '../lib/bookingLifecycle';
import supabase from '../lib/supabase';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'accepted' | 'expired';
type BookingSpace = {
  type?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
} | null;
type ClientReservationBooking = {
  id: string;
  status: BookingStatus;
  service_type: string | null;
  estimated_hours?: number | null;
  scheduled_at: string | null;
  created_at: string;
  cleaner_id: string | null;
  spaces?: BookingSpace | BookingSpace[] | null;
};
type CleanerContact = {
  name: string;
  email: string | null;
  phone: string | null;
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const contentByLanguage = {
  fr: {
    title: 'Mes reservations',
    subtitle: 'Suivez vos reservations actives et a venir.',
    pendingTitle: 'En attente',
    confirmedTitle: 'Confirmees',
    pendingEmpty: 'Aucune reservation en attente.',
    confirmedEmpty: 'Aucune reservation confirmee a venir.',
    statusPending: 'En attente',
    statusConfirmed: 'Confirmee',
    details: 'Details',
    close: 'Fermer',
    service: 'Service',
    propertyType: 'Type de propriete',
    location: 'Ville',
    schedule: 'Date et heure',
    estimate: 'Heures estimees',
    reference: 'Reference',
    cleaner: 'Nettoyeur',
    cancel: 'Annuler',
    cancelNotAllowed: "Annulation possible uniquement jusqu'a 24h avant la prestation.",
    cancelRule: "Vous pouvez annuler gratuitement jusqu'a 24 heures avant l'heure prevue.",
    cancelRuleBlocked: "Il reste moins de 24 heures: l'annulation n'est plus disponible.",
    confirmTitle: 'Confirmation',
    confirmMessage: 'Etes-vous sur ?',
    yes: 'Oui',
    no: 'Non',
    cancelledToast: 'Reservation annulee.',
    cancelError: "Impossible d'annuler cette reservation pour le moment.",
    loading: 'Chargement des reservations...',
    contactCta: 'Contacter le nettoyeur',
    contactRuleSoon: 'Les coordonnees seront affichees 24 heures avant le nettoyage.',
    contactRuleNow: 'Contact disponible (fenetre de 24h avant la prestation).',
    contactUnavailable: 'Coordonnees temporairement indisponibles.',
    noPhone: 'Telephone non disponible.'
  },
  en: {
    title: 'My bookings',
    subtitle: 'Track your active and upcoming bookings.',
    pendingTitle: 'Pending',
    confirmedTitle: 'Confirmed',
    pendingEmpty: 'No pending bookings.',
    confirmedEmpty: 'No confirmed upcoming bookings.',
    statusPending: 'Pending',
    statusConfirmed: 'Confirmed',
    details: 'Details',
    close: 'Close',
    service: 'Service',
    propertyType: 'Property type',
    location: 'City',
    schedule: 'Date and time',
    estimate: 'Estimated hours',
    reference: 'Reference',
    cleaner: 'Cleaner',
    cancel: 'Cancel booking',
    cancelNotAllowed: 'Cancellation is only available up to 24h before service.',
    cancelRule: 'You can cancel for free up to 24 hours before the scheduled time.',
    cancelRuleBlocked: 'Less than 24 hours remain: cancellation is no longer available.',
    confirmTitle: 'Confirmation',
    confirmMessage: 'Are you sure?',
    yes: 'Yes',
    no: 'No',
    cancelledToast: 'Booking cancelled.',
    cancelError: 'Unable to cancel this booking right now.',
    loading: 'Loading bookings...',
    contactCta: 'Contact cleaner',
    contactRuleSoon: 'Contact details will be displayed 24 hours before cleaning.',
    contactRuleNow: 'Contact available (within 24 hours before service).',
    contactUnavailable: 'Contact details are temporarily unavailable.',
    noPhone: 'Phone number unavailable.'
  },
  es: {
    title: 'Mis reservas',
    subtitle: 'Sigue tus reservas activas y proximas.',
    pendingTitle: 'Pendientes',
    confirmedTitle: 'Confirmadas',
    pendingEmpty: 'No hay reservas pendientes.',
    confirmedEmpty: 'No hay reservas confirmadas proximas.',
    statusPending: 'Pendiente',
    statusConfirmed: 'Confirmada',
    details: 'Detalles',
    close: 'Cerrar',
    service: 'Servicio',
    propertyType: 'Tipo de propiedad',
    location: 'Ciudad',
    schedule: 'Fecha y hora',
    estimate: 'Horas estimadas',
    reference: 'Referencia',
    cleaner: 'Limpiador',
    cancel: 'Cancelar reserva',
    cancelNotAllowed: 'La cancelacion solo esta disponible hasta 24h antes del servicio.',
    cancelRule: 'Puedes cancelar gratis hasta 24 horas antes de la hora programada.',
    cancelRuleBlocked: 'Quedan menos de 24 horas: la cancelacion ya no esta disponible.',
    confirmTitle: 'Confirmacion',
    confirmMessage: 'Estas seguro?',
    yes: 'Si',
    no: 'No',
    cancelledToast: 'Reserva cancelada.',
    cancelError: 'No se pudo cancelar la reserva ahora.',
    loading: 'Cargando reservas...',
    contactCta: 'Contactar al limpiador',
    contactRuleSoon: 'La informacion de contacto se mostrara 24 horas antes de la limpieza.',
    contactRuleNow: 'Contacto disponible (dentro de las 24 horas previas al servicio).',
    contactUnavailable: 'La informacion de contacto no esta disponible temporalmente.',
    noPhone: 'Telefono no disponible.'
  }
} as const;

const propertyTypeLabels = {
  apartment: { fr: 'Appartement', en: 'Apartment', es: 'Apartamento' },
  house: { fr: 'Maison', en: 'House', es: 'Casa' },
  office: { fr: 'Bureau', en: 'Office', es: 'Oficina' },
  other: { fr: 'Autre', en: 'Other', es: 'Otro' }
} as const;

const serviceLabels: Record<string, { fr: string; en: string; es: string }> = {
  domicile: { fr: 'Domicile', en: 'Home', es: 'Domicilio' },
  deep_cleaning: { fr: 'Profondeur', en: 'Deep cleaning', es: 'Profunda' },
  office: { fr: 'Bureau', en: 'Office', es: 'Oficina' },
  moving: { fr: 'Demenagement', en: 'Moving', es: 'Mudanza' },
  post_renovation: { fr: 'Post-renovation', en: 'Post-renovation', es: 'Post-renovacion' },
  airbnb: { fr: 'Airbnb', en: 'Airbnb', es: 'Airbnb' }
};

function getPrimarySpace(space: ClientReservationBooking['spaces']): BookingSpace {
  if (!space) return null;
  return Array.isArray(space) ? (space[0] ?? null) : space;
}

function formatMontrealDateTime(value: string | null, language: 'fr' | 'en' | 'es') {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const locale = language === 'fr' ? 'fr-CA' : language === 'es' ? 'es-CA' : 'en-CA';
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'America/Montreal',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatPropertyType(value: string | null | undefined, language: 'fr' | 'en' | 'es') {
  if (!value) return '--';
  return propertyTypeLabels[value as keyof typeof propertyTypeLabels]?.[language] ?? value;
}

function formatService(value: string | null, language: 'fr' | 'en' | 'es') {
  if (!value) return '--';
  const firstService = value.split(',').map((item) => item.trim()).find(Boolean) ?? value;
  return serviceLabels[firstService]?.[language] ?? firstService;
}

function toBookingReference(bookingId: string) {
  const compact = bookingId.replace(/-/g, '').toUpperCase();
  return `BK-${compact.slice(0, 6)}`;
}

function buildMaskedName(firstName?: string | null, lastName?: string | null) {
  const first = firstName?.trim();
  if (!first) return 'Nettoyo';
  const initial = lastName?.trim()?.[0]?.toUpperCase() ?? '';
  return initial ? `${first} ${initial}.` : first;
}

function statusClass(status: 'pending' | 'confirmed') {
  return status === 'pending'
    ? 'bg-[rgba(251,191,36,0.18)] text-[#92400E]'
    : 'bg-[rgba(79,195,247,0.14)] text-[#0284C7]';
}

const triggerBookingNotificationEvent = async (
  event: 'booking_cancelled',
  bookingId: string,
  accessToken: string | null
) => {
  try {
    const response = await fetch('/api/notifications/booking-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({ event, bookingId })
    });
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[booking-notify] cancellation email route returned 404. This is expected when running Vite dev (npm run dev) without Vercel runtime.');
      } else {
        console.error('[booking-notify] client cancellation trigger failed', { bookingId, status: response.status });
      }
    }
  } catch (error) {
    console.error('[booking-notify] client cancellation request error', { bookingId, error });
  }
};

export function ClientReservationsPage() {
  const { language } = useLanguage();
  const { user, session, isClient } = useAuth();
  const content = contentByLanguage[language];

  const [bookings, setBookings] = useState<ClientReservationBooking[]>([]);
  const [cleanerContacts, setCleanerContacts] = useState<Record<string, CleanerContact>>({});
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<ClientReservationBooking | null>(null);
  const [confirmCancelBooking, setConfirmCancelBooking] = useState<ClientReservationBooking | null>(null);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = window.setTimeout(() => setErrorMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [errorMessage]);

  const loadBookings = async (clientId: string) => {
    const withEstimateRes = await supabase
      .from('bookings')
      .select('id,status,service_type,estimated_hours,scheduled_at,created_at,cleaner_id,spaces(type,address,city,postal_code)')
      .eq('client_id', clientId)
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_at', { ascending: true });

    let fetchError = withEstimateRes.error;
    let rows: ClientReservationBooking[] = (withEstimateRes.data as ClientReservationBooking[] | null) ?? [];

    if (fetchError && (fetchError.code === '42703' || fetchError.message?.toLowerCase().includes('estimated_hours'))) {
      const fallbackRes = await supabase
        .from('bookings')
        .select('id,status,service_type,scheduled_at,created_at,cleaner_id,spaces(type,address,city,postal_code)')
        .eq('client_id', clientId)
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_at', { ascending: true });
      fetchError = fallbackRes.error;
      rows = (fallbackRes.data as ClientReservationBooking[] | null) ?? [];
    }

    if (fetchError) {
      console.error('Client reservations fetch error:', fetchError);
      setBookings([]);
      setCleanerContacts({});
      setLoading(false);
      return;
    }

    const now = new Date();
    const expiredIds = await expirePendingBookingsByActor('client_id', clientId, rows);
    const activeRows = rows.filter((row) => {
      if (!row.scheduled_at) return false;
      if (expiredIds.includes(row.id)) return false;
      const scheduled = new Date(row.scheduled_at);
      if (Number.isNaN(scheduled.getTime())) return false;
      return scheduled.getTime() >= now.getTime();
    });
    setBookings(activeRows.filter((row) => row.status === 'pending' || row.status === 'confirmed'));

    const cleanerIds = Array.from(new Set(activeRows.map((row) => row.cleaner_id).filter((value): value is string => Boolean(value))));
    if (cleanerIds.length === 0) {
      setCleanerContacts({});
      setLoading(false);
      return;
    }

    const cleanerRes = await supabase
      .from('profiles')
      .select('id,first_name,last_name,email,phone')
      .in('id', cleanerIds);

    if (cleanerRes.error) {
      console.error('Client reservations cleaner lookup error:', cleanerRes.error);
      setCleanerContacts({});
      setLoading(false);
      return;
    }

    const map = ((cleanerRes.data as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null }> | null) ?? []).reduce<Record<string, CleanerContact>>(
      (acc, item) => {
        acc[item.id] = {
          name: buildMaskedName(item.first_name, item.last_name),
          email: item.email?.trim() || null,
          phone: item.phone?.trim() || null
        };
        return acc;
      },
      {}
    );
    setCleanerContacts(map);
    setLoading(false);
  };

  useEffect(() => {
    if (!user?.id || !isClient()) {
      setBookings([]);
      setCleanerContacts({});
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      await loadBookings(user.id);
      if (!active) return;
    };

    void load();
    return () => {
      active = false;
    };
  }, [isClient, user?.id]);

  useEffect(() => {
    if (!user?.id || !isClient()) {
      return;
    }

    const channel = supabase
      .channel(`client-reservations-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `client_id=eq.${user.id}`
        },
        () => {
          void loadBookings(user.id);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isClient, user?.id]);

  const pendingBookings = useMemo(() => bookings.filter((booking) => booking.status === 'pending'), [bookings]);
  const confirmedBookings = useMemo(() => bookings.filter((booking) => booking.status === 'confirmed'), [bookings]);

  const getCancellationDiagnostics = (booking: ClientReservationBooking, now = new Date()) => {
    const scheduledRaw = booking.scheduled_at;
    const scheduledDate = scheduledRaw ? new Date(scheduledRaw) : null;
    const scheduledMs = scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate.getTime() : null;
    const nowMs = now.getTime();
    const diffMs = scheduledMs === null ? null : scheduledMs - nowMs;
    const diffHours = diffMs === null ? null : diffMs / (60 * 60 * 1000);
    const montrealNow = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Montreal',
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(now);
    const canCancel = diffMs !== null && diffMs >= TWENTY_FOUR_HOURS_MS;

    return {
      bookingId: booking.id,
      scheduledAtRaw: scheduledRaw,
      nowIso: now.toISOString(),
      montrealNow,
      diffMs,
      diffHours,
      canCancel
    };
  };

  const canCancelBooking = (booking: ClientReservationBooking) => getCancellationDiagnostics(booking).canCancel;

  const canShowContact = (booking: ClientReservationBooking) => shouldShowBookingContact(booking.scheduled_at);

  const runCancel = async (booking: ClientReservationBooking) => {
    const cancelDiag = getCancellationDiagnostics(booking);
    console.info('[client-cancel] eligibility', cancelDiag);

    if (!user?.id || !cancelDiag.canCancel) {
      setErrorMessage(content.cancelNotAllowed);
      return;
    }

    setActionBookingId(booking.id);
    const updateRes = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id)
      .eq('client_id', user.id)
      .in('status', ['pending', 'confirmed'])
      .select('id,status')
      .maybeSingle();

    if (updateRes.error) {
      console.error('Client booking cancellation error:', updateRes.error);
      setErrorMessage(content.cancelError);
      setActionBookingId(null);
      return;
    }

    const updatedRow = updateRes.data as { id: string; status: string } | null;
    if (!updatedRow || updatedRow.status !== 'cancelled') {
      await loadBookings(user.id);
      setErrorMessage(content.cancelError);
      setActionBookingId(null);
      return;
    }

    await triggerBookingNotificationEvent('booking_cancelled', booking.id, session?.access_token ?? null);

    setBookings((current) => current.filter((item) => item.id !== booking.id));
    if (selectedBooking?.id === booking.id) {
      setSelectedBooking(null);
    }
    setToast(content.cancelledToast);
    setActionBookingId(null);
  };

  const selectedSpace = getPrimarySpace(selectedBooking?.spaces ?? null);
  const selectedCleaner = selectedBooking?.cleaner_id ? cleanerContacts[selectedBooking.cleaner_id] : undefined;
  const selectedContactVisible = selectedBooking ? canShowContact(selectedBooking) : false;
  const selectedCancelAllowed = selectedBooking ? canCancelBooking(selectedBooking) : false;

  useEffect(() => {
    const hasOpenModal = Boolean(selectedBooking || confirmCancelBooking);
    if (!hasOpenModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmCancelBooking, selectedBooking]);

  if (!isClient()) return null;

  const renderCard = (booking: ClientReservationBooking, status: 'pending' | 'confirmed') => {
    const space = getPrimarySpace(booking.spaces);
    const contactVisible = canShowContact(booking);
    const cancelAllowed = canCancelBooking(booking);

    return (
      <article key={booking.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_10px_24px_rgba(17,24,39,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1A1A2E]">{formatPropertyType(space?.type, language)}</p>
            <p className="mt-1 text-xs font-semibold text-[#0284C7]">{formatService(booking.service_type, language)}</p>
            <p className="mt-1 text-xs text-[#6B7280]">{[space?.city, space?.postal_code].filter(Boolean).join(', ') || '--'}</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(status)}`}>
            {status === 'pending' ? content.statusPending : content.statusConfirmed}
          </span>
        </div>

        <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#1A1A2E]">
          <CalendarDays size={14} className="text-[#4FC3F7]" />
          {formatMontrealDateTime(booking.scheduled_at, language)}
        </div>

        {contactVisible ? (
          <p className="mt-3 rounded-xl bg-[rgba(168,230,207,0.24)] px-3 py-2 text-xs font-medium text-[#166534]">{content.contactRuleNow}</p>
        ) : (
          <p className="mt-3 rounded-xl bg-[#F8FCFF] px-3 py-2 text-xs font-medium text-[#4B5563]">{content.contactRuleSoon}</p>
        )}

        {!cancelAllowed ? (
          <p className="mt-2 text-xs font-medium text-[#B45309]">{content.cancelNotAllowed}</p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSelectedBooking(booking)}
            className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#1A1A2E]"
          >
            {content.details}
          </button>
          <button
            type="button"
            disabled={!contactVisible}
            onClick={() => setSelectedBooking(booking)}
            className="inline-flex items-center justify-center rounded-full border border-[#A7F3D0] px-3 py-2 text-xs font-semibold text-[#166534] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {content.contactCta}
          </button>
          <button
            type="button"
            disabled={!cancelAllowed || actionBookingId === booking.id}
            onClick={() => setConfirmCancelBooking(booking)}
            className="inline-flex items-center justify-center rounded-full border border-[#FCA5A5] px-3 py-2 text-xs font-semibold text-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {actionBookingId === booking.id ? <Loader2 size={13} className="animate-spin" /> : content.cancel}
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#F7F7F7] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {toast ? <div className="fixed right-4 top-24 z-50 rounded-full bg-[#1A1A2E] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(17,24,39,0.2)]">{toast}</div> : null}
        {errorMessage ? <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[rgba(239,68,68,0.14)] px-5 py-3 text-sm font-semibold text-[#B91C1C] shadow-[0_12px_24px_rgba(17,24,39,0.12)]">{errorMessage}</div> : null}

        <section className="rounded-[28px] bg-white px-6 py-8 shadow-[0_16px_36px_rgba(17,24,39,0.07)] sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4FC3F7]">Reservations</p>
          <h1 className="mt-2 text-2xl font-bold text-[#1A1A2E] sm:text-3xl">{content.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">{content.subtitle}</p>
        </section>

        {loading ? (
          <section className="mt-6 rounded-[28px] bg-white p-12 text-center shadow-[0_14px_32px_rgba(17,24,39,0.06)]">
            <Loader2 className="mx-auto animate-spin text-[#4FC3F7]" size={28} />
            <p className="mt-4 text-sm font-medium text-[#6B7280]">{content.loading}</p>
          </section>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[#1A1A2E]">{content.pendingTitle}</h2>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[rgba(251,191,36,0.18)] px-2 text-xs font-bold text-[#92400E]">{pendingBookings.length}</span>
              </div>
              {pendingBookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-8 text-center text-sm text-[#6B7280]">{content.pendingEmpty}</div>
              ) : (
                <div className="space-y-3">{pendingBookings.map((booking) => renderCard(booking, 'pending'))}</div>
              )}
            </section>

            <section className="rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[#1A1A2E]">{content.confirmedTitle}</h2>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] px-2 text-xs font-bold text-[#0284C7]">{confirmedBookings.length}</span>
              </div>
              {confirmedBookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-8 text-center text-sm text-[#6B7280]">{content.confirmedEmpty}</div>
              ) : (
                <div className="space-y-3">{confirmedBookings.map((booking) => renderCard(booking, 'confirmed'))}</div>
              )}
            </section>
          </div>
        )}
      </div>

      {selectedBooking ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-4 py-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.28)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1A1A2E]">{content.details}</h3>
                <p className="mt-1 text-sm text-[#4B5563]">{formatMontrealDateTime(selectedBooking.scheduled_at, language)}</p>
              </div>
              <button type="button" onClick={() => setSelectedBooking(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280]">
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#E5E7EB] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.propertyType}</p>
                <p className="mt-2 text-sm font-semibold text-[#1A1A2E]">{formatPropertyType(selectedSpace?.type, language)}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.location}</p>
                <p className="mt-2 text-sm text-[#4B5563]">{[selectedSpace?.city, selectedSpace?.postal_code].filter(Boolean).join(', ') || '--'}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.schedule}</p>
                <p className="mt-2 text-sm text-[#4B5563]">{formatMontrealDateTime(selectedBooking.scheduled_at, language)}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.reference}</p>
                <p className="mt-2 text-sm text-[#4B5563]">{toBookingReference(selectedBooking.id)}</p>
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.service}</p>
                <p className="mt-2 text-sm font-semibold text-[#1A1A2E]">{formatService(selectedBooking.service_type, language)}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.cleaner}</p>
                <p className="mt-2 text-sm text-[#4B5563]">{selectedCleaner?.name || 'Nettoyo'}</p>
                {typeof selectedBooking.estimated_hours === 'number' ? (
                  <>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.estimate}</p>
                    <p className="mt-2 text-sm text-[#4B5563]">{selectedBooking.estimated_hours}h</p>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#E5E7EB] p-4">
              <p className="text-sm font-semibold text-[#1A1A2E]">{content.cancelRule}</p>
              <p className={`mt-2 text-sm ${selectedCancelAllowed ? 'text-[#166534]' : 'text-[#B45309]'}`}>
                {selectedCancelAllowed ? content.cancelRule : content.cancelRuleBlocked}
              </p>

              <div className="mt-4 rounded-xl bg-[#F8FCFF] px-3 py-2">
                <p className="text-sm font-semibold text-[#1A1A2E]">{selectedContactVisible ? content.contactRuleNow : content.contactRuleSoon}</p>
                {selectedContactVisible ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCleaner?.phone ? (
                      <a href={`tel:${selectedCleaner.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#A8E6CF] px-3 py-2 text-xs font-semibold text-[#1A1A2E]">
                        <Phone size={12} />
                        {selectedCleaner.phone}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-3 py-2 text-xs font-semibold text-[#475569]">
                        <Phone size={12} />
                        {content.noPhone}
                      </span>
                    )}
                    {selectedCleaner?.email ? (
                      <a href={`mailto:${selectedCleaner.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#E0F2FE] px-3 py-2 text-xs font-semibold text-[#0C4A6E]">
                        <Mail size={12} />
                        {selectedCleaner.email}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280]"
              >
                {content.close}
              </button>
              <button
                type="button"
                disabled={!selectedCancelAllowed || actionBookingId === selectedBooking.id}
                onClick={() => setConfirmCancelBooking(selectedBooking)}
                className="inline-flex min-w-[120px] items-center justify-center rounded-full border border-[#FCA5A5] px-5 py-2 text-sm font-semibold text-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {actionBookingId === selectedBooking.id ? <Loader2 size={14} className="animate-spin" /> : content.cancel}
              </button>
              {selectedContactVisible ? (
                <div className="flex flex-wrap gap-2">
                  {selectedCleaner?.phone ? (
                    <a
                      href={`tel:${selectedCleaner.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#A8E6CF] px-4 py-2 text-sm font-semibold text-[#1A1A2E]"
                    >
                      <Phone size={14} />
                      {content.contactCta}
                    </a>
                  ) : null}
                  {selectedCleaner?.email ? (
                    <a
                      href={`mailto:${selectedCleaner.email}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#E0F2FE] px-4 py-2 text-sm font-semibold text-[#0C4A6E]"
                    >
                      <Mail size={14} />
                      {selectedCleaner.email}
                    </a>
                  ) : null}
                  {!selectedCleaner?.phone && !selectedCleaner?.email ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-4 py-2 text-sm font-semibold text-[#475569]">
                      <MessageSquare size={14} />
                      {content.contactUnavailable}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-4 py-2 text-sm font-semibold text-[#475569]">
                  <MessageSquare size={14} />
                  {content.contactRuleSoon}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {confirmCancelBooking ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-4 py-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.28)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1A1A2E]">{content.confirmTitle}</h3>
                <p className="mt-1 text-sm text-[#4B5563]">{content.confirmMessage}</p>
              </div>
              <button type="button" onClick={() => setConfirmCancelBooking(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280]">
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-[#F8FCFF] px-4 py-3 text-sm text-[#1A1A2E]">
              <p className="font-semibold">{formatService(confirmCancelBooking.service_type, language)}</p>
              <p className="mt-1 text-[#4B5563]">{formatMontrealDateTime(confirmCancelBooking.scheduled_at, language)}</p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancelBooking(null)}
                className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280]"
              >
                {content.no}
              </button>
              <button
                type="button"
                disabled={Boolean(actionBookingId)}
                onClick={() => {
                  const booking = confirmCancelBooking;
                  setConfirmCancelBooking(null);
                  void runCancel(booking);
                }}
                className="inline-flex min-w-[96px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {actionBookingId === confirmCancelBooking.id ? <Loader2 size={14} className="animate-spin" /> : content.yes}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

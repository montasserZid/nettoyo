import { CalendarDays, Clock3, Loader2, MessageSquare, Phone, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getMontrealToday, isTodayOrFutureInMontreal } from '../lib/montrealDate';
import supabase from '../lib/supabase';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'accepted';
type BookingSpace = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  rooms?: unknown;
  notes?: string | null;
} | null;
type CleanerBooking = {
  id: string;
  status: BookingStatus;
  service_type: string | null;
  scheduled_at: string | null;
  created_at: string;
  space_id: string;
  client_id: string;
  spaces?: BookingSpace | BookingSpace[] | null;
};

const serviceLabels: Record<string, { fr: string; en: string; es: string }> = {
  domicile: { fr: 'Domicile', en: 'Home', es: 'Domicilio' },
  deep_cleaning: { fr: 'Profondeur', en: 'Deep cleaning', es: 'Profunda' },
  office: { fr: 'Bureau', en: 'Office', es: 'Oficina' },
  moving: { fr: 'Demenagement', en: 'Moving', es: 'Mudanza' },
  post_renovation: { fr: 'Post-renovation', en: 'Post-renovation', es: 'Post-renovacion' },
  airbnb: { fr: 'Airbnb', en: 'Airbnb', es: 'Airbnb' }
};

const contentByLanguage = {
  fr: {
    title: 'Mes reservations',
    subtitle: 'Gerez vos demandes et interventions a venir.',
    pendingTitle: 'Demandes de nettoyage',
    acceptedTitle: 'Demandes acceptees',
    pendingEmpty: 'Aucune nouvelle demande pour le moment.',
    acceptedEmpty: 'Aucune reservation acceptee a venir.',
    scheduledFor: 'Planifie pour',
    statusPending: 'En attente',
    statusAccepted: 'Acceptee',
    privacy: 'Les informations completes seront disponibles apres acceptation',
    details: 'Details',
    accept: 'Accepter',
    refuse: 'Refuser',
    contact: 'Contact',
    placeDetails: 'Details du lieu',
    clientNote: 'Note client',
    noClientNote: 'Aucune note client',
    noPlaceDetails: 'Aucun detail supplementaire',
    modalTitlePending: 'Demande en attente',
    modalTitleAccepted: 'Reservation acceptee',
    close: 'Fermer',
    contactSoon: 'Contact bientot disponible',
    actionError: "Impossible de mettre a jour la reservation pour l'instant.",
    loading: 'Chargement des reservations...'
  },
  en: {
    title: 'My bookings',
    subtitle: 'Manage upcoming requests and accepted jobs.',
    pendingTitle: 'Cleaning requests',
    acceptedTitle: 'Accepted requests',
    pendingEmpty: 'No new requests right now.',
    acceptedEmpty: 'No accepted upcoming bookings.',
    scheduledFor: 'Scheduled for',
    statusPending: 'Pending',
    statusAccepted: 'Accepted',
    privacy: 'Full details become available after acceptance',
    details: 'Details',
    accept: 'Accept',
    refuse: 'Decline',
    contact: 'Contact',
    placeDetails: 'Place details',
    clientNote: 'Client note',
    noClientNote: 'No client note',
    noPlaceDetails: 'No additional details',
    modalTitlePending: 'Pending request',
    modalTitleAccepted: 'Accepted booking',
    close: 'Close',
    contactSoon: 'Contact coming soon',
    actionError: 'Unable to update booking right now.',
    loading: 'Loading bookings...'
  },
  es: {
    title: 'Mis reservas',
    subtitle: 'Gestiona solicitudes y trabajos proximos.',
    pendingTitle: 'Solicitudes de limpieza',
    acceptedTitle: 'Solicitudes aceptadas',
    pendingEmpty: 'No hay solicitudes nuevas por ahora.',
    acceptedEmpty: 'No hay reservas aceptadas proximas.',
    scheduledFor: 'Programada para',
    statusPending: 'Pendiente',
    statusAccepted: 'Aceptada',
    privacy: 'La informacion completa estara disponible despues de aceptar',
    details: 'Detalles',
    accept: 'Aceptar',
    refuse: 'Rechazar',
    contact: 'Contacto',
    placeDetails: 'Detalles del lugar',
    clientNote: 'Nota del cliente',
    noClientNote: 'Sin nota del cliente',
    noPlaceDetails: 'Sin detalles adicionales',
    modalTitlePending: 'Solicitud pendiente',
    modalTitleAccepted: 'Reserva aceptada',
    close: 'Cerrar',
    contactSoon: 'Contacto disponible pronto',
    actionError: 'No se pudo actualizar la reserva.',
    loading: 'Cargando reservas...'
  }
} as const;

const roomLabels = {
  fr: {
    bedrooms: 'Chambres',
    bathrooms: 'Salles de bain',
    livingRooms: 'Salons',
    kitchens: 'Cuisines',
    offices: 'Bureaux',
    other: 'Autres'
  },
  en: {
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    livingRooms: 'Living rooms',
    kitchens: 'Kitchens',
    offices: 'Offices',
    other: 'Other'
  },
  es: {
    bedrooms: 'Dormitorios',
    bathrooms: 'Banos',
    livingRooms: 'Salas',
    kitchens: 'Cocinas',
    offices: 'Oficinas',
    other: 'Otros'
  }
} as const;

function isAcceptedStatus(status: string) {
  return status === 'confirmed' || status === 'accepted';
}

function getPrimarySpace(space: CleanerBooking['spaces']): BookingSpace {
  if (!space) return null;
  return Array.isArray(space) ? (space[0] ?? null) : space;
}

function formatMontrealDateTime(value: string | null, language: 'fr' | 'en' | 'es') {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const locale = language === 'fr' ? 'fr-CA' : language === 'es' ? 'es-CA' : 'en-CA';
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'America/Toronto',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatApproxAddress(space: BookingSpace) {
  const city = space?.city?.trim() || 'Montreal';
  const postal = space?.postal_code?.replace(/\s+/g, '').toUpperCase() || '';
  const postalPreview = postal ? `${postal.slice(0, 3)}...` : '';
  return [city, postalPreview].filter(Boolean).join(', ');
}

function formatDetailedAddress(space: BookingSpace) {
  const chunks = [space?.address, space?.city, space?.postal_code].filter((item) => Boolean(item && String(item).trim()));
  return chunks.length > 0 ? chunks.join(', ') : formatApproxAddress(space);
}

function getServiceLabel(serviceType: string | null, language: 'fr' | 'en' | 'es') {
  if (!serviceType) return language === 'fr' ? 'Service' : language === 'es' ? 'Servicio' : 'Service';
  return serviceLabels[serviceType]?.[language] ?? serviceType;
}

function normalizeRooms(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [] as Array<{ key: string; count: number }>;
  return Object.entries(value as Record<string, unknown>)
    .map(([key, raw]) => ({ key, count: typeof raw === 'number' ? raw : Number(raw) }))
    .filter((item) => Number.isFinite(item.count) && item.count > 0);
}

function getRoomLabel(key: string, language: 'fr' | 'en' | 'es') {
  return (roomLabels[language] as Record<string, string>)[key] ?? key;
}

function bookingStatusTone(status: 'pending' | 'accepted') {
  return status === 'pending'
    ? 'bg-[rgba(239,68,68,0.12)] text-[#B91C1C]'
    : 'bg-[rgba(79,195,247,0.12)] text-[#0284C7]';
}

export function CleanerReservationsPage() {
  const { language } = useLanguage();
  const { user, isCleaner } = useAuth();
  const content = contentByLanguage[language];
  const [bookings, setBookings] = useState<CleanerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<CleanerBooking | null>(null);
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
    const timer = window.setTimeout(() => setErrorMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [errorMessage]);

  const loadBookings = async (cleanerId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('id,status,service_type,scheduled_at,created_at,space_id,client_id,spaces(address,city,postal_code,rooms,notes,name)')
      .eq('cleaner_id', cleanerId)
      .in('status', ['pending', 'confirmed', 'accepted'])
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('Cleaner reservations fetch error:', error);
      setBookings([]);
      setLoading(false);
      return;
    }

    setBookings((data as CleanerBooking[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user?.id || !isCleaner()) {
      setBookings([]);
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
  }, [isCleaner, user?.id]);

  const montrealToday = useMemo(() => getMontrealToday(), []);
  const upcoming = useMemo(
    () => bookings.filter((booking) => booking.scheduled_at && isTodayOrFutureInMontreal(booking.scheduled_at, montrealToday)),
    [bookings, montrealToday]
  );
  const pending = useMemo(() => upcoming.filter((booking) => booking.status === 'pending'), [upcoming]);
  const accepted = useMemo(() => upcoming.filter((booking) => isAcceptedStatus(booking.status)), [upcoming]);

  const runAction = async (booking: CleanerBooking, nextStatus: 'confirmed' | 'cancelled') => {
    if (!user?.id) return;
    setActionBookingId(booking.id);
    const { error } = await supabase
      .from('bookings')
      .update({ status: nextStatus })
      .eq('id', booking.id)
      .eq('cleaner_id', user.id);

    if (error) {
      console.error('Booking status update error:', error);
      setErrorMessage(content.actionError);
      setActionBookingId(null);
      return;
    }

    await loadBookings(user.id);
    setActionBookingId(null);
    if (selectedBooking?.id === booking.id) {
      setSelectedBooking((current) => (current ? { ...current, status: nextStatus } : current));
      if (nextStatus === 'cancelled') {
        setSelectedBooking(null);
      }
    }
  };

  if (!isCleaner()) return null;

  const renderPendingCard = (booking: CleanerBooking) => {
    const space = getPrimarySpace(booking.spaces);
    return (
      <article key={booking.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_10px_24px_rgba(17,24,39,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#1A1A2E]">{formatApproxAddress(space)}</p>
            <p className="mt-1 text-xs font-semibold text-[#0284C7]">{getServiceLabel(booking.service_type, language)}</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${bookingStatusTone('pending')}`}>
            {content.statusPending}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#1A1A2E]">
          <CalendarDays size={14} className="text-[#4FC3F7]" />
          <span>{formatMontrealDateTime(booking.scheduled_at, language)}</span>
        </div>

        <p className="mt-3 rounded-xl bg-[rgba(79,195,247,0.08)] px-3 py-2 text-xs font-medium text-[#4B5563]">
          {content.privacy}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={actionBookingId === booking.id}
            onClick={() => void runAction(booking, 'cancelled')}
            className="inline-flex items-center justify-center rounded-full border border-[#FCA5A5] px-3 py-2 text-xs font-semibold text-[#B91C1C] transition-colors hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-60"
          >
            {content.refuse}
          </button>
          <button
            type="button"
            onClick={() => setSelectedBooking(booking)}
            className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#1A1A2E] transition-colors hover:bg-[#F9FAFB]"
          >
            {content.details}
          </button>
          <button
            type="button"
            disabled={actionBookingId === booking.id}
            onClick={() => void runAction(booking, 'confirmed')}
            className="inline-flex items-center justify-center rounded-full bg-[#4FC3F7] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#3FAAD4] disabled:opacity-60"
          >
            {actionBookingId === booking.id ? <Loader2 size={13} className="animate-spin" /> : content.accept}
          </button>
        </div>
      </article>
    );
  };

  const renderAcceptedCard = (booking: CleanerBooking) => {
    const space = getPrimarySpace(booking.spaces);
    return (
      <article key={booking.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_10px_24px_rgba(17,24,39,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#1A1A2E]">{formatDetailedAddress(space)}</p>
            <p className="mt-1 text-xs font-semibold text-[#0284C7]">{getServiceLabel(booking.service_type, language)}</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${bookingStatusTone('accepted')}`}>
            {content.statusAccepted}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#1A1A2E]">
          <Clock3 size={14} className="text-[#4FC3F7]" />
          <span>{formatMontrealDateTime(booking.scheduled_at, language)}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSelectedBooking(booking)}
            className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#1A1A2E] transition-colors hover:bg-[#F9FAFB]"
          >
            {content.details}
          </button>
          <button
            type="button"
            onClick={() => setToast(content.contactSoon)}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#A8E6CF] px-3 py-2 text-xs font-semibold text-[#1A1A2E] transition-colors hover:bg-[#97d9be]"
          >
            <Phone size={12} />
            {content.contact}
          </button>
        </div>
      </article>
    );
  };

  const selectedSpace = getPrimarySpace(selectedBooking?.spaces ?? null);
  const selectedRooms = normalizeRooms(selectedSpace?.rooms);
  const selectedIsPending = selectedBooking?.status === 'pending';

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
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#EF4444] px-2 text-xs font-bold text-white">{pending.length}</span>
              </div>
              {pending.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-8 text-center text-sm text-[#6B7280]">{content.pendingEmpty}</div>
              ) : (
                <div className="space-y-3">{pending.map((booking) => renderPendingCard(booking))}</div>
              )}
            </section>

            <section className="rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[#1A1A2E]">{content.acceptedTitle}</h2>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] px-2 text-xs font-bold text-[#0284C7]">{accepted.length}</span>
              </div>
              {accepted.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-8 text-center text-sm text-[#6B7280]">{content.acceptedEmpty}</div>
              ) : (
                <div className="space-y-3">{accepted.map((booking) => renderAcceptedCard(booking))}</div>
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
                <h3 className="text-lg font-bold text-[#1A1A2E]">{selectedIsPending ? content.modalTitlePending : content.modalTitleAccepted}</h3>
                <p className="mt-1 text-sm font-semibold text-[#0284C7]">{getServiceLabel(selectedBooking.service_type, language)}</p>
                <p className="mt-1 text-sm text-[#4B5563]">{formatMontrealDateTime(selectedBooking.scheduled_at, language)}</p>
              </div>
              <button type="button" onClick={() => setSelectedBooking(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F7F7]">
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#E5E7EB] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.placeDetails}</p>
                <p className="mt-2 text-sm font-semibold text-[#1A1A2E]">{formatDetailedAddress(selectedSpace)}</p>
                {selectedRooms.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    {selectedRooms.map((item) => (
                      <div key={item.key} className="flex items-center justify-between text-sm text-[#4B5563]">
                        <span>{getRoomLabel(item.key, language)}</span>
                        <span className="font-semibold text-[#1A1A2E]">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[#6B7280]">{content.noPlaceDetails}</p>
                )}
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.clientNote}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">{selectedSpace?.notes?.trim() || content.noClientNote}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              {selectedIsPending ? (
                <>
                  <button
                    type="button"
                    disabled={actionBookingId === selectedBooking.id}
                    onClick={() => void runAction(selectedBooking, 'cancelled')}
                    className="rounded-full border border-[#FCA5A5] px-4 py-2 text-sm font-semibold text-[#B91C1C] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-60"
                  >
                    {content.refuse}
                  </button>
                  <button
                    type="button"
                    disabled={actionBookingId === selectedBooking.id}
                    onClick={() => void runAction(selectedBooking, 'confirmed')}
                    className="inline-flex min-w-[120px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3FAAD4] disabled:opacity-60"
                  >
                    {actionBookingId === selectedBooking.id ? <Loader2 size={14} className="animate-spin" /> : content.accept}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setToast(content.contactSoon)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#A8E6CF] px-4 py-2 text-sm font-semibold text-[#1A1A2E] hover:bg-[#97d9be]"
                  >
                    <Phone size={14} />
                    {content.contact}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBooking(null)}
                    className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] hover:bg-[#F9FAFB]"
                  >
                    {content.close}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

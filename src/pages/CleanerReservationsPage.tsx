import { CalendarDays, Clock3, Loader2, MessageSquare, Phone, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { expirePendingBookingsByActor, shouldShowBookingContact, shouldShowBookingFullAddress } from '../lib/bookingLifecycle';
import { getLocalizedRoomText, normalizeRoomItems } from '../lib/roomDisplay';
import supabase from '../lib/supabase';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'accepted' | 'expired';
type BookingSpace = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  floor?: string | null;
  rooms?: unknown;
  notes?: string | null;
} | null;
type CleanerBooking = {
  id: string;
  status: BookingStatus;
  service_type: string | null;
  estimated_hours?: number | null;
  scheduled_at: string | null;
  created_at: string;
  space_id: string;
  client_id: string;
  spaces?: BookingSpace | BookingSpace[] | null;
};

type ClientContact = {
  name: string;
  email: string | null;
  phone: string | null;
};

const serviceLabels: Record<string, { fr: string; en: string; es: string }> = {
  domicile: { fr: 'Domicile', en: 'Home', es: 'Domicilio' },
  deep_cleaning: { fr: 'Profondeur', en: 'Deep cleaning', es: 'Profunda' },
  office: { fr: 'Bureau', en: 'Office', es: 'Oficina' },
  moving: { fr: 'Déménagement', en: 'Moving', es: 'Mudanza' },
  post_renovation: { fr: 'Post-renovation', en: 'Post-renovation', es: 'Post-renovacion' },
  airbnb: { fr: 'Airbnb', en: 'Airbnb', es: 'Airbnb' }
};

const contentByLanguage = {
  fr: {
    title: 'Mes réservations',
    subtitle: 'Gérez vos demandes et interventions à venir.',
    pendingTitle: 'Demandes de nettoyage',
    acceptedTitle: 'Demandes acceptées',
    pendingEmpty: 'Aucune nouvelle demande pour le moment.',
    acceptedEmpty: 'Aucune réservation acceptée à venir.',
    scheduledFor: 'Planifie pour',
    statusPending: 'En attente',
    statusAccepted: 'Acceptée',
    privacy: 'Les informations complètes seront disponibles après acceptation',
    details: 'Détails',
    accept: 'Accepter',
    refuse: 'Refuser',
    contact: 'Contact',
    placeDetails: 'Détails du lieu',
    clientNote: 'Note client',
    noClientNote: 'Aucune note client',
    noPlaceDetails: 'Aucun détail supplémentaire',
    modalTitlePending: 'Demande en attente',
    modalTitleAccepted: 'Réservation acceptée',
    close: 'Fermer',
    contactSoon: 'Contact bientôt disponible',
    contactAvailable: 'Coordonnées disponibles',
    contactRuleSoon: 'Les coordonnées seront disponibles 24 h avant la réservation.',
    noPhone: 'Téléphone non disponible',
    contactModalTitle: 'Contact du client',
    addressRuleSoon: "L'adresse complete sera disponible 24 h avant la reservation.",
    actionError: "Impossible de mettre à jour la réservation pour l'instant.",
    confirmTitle: 'Confirmation',
    confirmMessage: 'Êtes-vous sûr ?',
    yes: 'Oui',
    no: 'Non',
    acceptedToast: 'Réservation acceptée.',
    declinedToast: 'Demande refusée.',
    loading: 'Chargement des réservations...'
    ,
    estimatedHours: 'Estimation',
    hoursSuffix: 'h'
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
    contactAvailable: 'Contact details available',
    contactRuleSoon: 'Contact details will be available 24h before booking.',
    noPhone: 'Phone unavailable',
    contactModalTitle: 'Client contact',
    addressRuleSoon: 'The full address will be available 24h before booking.',
    actionError: 'Unable to update booking right now.',
    confirmTitle: 'Confirmation',
    confirmMessage: 'Are you sure?',
    yes: 'Yes',
    no: 'No',
    acceptedToast: 'Booking accepted.',
    declinedToast: 'Request declined.',
    loading: 'Loading bookings...',
    estimatedHours: 'Estimate',
    hoursSuffix: 'h'
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
    contactAvailable: 'Contacto disponible',
    contactRuleSoon: 'Los datos estaran disponibles 24h antes de la reserva.',
    noPhone: 'Telefono no disponible',
    contactModalTitle: 'Contacto del cliente',
    addressRuleSoon: 'La direccion completa estara disponible 24h antes de la reserva.',
    actionError: 'No se pudo actualizar la reserva.',
    confirmTitle: 'Confirmacion',
    confirmMessage: 'Estas seguro?',
    yes: 'Si',
    no: 'No',
    acceptedToast: 'Reserva aceptada.',
    declinedToast: 'Solicitud rechazada.',
    loading: 'Cargando reservas...',
    estimatedHours: 'Estimacion',
    hoursSuffix: 'h'
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
    timeZone: 'America/Montreal',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatApproxAddress(space: BookingSpace) {
  const city = space?.city?.trim() || '';
  const postal = space?.postal_code?.replace(/\s+/g, '').toUpperCase() || '';
  const postalPreview = postal ? `${postal.slice(0, 3)}...` : '';
  const value = [city, postalPreview].filter(Boolean).join(', ');
  return value || '--';
}

function formatDetailedAddress(space: BookingSpace) {
  const floor = space?.floor?.trim();
  const floorChunk = floor ? `Unité ${floor}` : null;
  const chunks = [space?.address, floorChunk, space?.city, space?.province, space?.postal_code].filter((item) => Boolean(item && String(item).trim()));
  return chunks.length > 0 ? chunks.join(', ') : formatApproxAddress(space);
}

function getServiceLabel(serviceType: string | null, language: 'fr' | 'en' | 'es') {
  if (!serviceType) return language === 'fr' ? 'Service' : language === 'es' ? 'Servicio' : 'Service';
  return serviceLabels[serviceType]?.[language] ?? serviceType;
}

function buildMaskedName(firstName?: string | null, lastName?: string | null) {
  const first = firstName?.trim();
  if (!first) return 'Client';
  const initial = lastName?.trim()?.[0]?.toUpperCase() ?? '';
  return initial ? `${first} ${initial}.` : first;
}

function bookingStatusTone(status: 'pending' | 'accepted') {
  return status === 'pending'
    ? 'bg-[rgba(239,68,68,0.12)] text-[#B91C1C]'
    : 'bg-[rgba(79,195,247,0.12)] text-[#0284C7]';
}

const triggerBookingNotificationEvent = async (
  event: 'booking_confirmed',
  bookingId: string,
  accessToken: string | null
) => {
  try {
    console.info('[booking-notify] cleaner trigger start', { event, bookingId });
    const response = await fetch('/api/notifications/booking-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({ event, bookingId })
    });
    console.info('[booking-notify] cleaner trigger response', {
      event,
      bookingId,
      status: response.status,
      ok: response.ok
    });
    if (!response.ok) {
      console.error('[booking-notify] cleaner trigger failed', { event, bookingId, status: response.status });
    }
  } catch (error) {
    console.error('[booking-notify] cleaner trigger request error', { event, bookingId, error });
  }
};

export function CleanerReservationsPage() {
  const { language } = useLanguage();
  const { user, session, isCleaner } = useAuth();
  const content = contentByLanguage[language];
  const [bookings, setBookings] = useState<CleanerBooking[]>([]);
  const [clientContacts, setClientContacts] = useState<Record<string, ClientContact>>({});
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<CleanerBooking | null>(null);
  const [contactBooking, setContactBooking] = useState<CleanerBooking | null>(null);
  const [spaceDetailsByBookingId, setSpaceDetailsByBookingId] = useState<Record<string, BookingSpace>>({});
  const [confirmAction, setConfirmAction] = useState<{ booking: CleanerBooking; nextStatus: 'confirmed' | 'cancelled' } | null>(null);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [entryView, setEntryView] = useState<'pending' | 'accepted'>(() => {
    const value = new URLSearchParams(window.location.search).get('view');
    return value === 'accepted' ? 'accepted' : 'pending';
  });
  const pendingSectionRef = useRef<HTMLElement | null>(null);
  const acceptedSectionRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    const syncViewFromUrl = () => {
      const value = new URLSearchParams(window.location.search).get('view');
      setEntryView(value === 'accepted' ? 'accepted' : 'pending');
    };
    const onCustomView = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: string }>).detail;
      if (detail?.view === 'accepted' || detail?.view === 'pending') {
        setEntryView(detail.view);
      } else {
        syncViewFromUrl();
      }
    };
    window.addEventListener('popstate', syncViewFromUrl);
    window.addEventListener('cleaner-reservations-view', onCustomView as EventListener);
    return () => {
      window.removeEventListener('popstate', syncViewFromUrl);
      window.removeEventListener('cleaner-reservations-view', onCustomView as EventListener);
    };
  }, []);

  const loadBookings = async (cleanerId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('id,status,service_type,estimated_hours,scheduled_at,created_at,space_id,client_id,spaces(address,city,province,postal_code,floor,rooms,notes,name)')
      .eq('cleaner_id', cleanerId)
      .in('status', ['pending', 'confirmed', 'accepted'])
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('Cleaner reservations fetch error:', error);
      setBookings([]);
      setClientContacts({});
      setSpaceDetailsByBookingId({});
      setLoading(false);
      return;
    }

    const now = new Date();
    const rows = (data as CleanerBooking[] | null) ?? [];
    const expiredIds = await expirePendingBookingsByActor('cleaner_id', cleanerId, rows);
    const activeRows = rows.filter((row) => {
      if (!row.scheduled_at) return false;
      if (expiredIds.includes(row.id)) return false;
      const scheduled = new Date(row.scheduled_at);
      if (Number.isNaN(scheduled.getTime())) return false;
      return scheduled.getTime() >= now.getTime();
    });
    setBookings(activeRows.filter((row) => row.status === 'pending' || row.status === 'confirmed' || row.status === 'accepted'));

    const clientIds = Array.from(new Set(activeRows.map((row) => row.client_id).filter(Boolean)));
    if (clientIds.length > 0) {
      const profileRes = await supabase
        .from('profiles')
        .select('id,first_name,last_name,email,phone')
        .in('id', clientIds);
      if (!profileRes.error) {
        const contactMap = ((profileRes.data as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null }> | null) ?? []).reduce<Record<string, ClientContact>>(
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
        setClientContacts(contactMap);
      } else {
        console.error('Cleaner reservations client contact lookup error:', profileRes.error);
        setClientContacts({});
      }
    } else {
      setClientContacts({});
    }

    setSpaceDetailsByBookingId((current) => {
      const allowedIds = new Set(activeRows.map((row) => row.id));
      return Object.fromEntries(Object.entries(current).filter(([bookingId]) => allowedIds.has(bookingId)));
    });
    setLoading(false);
  };

  useEffect(() => {
    if (!user?.id || !isCleaner()) {
      setBookings([]);
      setClientContacts({});
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

  useEffect(() => {
    if (!user?.id || !isCleaner()) {
      return;
    }

    const channel = supabase
      .channel(`cleaner-reservations-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `cleaner_id=eq.${user.id}`
        },
        () => {
          void loadBookings(user.id);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isCleaner, user?.id]);

  const pending = useMemo(() => bookings.filter((booking) => booking.status === 'pending'), [bookings]);
  const accepted = useMemo(() => bookings.filter((booking) => isAcceptedStatus(booking.status)), [bookings]);

  const runAction = async (booking: CleanerBooking, nextStatus: 'confirmed' | 'cancelled') => {
    if (!user?.id) return;
    setActionBookingId(booking.id);
    const updateRes = await supabase
      .from('bookings')
      .update({ status: nextStatus })
      .eq('id', booking.id)
      .eq('cleaner_id', user.id)
      .eq('status', 'pending')
      .select('id,status')
      .maybeSingle();
    const error = updateRes.error;

    if (error) {
      console.error('Booking status update error:', error);
      setErrorMessage(content.actionError);
      setActionBookingId(null);
      return;
    }

    const updated = updateRes.data as { id: string; status: BookingStatus } | null;
    if (!updated) {
      await loadBookings(user.id);
      setActionBookingId(null);
      return;
    }

    if (nextStatus === 'confirmed') {
      await triggerBookingNotificationEvent('booking_confirmed', booking.id, session?.access_token ?? null);
    }

    setBookings((current) =>
      current
        .map((item) => (item.id === booking.id ? { ...item, status: nextStatus } : item))
        .filter((item) => item.status !== 'cancelled')
    );
    setToast(nextStatus === 'confirmed' ? content.acceptedToast : content.declinedToast);
    await loadBookings(user.id);
    setActionBookingId(null);
    if (selectedBooking?.id === booking.id) {
      setSelectedBooking((current) => (current ? { ...current, status: nextStatus } : current));
      if (nextStatus === 'cancelled') {
        setSelectedBooking(null);
      }
    }
  };

  const requestAction = (booking: CleanerBooking, nextStatus: 'confirmed' | 'cancelled') => {
    if (actionBookingId) return;
    setConfirmAction({ booking, nextStatus });
  };

  const confirmActionNow = async () => {
    if (!confirmAction) return;
    const { booking, nextStatus } = confirmAction;
    setConfirmAction(null);
    await runAction(booking, nextStatus);
  };

  if (!isCleaner()) return null;

  const canShowContact = (booking: CleanerBooking) => shouldShowBookingContact(booking.scheduled_at);
  const canShowFullAddress = (booking: CleanerBooking) => shouldShowBookingFullAddress(booking.scheduled_at);

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
        <p className="mt-2 text-xs font-semibold text-[#0284C7]">
          {content.estimatedHours}: {booking.estimated_hours ?? '--'}{booking.estimated_hours ? content.hoursSuffix : ''}
        </p>

        <p className="mt-3 rounded-xl bg-[rgba(79,195,247,0.08)] px-3 py-2 text-xs font-medium text-[#4B5563]">
          {content.privacy}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={actionBookingId === booking.id}
            onClick={() => requestAction(booking, 'cancelled')}
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
            onClick={() => requestAction(booking, 'confirmed')}
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
    const client = clientContacts[booking.client_id];
    const contactVisible = canShowContact(booking);
    return (
      <article key={booking.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_10px_24px_rgba(17,24,39,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#1A1A2E]">{formatApproxAddress(space)}</p>
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
        <p className="mt-2 text-xs font-semibold text-[#0284C7]">
          {content.estimatedHours}: {booking.estimated_hours ?? '--'}{booking.estimated_hours ? content.hoursSuffix : ''}
        </p>

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
            onClick={() => setContactBooking(booking)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
              contactVisible && client?.phone
                ? 'bg-[#A8E6CF] text-[#1A1A2E] hover:bg-[#97d9be]'
                : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
            }`}
          >
            <Phone size={12} />
            {content.contact}
          </button>
        </div>
      </article>
    );
  };

  const selectedSpace = getPrimarySpace(selectedBooking?.spaces ?? null);
  const selectedSpaceOverride = selectedBooking ? spaceDetailsByBookingId[selectedBooking.id] : null;
  const selectedSpaceDetails: BookingSpace = selectedSpaceOverride ? { ...(selectedSpace ?? {}), ...selectedSpaceOverride } : selectedSpace;
  const selectedRooms = normalizeRoomItems(selectedSpaceDetails?.rooms);
  const selectedIsPending = selectedBooking?.status === 'pending';
  const selectedClient = selectedBooking ? clientContacts[selectedBooking.client_id] : undefined;
  const selectedContactVisible = selectedBooking ? canShowContact(selectedBooking) : false;
  const selectedFullAddressVisible = selectedBooking && !selectedIsPending ? canShowFullAddress(selectedBooking) : false;
  const selectedContact = contactBooking ? clientContacts[contactBooking.client_id] : undefined;
  const selectedContactVisibleFromModal = contactBooking ? canShowContact(contactBooking) : false;

  useEffect(() => {
    const targetRef = entryView === 'accepted' ? acceptedSectionRef : pendingSectionRef;
    window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [entryView]);

  useEffect(() => {
    if (!selectedBooking || selectedIsPending || !selectedFullAddressVisible) {
      return;
    }

    const currentSpace = getPrimarySpace(selectedBooking.spaces);
    if (currentSpace?.address?.trim()) {
      return;
    }

    let active = true;
    const loadFullSpace = async () => {
      const { data, error } = await supabase
        .from('spaces')
        .select('address,city,province,postal_code,floor')
        .eq('id', selectedBooking.space_id)
        .maybeSingle();

      if (!active || error) {
        if (error) {
          console.error('Cleaner reservations space fallback fetch error:', error);
        }
        return;
      }

      const row = data as { address: string | null; city: string | null; province: string | null; postal_code: string | null; floor: string | null } | null;
      if (!row) return;

      setSpaceDetailsByBookingId((current) => ({
        ...current,
        [selectedBooking.id]: {
          ...(current[selectedBooking.id] ?? {}),
          address: row.address,
          city: row.city,
          province: row.province,
          postal_code: row.postal_code,
          floor: row.floor
        }
      }));
    };

    void loadFullSpace();
    return () => {
      active = false;
    };
  }, [selectedBooking, selectedFullAddressVisible, selectedIsPending]);

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#F7F7F7] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {toast ? <div className="fixed right-4 top-24 z-50 rounded-full bg-[#1A1A2E] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(17,24,39,0.2)]">{toast}</div> : null}
        {errorMessage ? <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[rgba(239,68,68,0.14)] px-5 py-3 text-sm font-semibold text-[#B91C1C] shadow-[0_12px_24px_rgba(17,24,39,0.12)]">{errorMessage}</div> : null}

        <section className="rounded-[28px] bg-white px-6 py-8 shadow-[0_16px_36px_rgba(17,24,39,0.07)] sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4FC3F7]">Réservations</p>
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
            <section
              ref={pendingSectionRef}
              className={`rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7 ${
                entryView === 'pending' ? 'ring-2 ring-[rgba(79,195,247,0.35)]' : ''
              }`}
            >
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

            <section
              ref={acceptedSectionRef}
              className={`rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7 ${
                entryView === 'accepted' ? 'ring-2 ring-[rgba(79,195,247,0.35)]' : ''
              }`}
            >
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
                <p className="mt-1 text-sm font-semibold text-[#0284C7]">
                  {content.estimatedHours}: {selectedBooking.estimated_hours ?? '--'}{selectedBooking.estimated_hours ? content.hoursSuffix : ''}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedBooking(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F7F7]">
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#E5E7EB] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.placeDetails}</p>
                {selectedIsPending || selectedFullAddressVisible ? (
                  <p className="mt-2 text-sm font-semibold text-[#1A1A2E]">{formatDetailedAddress(selectedSpaceDetails)}</p>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-semibold text-[#1A1A2E]">{formatApproxAddress(selectedSpaceDetails)}</p>
                    <p className="mt-2 text-sm font-semibold text-[#6B7280]">{content.addressRuleSoon}</p>
                  </>
                )}
                {selectedRooms.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    {selectedRooms.map((item) => (
                      <div key={item.key} className="flex items-center justify-between text-sm text-[#4B5563]">
                        <span>{getLocalizedRoomText(item.key, item.count, language)}</span>
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
                    onClick={() => requestAction(selectedBooking, 'cancelled')}
                    className="rounded-full border border-[#FCA5A5] px-4 py-2 text-sm font-semibold text-[#B91C1C] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-60"
                  >
                    {content.refuse}
                  </button>
                  <button
                    type="button"
                    disabled={actionBookingId === selectedBooking.id}
                    onClick={() => requestAction(selectedBooking, 'confirmed')}
                    className="inline-flex min-w-[120px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3FAAD4] disabled:opacity-60"
                  >
                    {actionBookingId === selectedBooking.id ? <Loader2 size={14} className="animate-spin" /> : content.accept}
                  </button>
                </>
              ) : (
                <>
                  {selectedContactVisible ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedClient?.phone ? (
                        <a
                          href={`tel:${selectedClient.phone}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#A8E6CF] px-4 py-2 text-sm font-semibold text-[#1A1A2E] hover:bg-[#97d9be]"
                        >
                          <Phone size={14} />
                          {selectedClient.phone}
                        </a>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-4 py-2 text-sm font-semibold text-[#475569]">
                          <Phone size={14} />
                          {content.noPhone}
                        </div>
                      )}
                      {selectedClient?.email ? (
                        <a
                          href={`mailto:${selectedClient.email}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#E0F2FE] px-4 py-2 text-sm font-semibold text-[#0C4A6E]"
                        >
                          <MessageSquare size={14} />
                          {selectedClient.email}
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-4 py-2 text-sm font-semibold text-[#475569]">
                      <MessageSquare size={14} />
                      {content.contactRuleSoon}
                    </div>
                  )}
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

      {contactBooking ? (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 px-4 py-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.28)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1A1A2E]">{content.contactModalTitle}</h3>
                <p className="mt-1 text-sm text-[#4B5563]">{formatMontrealDateTime(contactBooking.scheduled_at, language)}</p>
              </div>
              <button type="button" onClick={() => setContactBooking(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F7F7]">
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
              {selectedContactVisibleFromModal ? (
                selectedContact?.phone ? (
                  <a
                    href={`tel:${selectedContact.phone}`}
                    className="inline-flex items-center gap-2 rounded-full bg-[#A8E6CF] px-4 py-2 text-sm font-semibold text-[#1A1A2E] hover:bg-[#97d9be]"
                  >
                    <Phone size={16} />
                    {selectedContact.phone}
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#F1F5F9] px-4 py-2 text-sm font-semibold text-[#475569]">
                    <Phone size={16} />
                    {content.noPhone}
                  </div>
                )
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-[#F1F5F9] px-4 py-2 text-sm font-semibold text-[#475569]">
                  <Phone size={16} />
                  {content.contactRuleSoon}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setContactBooking(null)}
                className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] hover:bg-[#F9FAFB]"
              >
                {content.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-4 py-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.28)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1A1A2E]">{content.confirmTitle}</h3>
                <p className="mt-1 text-sm text-[#4B5563]">{content.confirmMessage}</p>
              </div>
              <button type="button" onClick={() => setConfirmAction(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F7F7]">
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-[#F8FCFF] px-4 py-3 text-sm text-[#1A1A2E]">
              <p className="font-semibold">{getServiceLabel(confirmAction.booking.service_type, language)}</p>
              <p className="mt-1 text-[#4B5563]">{formatMontrealDateTime(confirmAction.booking.scheduled_at, language)}</p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] hover:bg-[#F9FAFB]"
              >
                {content.no}
              </button>
              <button
                type="button"
                disabled={Boolean(actionBookingId)}
                onClick={() => void confirmActionNow()}
                className="inline-flex min-w-[96px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3FAAD4] disabled:opacity-60"
              >
                {actionBookingId === confirmAction.booking.id ? <Loader2 size={14} className="animate-spin" /> : content.yes}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

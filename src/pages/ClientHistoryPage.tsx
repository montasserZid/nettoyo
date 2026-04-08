import { CalendarDays, Loader2, MessageSquare, Star, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { daysSinceMontrealDate, getMontrealToday, isPastInMontreal } from '../lib/montrealDate';
import supabase from '../lib/supabase';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'accepted' | 'expired';
type BookingSpace = {
  name?: string | null;
  type?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  rooms?: unknown;
  notes?: string | null;
} | null;
type HistoryBooking = {
  id: string;
  status: BookingStatus;
  service_type: string | null;
  scheduled_at: string | null;
  created_at: string;
  cleaner_id: string | null;
  space_id: string;
  spaces?: BookingSpace | BookingSpace[] | null;
};
type ReviewRow = {
  id: string;
  booking_id: string;
  client_id: string;
  cleaner_id: string;
  confirmation_response?: 'yes' | 'no' | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

const contentByLanguage = {
  fr: {
    title: 'Historique',
    subtitle: 'Retrouvez vos nettoyages passes et laissez un avis simple pour chaque nettoyeur.',
    empty: 'Aucun nettoyage passe pour le moment.',
    details: 'Details',
    leaveReview: 'Laisser un avis',
    viewReview: 'Voir votre avis',
    serviceDate: 'Date de service',
    serviceType: 'Service',
    propertyType: 'Type de propriete',
    cleaner: 'Nettoyeur',
    addressHidden: 'Details masques apres 3 jours',
    addressVisible: 'Details visibles (fenetre de 3 jours)',
    placeDetails: 'Details du lieu',
    cleanerNote: 'Note',
    noCleanerNote: 'Aucune note',
    noDetails: 'Aucun detail supplementaire',
    close: 'Fermer',
    ratingTitle: 'Note globale',
    commentLabel: 'Commentaire (optionnel)',
    commentPlaceholder: 'Commentaire optionnel...',
    submitReview: 'Publier',
    reviewSaved: 'Avis enregistre.',
    reviewError: "Impossible d'enregistrer l'avis.",
    loading: 'Chargement de votre historique...',
    cleanerFallback: 'Nettoyeur'
  },
  en: {
    title: 'History',
    subtitle: 'Review your past cleanings and leave a simple review for each cleaner.',
    empty: 'No past cleanings yet.',
    details: 'Details',
    leaveReview: 'Leave review',
    viewReview: 'View your review',
    serviceDate: 'Service date',
    serviceType: 'Service',
    propertyType: 'Property type',
    cleaner: 'Cleaner',
    addressHidden: 'Details hidden after 3 days',
    addressVisible: 'Details visible (3-day window)',
    placeDetails: 'Place details',
    cleanerNote: 'Note',
    noCleanerNote: 'No note',
    noDetails: 'No additional details',
    close: 'Close',
    ratingTitle: 'Overall rating',
    commentLabel: 'Comment (optional)',
    commentPlaceholder: 'Optional comment...',
    submitReview: 'Submit',
    reviewSaved: 'Review saved.',
    reviewError: 'Unable to save review.',
    loading: 'Loading your history...',
    cleanerFallback: 'Cleaner'
  },
  es: {
    title: 'Historial',
    subtitle: 'Consulta limpiezas pasadas y deja una resena simple para cada limpiador.',
    empty: 'Aun no hay limpiezas pasadas.',
    details: 'Detalles',
    leaveReview: 'Dejar resena',
    viewReview: 'Ver tu resena',
    serviceDate: 'Fecha de servicio',
    serviceType: 'Servicio',
    propertyType: 'Tipo de propiedad',
    cleaner: 'Limpiador',
    addressHidden: 'Detalles ocultos despues de 3 dias',
    addressVisible: 'Detalles visibles (ventana de 3 dias)',
    placeDetails: 'Detalles del lugar',
    cleanerNote: 'Nota',
    noCleanerNote: 'Sin nota',
    noDetails: 'Sin detalles adicionales',
    close: 'Cerrar',
    ratingTitle: 'Calificacion global',
    commentLabel: 'Comentario (opcional)',
    commentPlaceholder: 'Comentario opcional...',
    submitReview: 'Publicar',
    reviewSaved: 'Resena guardada.',
    reviewError: 'No se pudo guardar la resena.',
    loading: 'Cargando historial...',
    cleanerFallback: 'Limpiador'
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

const followupLabels = {
  fr: { action: 'Le nettoyeur est-il venu ?', question: 'Le nettoyeur est-il venu ?', yes: 'Oui', no: 'Non', required: 'Veuillez choisir Oui ou Non.' },
  en: { action: 'Did the cleaner come?', question: 'Did the cleaner come?', yes: 'Yes', no: 'No', required: 'Please choose Yes or No.' },
  es: { action: 'El limpiador vino?', question: 'El limpiador vino?', yes: 'Si', no: 'No', required: 'Selecciona Si o No.' }
} as const;

function getPrimarySpace(space: HistoryBooking['spaces']): BookingSpace {
  if (!space) return null;
  return Array.isArray(space) ? (space[0] ?? null) : space;
}

function formatMontrealDate(value: string | null, language: 'fr' | 'en' | 'es') {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const locale = language === 'fr' ? 'fr-CA' : language === 'es' ? 'es-CA' : 'en-CA';
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'America/Toronto',
    dateStyle: 'medium'
  }).format(date);
}

function formatPropertyType(value: string | null | undefined, language: 'fr' | 'en' | 'es') {
  if (!value) return '--';
  return propertyTypeLabels[value as keyof typeof propertyTypeLabels]?.[language] ?? value;
}

function formatService(value: string | null, language: 'fr' | 'en' | 'es') {
  if (!value) return '--';
  return serviceLabels[value]?.[language] ?? value;
}

function formatAddress(space: BookingSpace) {
  const items = [space?.address, space?.city, space?.postal_code].filter((x) => Boolean(x && String(x).trim()));
  return items.length ? items.join(', ') : '--';
}

function canShowSensitiveDetails(bookingDate: string | null, montrealToday: string) {
  if (!bookingDate) return false;
  const days = daysSinceMontrealDate(bookingDate, montrealToday);
  if (days === null) return false;
  return days >= 0 && days <= 3;
}

export function ClientHistoryPage() {
  const { language } = useLanguage();
  const { user, isClient } = useAuth();
  const content = contentByLanguage[language];
  const followup = followupLabels[language];
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<HistoryBooking[]>([]);
  const [cleanerNames, setCleanerNames] = useState<Record<string, string>>({});
  const [reviewsByBookingId, setReviewsByBookingId] = useState<Record<string, ReviewRow>>({});
  const [selectedBooking, setSelectedBooking] = useState<HistoryBooking | null>(null);
  const [reviewBooking, setReviewBooking] = useState<HistoryBooking | null>(null);
  const [confirmationResponse, setConfirmationResponse] = useState<'yes' | 'no' | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!errorMessage) return;
    const t = window.setTimeout(() => setErrorMessage(null), 2600);
    return () => window.clearTimeout(t);
  }, [errorMessage]);

  const loadHistory = async (clientId: string) => {
    const bookingRes = await supabase
      .from('bookings')
      .select('id,status,service_type,scheduled_at,created_at,cleaner_id,space_id,spaces(name,type,address,city,postal_code,rooms,notes)')
      .eq('client_id', clientId)
      .in('status', ['completed', 'confirmed', 'accepted'])
      .order('scheduled_at', { ascending: false });

    if (bookingRes.error) {
      console.error('Client history bookings fetch error:', bookingRes.error);
      setBookings([]);
      setLoading(false);
      return;
    }

    const allRows = (bookingRes.data as HistoryBooking[] | null) ?? [];
    const montrealToday = getMontrealToday();
    const pastRows = allRows.filter((row) => row.scheduled_at && isPastInMontreal(row.scheduled_at, montrealToday));
    setBookings(pastRows);

    const cleanerIds = Array.from(new Set(pastRows.map((row) => row.cleaner_id).filter((id): id is string => Boolean(id))));
    if (cleanerIds.length > 0) {
      const profileRes = await supabase.from('profiles').select('id,first_name').in('id', cleanerIds);
      if (!profileRes.error) {
        const map = ((profileRes.data as Array<{ id: string; first_name: string | null }> | null) ?? []).reduce<Record<string, string>>((acc, item) => {
          acc[item.id] = item.first_name?.trim() || content.cleanerFallback;
          return acc;
        }, {});
        setCleanerNames(map);
      } else {
        setCleanerNames({});
      }
    } else {
      setCleanerNames({});
    }

    if (pastRows.length > 0) {
      const reviewRes = await supabase
        .from('client_cleaner_reviews')
        .select('id,booking_id,client_id,cleaner_id,confirmation_response,rating,comment,created_at')
        .in('booking_id', pastRows.map((b) => b.id))
        .eq('client_id', clientId);

      if (!reviewRes.error) {
        const map = ((reviewRes.data as ReviewRow[] | null) ?? []).reduce<Record<string, ReviewRow>>((acc, row) => {
          acc[row.booking_id] = row;
          return acc;
        }, {});
        setReviewsByBookingId(map);
      } else {
        setReviewsByBookingId({});
      }
    } else {
      setReviewsByBookingId({});
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!user?.id || !isClient()) {
      setLoading(false);
      setBookings([]);
      return;
    }
    setLoading(true);
    void loadHistory(user.id);
  }, [isClient, user?.id]);

  useEffect(() => {
    if (!reviewBooking) {
      setConfirmationResponse(null);
      return;
    }
    const existing = reviewsByBookingId[reviewBooking.id];
    if (existing) {
      setConfirmationResponse(existing.confirmation_response ?? null);
      setRating(existing.rating);
      setComment(existing.comment ?? '');
      return;
    }
    setConfirmationResponse(null);
    setRating(0);
    setComment('');
  }, [reviewBooking, reviewsByBookingId]);

  const montrealToday = useMemo(() => getMontrealToday(), []);

  const submitReview = async () => {
    if (!user?.id || !reviewBooking || !reviewBooking.cleaner_id) return;
    if (!confirmationResponse) {
      setErrorMessage(followup.required);
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMessage(content.reviewError);
      return;
    }
    setSavingReview(true);
    const { error } = await supabase
      .from('client_cleaner_reviews')
      .insert([
        {
          booking_id: reviewBooking.id,
          client_id: user.id,
          cleaner_id: reviewBooking.cleaner_id,
          confirmation_response: confirmationResponse,
          rating,
          comment: comment.trim() || null
        }
      ]);

    if (error) {
      console.error('Save client review error:', error);
      setErrorMessage(content.reviewError);
      setSavingReview(false);
      return;
    }

    setSavingReview(false);
    setReviewBooking(null);
    setConfirmationResponse(null);
    setRating(0);
    setComment('');
    setToast(content.reviewSaved);
    window.dispatchEvent(new Event('history-followup-updated'));
    await loadHistory(user.id);
  };

  if (!isClient()) return null;

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#F7F7F7] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {toast ? <div className="fixed right-4 top-24 z-50 rounded-full bg-[#1A1A2E] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(17,24,39,0.2)]">{toast}</div> : null}
        {errorMessage ? <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[rgba(239,68,68,0.14)] px-5 py-3 text-sm font-semibold text-[#B91C1C] shadow-[0_12px_24px_rgba(17,24,39,0.12)]">{errorMessage}</div> : null}

        <section className="rounded-[28px] bg-white px-6 py-8 shadow-[0_16px_36px_rgba(17,24,39,0.07)] sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4FC3F7]">Historique</p>
          <h1 className="mt-2 text-2xl font-bold text-[#1A1A2E] sm:text-3xl">{content.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">{content.subtitle}</p>
        </section>

        {loading ? (
          <section className="mt-6 rounded-[28px] bg-white p-12 text-center shadow-[0_14px_32px_rgba(17,24,39,0.06)]">
            <Loader2 className="mx-auto animate-spin text-[#4FC3F7]" size={28} />
            <p className="mt-4 text-sm font-medium text-[#6B7280]">{content.loading}</p>
          </section>
        ) : bookings.length === 0 ? (
          <section className="mt-6 rounded-[28px] bg-white p-10 text-center shadow-[0_14px_32px_rgba(17,24,39,0.06)]">
            <p className="text-sm text-[#6B7280]">{content.empty}</p>
          </section>
        ) : (
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bookings.map((booking) => {
              const space = getPrimarySpace(booking.spaces);
              const review = reviewsByBookingId[booking.id];
              const detailsVisible = canShowSensitiveDetails(booking.scheduled_at, montrealToday);
              const cleanerName = booking.cleaner_id ? (cleanerNames[booking.cleaner_id] ?? content.cleanerFallback) : content.cleanerFallback;

              return (
                <article key={booking.id} className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-[0_14px_30px_rgba(17,24,39,0.06)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1A1A2E]">{formatPropertyType(space?.type, language)}</p>
                      <p className="mt-1 text-xs font-semibold text-[#0284C7]">{formatService(booking.service_type, language)}</p>
                    </div>
                    <span className="inline-flex rounded-full bg-[rgba(168,230,207,0.28)] px-2.5 py-1 text-[11px] font-semibold text-[#1A1A2E]">
                      {content.cleaner}: {cleanerName}
                    </span>
                  </div>

                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#1A1A2E]">
                    <CalendarDays size={14} className="text-[#4FC3F7]" />
                    {formatMontrealDate(booking.scheduled_at, language)}
                  </div>

                  <p className="mt-3 text-xs text-[#6B7280]">
                    {detailsVisible ? content.addressVisible : content.addressHidden}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setSelectedBooking(booking)} className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#1A1A2E]">
                      {content.details}
                    </button>
                    {review ? (
                      <button type="button" onClick={() => setReviewBooking(booking)} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[rgba(79,195,247,0.12)] px-3 py-2 text-sm font-semibold text-[#0284C7]">
                        <MessageSquare size={14} />
                        {content.viewReview}
                      </button>
                    ) : (
                      <button type="button" onClick={() => setReviewBooking(booking)} className="inline-flex animate-pulse items-center justify-center gap-1.5 rounded-full bg-[#4FC3F7] px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(79,195,247,0.35)]">
                        <Star size={14} />
                        {followup.action}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {selectedBooking ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-4 py-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.28)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1A1A2E]">{content.details}</h3>
                <p className="mt-1 text-sm text-[#4B5563]">{formatMontrealDate(selectedBooking.scheduled_at, language)}</p>
              </div>
              <button type="button" onClick={() => setSelectedBooking(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280]">
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#E5E7EB] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.placeDetails}</p>
                {canShowSensitiveDetails(selectedBooking.scheduled_at, montrealToday) ? (
                  <p className="mt-2 text-sm font-semibold text-[#1A1A2E]">{formatAddress(getPrimarySpace(selectedBooking.spaces))}</p>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-[#6B7280]">{content.addressHidden}</p>
                )}
                <p className="mt-3 text-sm text-[#4B5563]">{formatPropertyType(getPrimarySpace(selectedBooking.spaces)?.type, language)}</p>
              </div>
              <div className="rounded-2xl border border-[#E5E7EB] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.cleanerNote}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">{getPrimarySpace(selectedBooking.spaces)?.notes?.trim() || content.noCleanerNote}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setSelectedBooking(null)} className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280]">
                {content.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewBooking ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-4 py-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.28)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1A1A2E]">{reviewsByBookingId[reviewBooking.id] ? content.viewReview : content.leaveReview}</h3>
                <p className="mt-1 text-sm text-[#4B5563]">{formatMontrealDate(reviewBooking.scheduled_at, language)}</p>
              </div>
              <button type="button" onClick={() => setReviewBooking(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280]">
                <X size={16} />
              </button>
            </div>

            {reviewsByBookingId[reviewBooking.id] ? (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A2E]">{followup.question}</p>
                  <p className="mt-2 text-sm text-[#4B5563]">
                    {reviewsByBookingId[reviewBooking.id].confirmation_response === 'yes' ? followup.yes : followup.no}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A2E]">{content.ratingTitle}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star key={idx} size={18} className={idx < reviewsByBookingId[reviewBooking.id].rating ? 'fill-[#FDB022] text-[#FDB022]' : 'text-[#D1D5DB]'} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A2E]">{content.commentLabel}</p>
                  <p className="mt-2 text-sm text-[#4B5563]">{reviewsByBookingId[reviewBooking.id].comment || content.noDetails}</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A2E]">{followup.question}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmationResponse('yes')}
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                        confirmationResponse === 'yes'
                          ? 'bg-[rgba(168,230,207,0.45)] text-[#1A1A2E]'
                          : 'border border-[#E5E7EB] text-[#4B5563]'
                      }`}
                    >
                      {followup.yes}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmationResponse('no')}
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                        confirmationResponse === 'no'
                          ? 'bg-[rgba(251,191,36,0.26)] text-[#1A1A2E]'
                          : 'border border-[#E5E7EB] text-[#4B5563]'
                      }`}
                    >
                      {followup.no}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A2E]">{content.ratingTitle}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <button key={idx} type="button" onClick={() => setRating(idx + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(251,191,36,0.12)]">
                        <Star size={18} className={idx < rating ? 'fill-[#FDB022] text-[#FDB022]' : 'text-[#D1D5DB]'} />
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="text-sm font-semibold text-[#1A1A2E]">{content.commentLabel}</span>
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm text-[#1A1A2E] outline-none focus:border-[#4FC3F7]" placeholder={content.commentPlaceholder} />
                </label>
                <div className="flex justify-end">
                  <button type="button" disabled={savingReview} onClick={() => void submitReview()} className="inline-flex min-w-[120px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {savingReview ? <Loader2 size={14} className="animate-spin" /> : content.submitReview}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}


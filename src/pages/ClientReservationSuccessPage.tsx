import { CheckCircle2, Home, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getPathForRoute } from '../i18n/routes';
import supabase from '../lib/supabase';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'accepted' | 'expired';
type BookingSummary = {
  id: string;
  status: BookingStatus;
};

const labels = {
  fr: {
    title: 'Réservation envoyée',
    subtitle:
      'Votre demande a bien été envoyée. Elle est actuellement en attente de confirmation par le nettoyeur. Vous recevrez un e-mail une fois la demande confirmée.',
    status: 'Statut',
    statusPending: 'En attente',
    statusConfirmed: 'Confirmée',
    statusCompleted: 'Terminée',
    statusCancelled: 'Annulée',
    reference: 'Référence',
    waiting: 'Le nettoyeur doit encore accepter votre demande.',
    backHome: "Retour à l'accueil"
  },
  en: {
    title: 'Booking request sent',
    subtitle:
      'Your request was sent successfully. It is currently pending cleaner confirmation. You will receive an email once the request is confirmed.',
    status: 'Status',
    statusPending: 'Pending',
    statusConfirmed: 'Confirmed',
    statusCompleted: 'Completed',
    statusCancelled: 'Cancelled',
    reference: 'Reference',
    waiting: 'The cleaner still needs to accept your request.',
    backHome: 'Back to home'
  },
  es: {
    title: 'Reserva enviada',
    subtitle:
      'Tu solicitud se envio correctamente. Actualmente esta pendiente de confirmacion del limpiador. Recibiras un email cuando se confirme.',
    status: 'Estado',
    statusPending: 'Pendiente',
    statusConfirmed: 'Confirmada',
    statusCompleted: 'Completada',
    statusCancelled: 'Cancelada',
    reference: 'Referencia',
    waiting: 'El limpiador todavia debe aceptar tu solicitud.',
    backHome: 'Volver al inicio'
  }
} as const;

function toBookingReference(bookingId: string | null) {
  if (!bookingId) return 'BK-NA';
  const compact = bookingId.replace(/-/g, '').toUpperCase();
  const shortRef = compact.slice(0, 6);
  return shortRef ? `BK-${shortRef}` : 'BK-NA';
}

export function ClientReservationSuccessPage() {
  const { language, navigateTo } = useLanguage();
  const { user, isClient } = useAuth();
  const content = labels[language];
  const homePath = getPathForRoute(language, 'home');
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const bookingId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('booking');
  }, []);

  useEffect(() => {
    if (!user?.id || !isClient()) {
      setLoading(false);
      return;
    }

    if (!bookingId) {
      setLoading(false);
      return;
    }

    let active = true;
    const loadBooking = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id,status')
        .eq('id', bookingId)
        .eq('client_id', user.id)
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        if (error) {
          console.error('Success page booking lookup error:', error);
        }
        setBooking(null);
        setLoading(false);
        return;
      }

      setBooking(data as BookingSummary);
      setLoading(false);
    };

    void loadBooking();
    return () => {
      active = false;
    };
  }, [bookingId, isClient, user?.id]);

  const effectiveStatus = booking?.status ?? 'pending';
  const statusLabel =
    effectiveStatus === 'confirmed' || effectiveStatus === 'accepted'
      ? content.statusConfirmed
      : effectiveStatus === 'completed'
        ? content.statusCompleted
        : effectiveStatus === 'cancelled'
          ? content.statusCancelled
          : content.statusPending;
  const statusTone =
    effectiveStatus === 'confirmed' || effectiveStatus === 'accepted'
      ? 'bg-[rgba(168,230,207,0.35)] text-[#065F46]'
      : effectiveStatus === 'cancelled'
        ? 'bg-[rgba(239,68,68,0.12)] text-[#B91C1C]'
        : 'bg-[rgba(79,195,247,0.16)] text-[#0284C7]';
  const bookingReference = toBookingReference(booking?.id ?? bookingId);

  if (!isClient()) return null;

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#F7F7F7] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-[28px] bg-white px-6 py-8 shadow-[0_16px_36px_rgba(17,24,39,0.07)] sm:px-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(168,230,207,0.35)] text-[#059669] shadow-[0_14px_30px_rgba(16,185,129,0.22)]">
              <CheckCircle2 size={42} />
            </div>
            <h1 className="mt-5 text-3xl font-bold text-[#1A1A2E]">{content.title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#4B5563]">{content.subtitle}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#0284C7]">{content.waiting}</p>

            <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#E5E7EB] px-4 py-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.status}</p>
                <div className="mt-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusTone}`}>{statusLabel}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] px-4 py-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{content.reference}</p>
                <p className="mt-2 text-base font-bold tracking-[0.08em] text-[#1A1A2E]">{bookingReference}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#4FC3F7] px-6 py-3 font-semibold text-white shadow-[0_14px_28px_rgba(79,195,247,0.24)] transition-colors hover:bg-[#3FAAD4]"
            >
              <Home size={16} />
              {content.backHome}
            </button>
            <a href={homePath} className="sr-only">
              {content.backHome}
            </a>
          </div>
        </section>

        {loading ? (
          <section className="mt-4 rounded-[22px] bg-white px-5 py-4 text-center shadow-[0_12px_24px_rgba(17,24,39,0.05)]">
            <Loader2 className="mx-auto animate-spin text-[#4FC3F7]" size={20} />
          </section>
        ) : null}
      </div>
    </div>
  );
}


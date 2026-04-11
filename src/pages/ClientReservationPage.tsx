import { ArrowUpDown, Calendar, CheckCircle2, Clock3, Home, Loader2, MapPin, Search, Sparkles, User, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PaginationControls } from '../components/PaginationControls';
import { TimePickerField } from '../components/TimePickerField';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useLanguage } from '../i18n/LanguageContext';
import { getPathForRoute } from '../i18n/routes';
import {
  combineMontrealDateTimeToUtc,
  getMinimumSameDayBookingTime,
  getMontrealToday,
  hasMinimumLeadHoursFromMontrealDateTime,
  isDateTodayInMontreal
} from '../lib/montrealDate';
import { deriveZoneFromCityName } from '../lib/zoneMapping';
import supabase from '../lib/supabase';

type ServiceId = 'domicile' | 'deep_cleaning' | 'office' | 'moving' | 'post_renovation' | 'airbnb';
type SpaceRecord = { id: string; name: string; address: string | null; city: string | null; derived_zone: string | null; is_favorite: boolean; is_active: boolean };
type CleanerProfileRecord = { id: string; description: string | null; hourly_rate: number | null; services: string[] | null; photo_url: string | null; service_areas: unknown; weekly_availability: unknown; availability_exceptions: unknown };
type CleanerReviewRecord = { cleaner_id: string; rating: number | null };
type CleanerCompletedBookingRecord = { cleaner_id: string | null };
type RecentClientBookingRecord = {
  cleaner_id: string | null;
  service_type: string | null;
  status: 'completed' | 'confirmed' | string;
  scheduled_at: string | null;
  created_at: string;
};
type AreaSelection = { id: string; zone: string; name: string; lat: number; lng: number };
type CleanerIdentity = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };
type CleanerCandidate = {
  id: string;
  displayName: string;
  description: string;
  photoUrl: string | null;
  hourlyRate: number | null;
  services: ServiceId[];
  serviceAreas: AreaSelection[];
  availability: unknown;
  exceptions: unknown;
  completedJobs: number;
  averageRating: number | null;
  ratingCount: number;
};
type BookingInsertResult = { id: string; status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'accepted' | 'expired' };
type SortOption = 'price_asc' | 'price_desc' | 'jobs_desc' | 'rating_desc';

type ServiceFailure = { cleanerId: string; cleanerServices: ServiceId[]; selectedServices: ServiceId[] };
type ZoneFailure = { cleanerId: string; selectedZone: string; selectedZoneNormalized: string; cleanerAreas: { zone: string; name: string }[] };
type AvailabilityFailure = { cleanerId: string; selectedDate: string; selectedTime: string; weekday: string | null; dayAvailability: { enabled: boolean; start: string; end: string } | null; reason: 'invalid_datetime' | 'day_disabled' | 'time_out_of_range' };
type MatchingPipeline = { raw: CleanerCandidate[]; afterService: CleanerCandidate[]; afterZone: CleanerCandidate[]; afterAvailability: CleanerCandidate[]; serviceFailures: ServiceFailure[]; zoneFailures: ZoneFailure[]; availabilityFailures: AvailabilityFailure[] };

const DEBUG_RESERVATION_MATCHING = true;
const services: ServiceId[] = ['domicile', 'deep_cleaning', 'office', 'moving', 'post_renovation', 'airbnb'];
const estimatedHourOptions = [2, 3, 4, 5, 6, 8, 10];

const labels = {
  fr: {
    title: 'Reserver', subtitle: 'Choisissez adresse, service, date et heure avant les resultats.',
    step1: 'Adresse', step2: 'Service', step3: 'Horaire', step4: 'Nettoyeurs',
    dateLabel: 'Date', timeLabel: 'Heure', dateRequired: 'Veuillez choisir une date.', dateInvalid: 'Date invalide.',
    addSpace: 'Ajouter un espace', noSpace: 'Ajoutez un espace pour commencer.',
    details: 'Details', reserve: 'Reserver', selected: 'Selectionne', noResult: 'Aucun nettoyeur compatible.',
    hint: 'Completez les etapes 1 a 3 pour voir les nettoyeurs disponibles.',
    missingIntro: 'Pour afficher les nettoyeurs, completez :',
    missingAddress: 'adresse',
    missingService: 'type de nettoyage',
    missingDate: 'date',
    missingDateInvalid: 'date valide',
    missingTime: 'heure',
    missingTimeInvalid: 'heure valide',
    missingLeadTime: "heure (minimum 2h d'avance aujourd'hui)",
    sortBy: 'Trier par',
    sortPriceAsc: 'Lowest price first',
    sortPriceDesc: 'Highest price first',
    sortJobsDesc: 'Plus de nettoyages',
    sortRatingDesc: 'Best rated',
    descriptionTitle: 'Description',
    descriptionEmpty: 'Aucune description disponible.',
    seeMore: 'Voir plus',
    fullDescriptionTitle: 'Description complete',
    trust: 'Nouveau sur Nettoyo', zoneMatch: 'Zone compatible', avail: 'Disponible',
    cleanerNameFallback: 'Nettoyeur Nettoyo',
    cleanerDescriptionFallback: 'Nettoyeur professionnel disponible localement.',
    close: 'Fermer',
    reserveSuccess: 'Reservation creee.', reserveError: 'Impossible de reserver pour le moment.', loading: 'Chargement...',
    timeRequired: 'Veuillez choisir une heure.', timeInvalid: 'Format d heure invalide.',
    sameDayLeadError: "Pour aujourd'hui, choisissez une heure au moins 2h plus tard (heure de Montreal).",
    hourlyRate: 'Taux horaire', bookingFlowTitle: 'Estimation du menage', bookingStep1Title: 'Combien d heures pensez-vous que le menage prendra ?', bookingStep1Hint: 'Estimations a titre indicatif',
    bookingGuideSmall: 'Petit appartement / condo (1-2 chambres): 2-3 heures', bookingGuideMedium: 'Maison moyenne (3-4 chambres): 4-6 heures', bookingGuideLarge: 'Grande maison / menage en profondeur: 6-10+ heures', bookingGuideMove: 'Menage de demenagement: 7-10+ heures',
    bookingAdjustDisclaimer: 'Cette estimation n est pas finale. Vous pourrez ajuster avec le nettoyeur selon le travail reel.', bookingHoursLabel: 'Heures estimees',
    bookingSummaryTitle: 'Resume de la reservation', bookingSummaryAddress: 'Adresse', bookingSummaryRate: 'Taux horaire', bookingSummaryHours: 'Heures estimees', bookingSummaryDate: 'Date', bookingSummaryTime: 'Heure',
    bookingApproxTotal: 'Total approximatif', paymentDisclaimer1: 'Le paiement se fait directement avec le nettoyeur (cash ou Interac).', paymentDisclaimer2: 'Le montant affiche est approximatif et peut varier selon le travail reel.',
    bookingUnavailable: 'Ce nettoyeur n est pas disponible a cette date/heure. Essayez un autre jour ou horaire.',
    back: 'Retour', continue: 'Continuer', finish: 'Confirmer la reservation',
    rebookTitlePrefix: 'Reserver a nouveau avec',
    rebookTitleSuffix: '?',
    rebookSubtitle: 'Gagnez du temps en reservant avec un nettoyeur deja utilise.',
    rebookCta: 'Reserver',
    rebookLater: 'Plus tard'
  },
  en: {
    title: 'Book', subtitle: 'Choose address, service, date and time before results.',
    step1: 'Address', step2: 'Service', step3: 'Schedule', step4: 'Cleaners',
    dateLabel: 'Date', timeLabel: 'Time', dateRequired: 'Please choose a date.', dateInvalid: 'Invalid date.',
    addSpace: 'Add a space', noSpace: 'Add a space to get started.',
    details: 'Details', reserve: 'Book now', selected: 'Selected', noResult: 'No matching cleaner yet.',
    hint: 'Complete steps 1–3 to see available cleaners.',
    missingIntro: 'To see cleaners, complete:',
    missingAddress: 'address',
    missingService: 'cleaning type',
    missingDate: 'date',
    missingDateInvalid: 'valid date',
    missingTime: 'time',
    missingTimeInvalid: 'valid time',
    missingLeadTime: 'time (at least 2h ahead for today)',
    sortBy: 'Sort by',
    sortPriceAsc: 'Menor precio primero',
    sortPriceDesc: 'Mayor precio primero',
    sortJobsDesc: 'Most jobs done',
    sortRatingDesc: 'Mejor valorados',
    descriptionTitle: 'Description',
    descriptionEmpty: 'No description available.',
    seeMore: 'See more',
    fullDescriptionTitle: 'Full description',
    trust: 'New on Nettoyo', zoneMatch: 'Zone match', avail: 'Available',
    cleanerNameFallback: 'Nettoyo cleaner',
    cleanerDescriptionFallback: 'Professional cleaner available locally.',
    close: 'Close',
    reserveSuccess: 'Booking created.', reserveError: 'Unable to book right now.', loading: 'Loading...',
    timeRequired: 'Please choose a time.', timeInvalid: 'Invalid time format.',
    sameDayLeadError: 'For same-day bookings, choose a time at least 2 hours later (Montreal time).',
    hourlyRate: 'Hourly rate', bookingFlowTitle: 'Cleaning estimate', bookingStep1Title: 'How many hours do you think the cleaning will take?', bookingStep1Hint: 'Guidance only',
    bookingGuideSmall: 'Small apartment / condo (1-2 bed): 2-3 hours', bookingGuideMedium: 'Average home (3-4 bed): 4-6 hours', bookingGuideLarge: 'Large home / deep clean: 6-10+ hours', bookingGuideMove: 'Move-in / move-out clean: 7-10+ hours',
    bookingAdjustDisclaimer: 'This estimate is not final. You can adjust with the cleaner based on actual work.', bookingHoursLabel: 'Estimated hours',
    bookingSummaryTitle: 'Booking summary', bookingSummaryAddress: 'Address', bookingSummaryRate: 'Hourly rate', bookingSummaryHours: 'Estimated hours', bookingSummaryDate: 'Date', bookingSummaryTime: 'Time',
    bookingApproxTotal: 'Approximate total', paymentDisclaimer1: 'Payment is made directly to the cleaner (cash or Interac).', paymentDisclaimer2: 'Displayed amount is approximate and may vary based on actual work.',
    bookingUnavailable: 'This cleaner is not available at that date/time. Please try another day or time.',
    back: 'Back', continue: 'Continue', finish: 'Confirm booking',
    rebookTitlePrefix: 'Book again with',
    rebookTitleSuffix: '?',
    rebookSubtitle: 'Save time by booking a cleaner you already used.',
    rebookCta: 'Book',
    rebookLater: 'Later'
  },
  es: {
    title: 'Reservar', subtitle: 'Elige direccion, servicio, fecha y hora antes de ver resultados.',
    step1: 'Direccion', step2: 'Servicio', step3: 'Horario', step4: 'Limpiadores',
    dateLabel: 'Fecha', timeLabel: 'Hora', dateRequired: 'Selecciona una fecha.', dateInvalid: 'Fecha invalida.',
    addSpace: 'Agregar espacio', noSpace: 'Agrega un espacio para comenzar.',
    details: 'Detalles', reserve: 'Reservar', selected: 'Seleccionado', noResult: 'Aun no hay limpiadores compatibles.',
    hint: 'Completa los pasos 1 a 3 para ver los limpiadores disponibles.',
    missingIntro: 'Para ver limpiadores, completa:',
    missingAddress: 'direccion',
    missingService: 'tipo de limpieza',
    missingDate: 'fecha',
    missingDateInvalid: 'fecha valida',
    missingTime: 'hora',
    missingTimeInvalid: 'hora valida',
    missingLeadTime: 'hora (minimo 2h de anticipacion hoy)',
    sortBy: 'Ordenar por',
    sortPriceAsc: 'Moins cher d\u2019abord',
    sortPriceDesc: 'Plus cher d\u2019abord',
    sortJobsDesc: 'Mas trabajos realizados',
    sortRatingDesc: 'Mieux not\u00e9s',
    descriptionTitle: 'Descripcion',
    descriptionEmpty: 'Sin descripcion disponible.',
    seeMore: 'Ver mas',
    fullDescriptionTitle: 'Descripcion completa',
    trust: 'Nuevo en Nettoyo', zoneMatch: 'Zona compatible', avail: 'Disponible',
    cleanerNameFallback: 'Limpiador de Nettoyo',
    cleanerDescriptionFallback: 'Limpiador profesional disponible en tu zona.',
    close: 'Cerrar',
    reserveSuccess: 'Reserva creada.', reserveError: 'No se pudo reservar.', loading: 'Cargando...',
    timeRequired: 'Selecciona una hora.', timeInvalid: 'Formato de hora invalido.',
    sameDayLeadError: 'Para reservas del mismo dia, elige una hora al menos 2h mas tarde (hora de Montreal).',
    hourlyRate: 'Tarifa por hora', bookingFlowTitle: 'Estimacion de limpieza', bookingStep1Title: 'Cuantas horas crees que tomara la limpieza?', bookingStep1Hint: 'Estimaciones orientativas',
    bookingGuideSmall: 'Apartamento pequeno / condo (1-2 hab): 2-3 horas', bookingGuideMedium: 'Casa media (3-4 hab): 4-6 horas', bookingGuideLarge: 'Casa grande / limpieza profunda: 6-10+ horas', bookingGuideMove: 'Limpieza de mudanza: 7-10+ horas',
    bookingAdjustDisclaimer: 'Esta estimacion no es final. Podras ajustarla con el limpiador segun el trabajo real.', bookingHoursLabel: 'Horas estimadas',
    bookingSummaryTitle: 'Resumen de reserva', bookingSummaryAddress: 'Direccion', bookingSummaryRate: 'Tarifa por hora', bookingSummaryHours: 'Horas estimadas', bookingSummaryDate: 'Fecha', bookingSummaryTime: 'Hora',
    bookingApproxTotal: 'Total aproximado', paymentDisclaimer1: 'El pago se realiza directamente con el limpiador (efectivo o Interac).', paymentDisclaimer2: 'El monto mostrado es aproximado y puede variar segun el trabajo real.',
    bookingUnavailable: 'Este limpiador no esta disponible en esa fecha/hora. Prueba otro dia u horario.',
    back: 'Atras', continue: 'Continuar', finish: 'Confirmar reserva',
    rebookTitlePrefix: 'Reservar de nuevo con',
    rebookTitleSuffix: '?',
    rebookSubtitle: 'Ahorra tiempo reservando con un limpiador que ya usaste.',
    rebookCta: 'Reservar',
    rebookLater: 'Mas tarde'
  }
} as const;

const serviceLabels: Record<ServiceId, { fr: string; en: string; es: string }> = {
  domicile: { fr: 'Domicile', en: 'Home', es: 'Domicilio' },
  deep_cleaning: { fr: 'Profondeur', en: 'Deep cleaning', es: 'Profunda' },
  office: { fr: 'Bureau', en: 'Office', es: 'Oficina' },
  moving: { fr: 'Demenagement', en: 'Moving', es: 'Mudanza' },
  post_renovation: { fr: 'Post-renovation', en: 'Post-reno', es: 'Post-reno' },
  airbnb: { fr: 'Airbnb', en: 'Airbnb', es: 'Airbnb' }
};

const parseAreas = (value: unknown): AreaSelection[] =>
  Array.isArray(value)
    ? value.filter((v): v is AreaSelection =>
        Boolean(v && typeof v === 'object' && typeof (v as AreaSelection).zone === 'string' && typeof (v as AreaSelection).name === 'string')
      )
    : [];

const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const normalizeMatch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const serviceAliasMap: Record<string, ServiceId> = {
  domicile: 'domicile', home: 'domicile', domicilio: 'domicile',
  'deep cleaning': 'deep_cleaning', deep_cleaning: 'deep_cleaning', profondeur: 'deep_cleaning', profunda: 'deep_cleaning',
  office: 'office', bureau: 'office', oficina: 'office',
  moving: 'moving', demenagement: 'moving', mudanza: 'moving',
  post_renovation: 'post_renovation', 'post renovation': 'post_renovation',
  airbnb: 'airbnb'
};
const normalizeServiceId = (value: string): ServiceId | null => serviceAliasMap[normalizeMatch(value)] ?? null;
const parseServiceType = (value: string | null): ServiceId[] => {
  if (!value) return [];
  const seen = new Set<ServiceId>();
  return value
    .split(',')
    .map((entry) => normalizeServiceId(entry))
    .filter((entry): entry is ServiceId => Boolean(entry))
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
};
const toMinutes = (v: string) => {
  const m = v.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  const rawHour = Number(m[1]); const minute = Number(m[2]); const second = m[3] ? Number(m[3]) : 0;
  const meridiem = m[4]?.toUpperCase() as 'AM' | 'PM' | undefined;
  if (Number.isNaN(rawHour) || Number.isNaN(minute) || Number.isNaN(second) || minute > 59 || second > 59) return null;
  if (meridiem) {
    if (rawHour < 1 || rawHour > 12) return null;
    const hour24 = meridiem === 'PM' ? (rawHour % 12) + 12 : rawHour % 12;
    return hour24 * 60 + minute;
  }
  if (rawHour < 0 || rawHour > 23) return null;
  return rawHour * 60 + minute;
};
const isWithin = (t: string, s: string, e: string) => {
  const tt = toMinutes(t); const ss = toMinutes(s); const ee = toMinutes(e);
  if (tt === null || ss === null || ee === null) return true;
  if (ee < ss) return tt >= ss || tt <= ee;
  return tt >= ss && tt <= ee;
};
const formatHourlyRate = (rate: number | null) =>
  typeof rate === 'number' && Number.isFinite(rate) ? `${rate}$/h` : '--';
const triggerBookingCreatedNotification = async (bookingId: string, accessToken: string | null) => {
  try {
    console.info('[booking-notify] trigger start', { bookingId });
    const response = await fetch('/api/notifications/booking-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({ event: 'booking_created', bookingId })
    });
    console.info('[booking-notify] trigger response', { bookingId, status: response.status, ok: response.ok });
    if (!response.ok) console.error('Booking-created notification failed:', response.status, response.statusText);
  } catch (error) {
    console.error('Booking-created notification request error:', error);
  }
};

// Step progress indicator
function StepProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, idx) => {
        const num = idx + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  done
                    ? 'bg-[#A8E6CF] text-[#065F46]'
                    : active
                    ? 'bg-[#4FC3F7] text-white shadow-[0_0_0_3px_rgba(79,195,247,0.2)]'
                    : 'bg-[#F0F4F8] text-[#9CA3AF]'
                }`}
              >
                {done ? <CheckCircle2 size={14} /> : num}
              </div>
              <span
                className={`hidden text-[10px] font-semibold tracking-wide sm:block ${
                  active ? 'text-[#0284C7]' : done ? 'text-[#065F46]' : 'text-[#9CA3AF]'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`mb-4 h-[2px] w-8 sm:w-12 ${done ? 'bg-[#A8E6CF]' : 'bg-[#E5E7EB]'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function reservationPageStyles() {
  return (
    <style>{`
      @keyframes reservation-missing-soft-pulse {
        0% { box-shadow: 0 0 0 0 rgba(79,195,247,0.18); border-color: #D1E7F7; }
        50% { box-shadow: 0 0 0 6px rgba(79,195,247,0.08); border-color: #9EDAF5; }
        100% { box-shadow: 0 0 0 0 rgba(79,195,247,0.18); border-color: #D1E7F7; }
      }
    `}</style>
  );
}

// Cleaner card
function CleanerCard({
  cleaner,
  language,
  t,
  onDetails,
  onBook,
  reservingId
}: {
  cleaner: CleanerCandidate;
  language: 'fr' | 'en' | 'es';
  t: typeof labels['fr'];
  onDetails: () => void;
  onBook: () => void;
  reservingId: string | null;
}) {
  const isReserving = reservingId === cleaner.id;
  const visibleServices = cleaner.services.slice(0, 3);

  return (
    <article className="group flex flex-col rounded-3xl border border-[#EEF2F7] bg-white shadow-[0_4px_24px_rgba(17,24,39,0.06)] transition-shadow hover:shadow-[0_8px_32px_rgba(17,24,39,0.1)]">
      {/* Card body */}
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        {/* Top row: avatar + identity + rate */}
        <div className="flex items-start gap-3.5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {cleaner.photoUrl ? (
              <img
                src={cleaner.photoUrl}
                alt={cleaner.displayName}
                className="h-14 w-14 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[rgba(79,195,247,0.2)] to-[rgba(168,230,207,0.2)] text-[#4FC3F7]">
                <User size={22} />
              </div>
            )}
            {/* Online dot */}
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#4ADE80]" />
          </div>

          {/* Name + rate */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-base font-bold text-[#1A1A2E]">{cleaner.displayName}</p>
              <span className="flex-shrink-0 rounded-xl bg-[rgba(79,195,247,0.12)] px-2.5 py-1 text-sm font-bold text-[#0284C7]">
                {formatHourlyRate(cleaner.hourlyRate)}
              </span>
            </div>
          </div>
        </div>

        {/* Service tags */}
        {visibleServices.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleServices.map((s) => (
              <span
                key={`${cleaner.id}-${s}`}
                className="rounded-lg bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]"
              >
                {serviceLabels[s][language]}
              </span>
            ))}
            {cleaner.services.length > 3 && (
              <span className="text-[11px] text-[#9CA3AF]">+{cleaner.services.length - 3}</span>
            )}
          </div>
        )}

        {/* Trust signals */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[rgba(168,230,207,0.3)] px-2.5 py-1 text-[11px] font-semibold text-[#065F46]">
            <MapPin size={10} />
            {t.zoneMatch}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-[rgba(79,195,247,0.12)] px-2.5 py-1 text-[11px] font-semibold text-[#0284C7]">
            <Clock3 size={10} />
            {t.avail}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium text-[#9CA3AF]">
            <Sparkles size={10} />
            {t.trust}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-[#F0F4F8] sm:mx-6" />

      {/* Actions footer */}
      <div className="flex items-center gap-2.5 p-4 sm:p-5">
        {/* Details: ghost, secondary */}
        <button
          type="button"
          onClick={onDetails}
          className="flex-1 rounded-2xl border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#4B5563] transition-colors hover:border-[#4FC3F7] hover:text-[#0284C7]"
        >
          {t.details}
        </button>

        {/* Book: solid, primary */}
        <button
          type="button"
          onClick={onBook}
          disabled={isReserving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#4FC3F7] px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.35)] transition-all hover:bg-[#38B2E8] hover:shadow-[0_6px_16px_rgba(79,195,247,0.4)] disabled:opacity-60"
        >
          {isReserving ? <Loader2 size={14} className="animate-spin" /> : t.reserve}
        </button>
      </div>
    </article>
  );
}

// Main component
export function ClientReservationPage() {
  const CLEANERS_PER_PAGE = 6;
  const { language, navigateTo } = useLanguage();
  const { user, session, isClient, loading: authLoading } = useAuth();
  const t = labels[language];
  const addSpacePath = getPathForRoute(language, 'clientAddSpace');
  const successPath = getPathForRoute(language, 'clientReservationSuccess');

  const [spaces, setSpaces] = useState<SpaceRecord[]>([]);
  const [cleaners, setCleaners] = useState<CleanerCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedServices, setSelectedServices] = useState<ServiceId[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [modalCleaner, setModalCleaner] = useState<CleanerCandidate | null>(null);
  const [fullDescriptionOpen, setFullDescriptionOpen] = useState(false);
  const [bookingCleaner, setBookingCleaner] = useState<CleanerCandidate | null>(null);
  const [bookingStep, setBookingStep] = useState<1 | 2>(1);
  const [estimatedHours, setEstimatedHours] = useState<number>(3);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('price_asc');
  const [cleanersPage, setCleanersPage] = useState(1);
  const [rebookSuggestion, setRebookSuggestion] = useState<{ cleanerId: string; services: ServiceId[] } | null>(null);
  const [rebookDismissed, setRebookDismissed] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  useBodyScrollLock(Boolean(modalCleaner || bookingCleaner || fullDescriptionOpen));
  const paginationLabels = useMemo(
    () =>
      language === 'fr'
        ? { previous: 'Precedent', next: 'Suivant', page: 'Page' }
        : language === 'es'
          ? { previous: 'Anterior', next: 'Siguiente', page: 'Pagina' }
          : { previous: 'Previous', next: 'Next', page: 'Page' },
    [language]
  );
  const minBookDate = useMemo(() => getMontrealToday(), []);
  const rebookDismissKey = useMemo(
    () => (user?.id && rebookSuggestion ? `nettoyo:rebook-dismissed:${user.id}:${rebookSuggestion.cleanerId}` : null),
    [rebookSuggestion, user?.id]
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id || !isClient()) { setLoading(false); setRebookSuggestion(null); setRebookDismissed(false); return; }
    let active = true;
    const load = async () => {
      setLoading(true);
      const [spacesRes, cleanersRes, recentBookingsRes] = await Promise.all([
        supabase.from('spaces').select('id,name,address,city,derived_zone,is_favorite,is_active').eq('client_id', user.id).eq('is_active', true).order('is_favorite', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('cleaner_profiles').select('id,description,hourly_rate,services,photo_url,service_areas,weekly_availability,availability_exceptions'),
        supabase
          .from('bookings')
          .select('cleaner_id,service_type,status,scheduled_at,created_at')
          .eq('client_id', user.id)
          .in('status', ['completed', 'confirmed'])
          .order('scheduled_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(30)
      ]);
      if (!active) return;
      if (spacesRes.error) { setErrorMessage(spacesRes.error.message); setLoading(false); return; }
      const nextSpaces = (spacesRes.data as SpaceRecord[] | null) ?? [];
      setSpaces(nextSpaces);
      if (nextSpaces[0]) setSelectedSpaceId((v) => v || nextSpaces[0].id);

      if (cleanersRes.error) { setCleaners([]); setLoading(false); return; }
      const rows = (cleanersRes.data as CleanerProfileRecord[] | null) ?? [];
      const ids = rows.map((r) => r.id);
      const [profileRes, reviewRes, completedBookingsRes] = ids.length > 0
        ? await Promise.all([
            supabase.from('profiles').select('id,first_name,last_name,avatar_url').in('id', ids).eq('role', 'nettoyeur'),
            supabase.from('cleaner_client_reviews').select('cleaner_id,rating').in('cleaner_id', ids),
            supabase.from('bookings').select('cleaner_id').in('cleaner_id', ids).eq('status', 'completed')
          ])
        : [
            { data: null, error: null },
            { data: null, error: null },
            { data: null, error: null }
          ];
      const idMap = new Map<string, CleanerIdentity>(
        ((profileRes.data as CleanerIdentity[] | null) ?? []).map((p) => [p.id, p])
      );
      const ratingsMap = new Map<string, { sum: number; count: number }>();
      ((reviewRes.data as CleanerReviewRecord[] | null) ?? []).forEach((row) => {
        if (!row.cleaner_id || typeof row.rating !== 'number' || !Number.isFinite(row.rating)) {
          return;
        }
        const current = ratingsMap.get(row.cleaner_id) ?? { sum: 0, count: 0 };
        ratingsMap.set(row.cleaner_id, { sum: current.sum + row.rating, count: current.count + 1 });
      });
      const completedJobsMap = new Map<string, number>();
      ((completedBookingsRes.data as CleanerCompletedBookingRecord[] | null) ?? []).forEach((row) => {
        if (!row.cleaner_id) {
          return;
        }
        completedJobsMap.set(row.cleaner_id, (completedJobsMap.get(row.cleaner_id) ?? 0) + 1);
      });
      const mappedCleaners = rows.map((row) => {
        const identity = idMap.get(row.id);
        const first = identity?.first_name?.trim();
        const initial = identity?.last_name?.trim()?.[0]?.toUpperCase();
        const name = first ? `${first}${initial ? ` ${initial}.` : ''}` : t.cleanerNameFallback;
        const normalizedServices = (Array.isArray(row.services) ? row.services : [])
          .map(normalizeServiceId).filter((s): s is ServiceId => Boolean(s));
        const ratingStats = ratingsMap.get(row.id);
        const ratingCount = ratingStats?.count ?? 0;
        return {
          id: row.id, displayName: name,
          description: row.description?.trim() || t.cleanerDescriptionFallback,
          photoUrl: identity?.avatar_url ?? row.photo_url,
          hourlyRate: typeof row.hourly_rate === 'number' ? row.hourly_rate : null,
          services: normalizedServices,
          serviceAreas: parseAreas(row.service_areas),
          availability: row.weekly_availability,
          exceptions: row.availability_exceptions,
          completedJobs: completedJobsMap.get(row.id) ?? 0,
          averageRating: ratingCount > 0 && ratingStats ? ratingStats.sum / ratingCount : null,
          ratingCount
        };
      });
      setCleaners(mappedCleaners);

      const recentBookings = ((recentBookingsRes.data as RecentClientBookingRecord[] | null) ?? []).filter(
        (entry): entry is RecentClientBookingRecord & { cleaner_id: string } => Boolean(entry.cleaner_id)
      );
      const lastCompleted = recentBookings.find((entry) => entry.status === 'completed');
      const lastConfirmed = recentBookings.find((entry) => entry.status === 'confirmed');
      const lastBooking = lastCompleted ?? lastConfirmed ?? null;
      if (lastBooking && mappedCleaners.some((cleaner) => cleaner.id === lastBooking.cleaner_id)) {
        setRebookSuggestion({
          cleanerId: lastBooking.cleaner_id,
          services: parseServiceType(lastBooking.service_type)
        });
      } else {
        setRebookSuggestion(null);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [authLoading, isClient, user?.id]);

  useEffect(() => {
    if (spaces.length === 0) { if (selectedSpaceId) setSelectedSpaceId(''); return; }
    if (!spaces.some((s) => s.id === selectedSpaceId)) setSelectedSpaceId(spaces[0].id);
  }, [selectedSpaceId, spaces]);

  useEffect(() => {
    if (!rebookDismissKey) {
      setRebookDismissed(false);
      return;
    }
    setRebookDismissed(window.localStorage.getItem(rebookDismissKey) === '1');
  }, [rebookDismissKey]);

  const selectedSpace = useMemo(() => spaces.find((s) => s.id === selectedSpaceId) ?? null, [spaces, selectedSpaceId]);
  const rebookCleaner = useMemo(
    () => (rebookSuggestion ? cleaners.find((cleaner) => cleaner.id === rebookSuggestion.cleanerId) ?? null : null),
    [cleaners, rebookSuggestion]
  );

  useEffect(() => {
    if (!loading && rebookSuggestion && !rebookCleaner) {
      setRebookSuggestion(null);
      setRebookDismissed(false);
    }
  }, [loading, rebookCleaner, rebookSuggestion]);
  const selectedZone = useMemo(() => selectedSpace ? (selectedSpace.derived_zone || deriveZoneFromCityName(selectedSpace.city) || '') : '', [selectedSpace]);
  const selectedDateValid = useMemo(() => /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) && selectedDate >= minBookDate, [minBookDate, selectedDate]);
  const selectedTimeMinutes = useMemo(() => (selectedTime ? toMinutes(selectedTime) : null), [selectedTime]);
  const selectedTimeValid = selectedTimeMinutes !== null;
  const isSameDaySelected = useMemo(() => isDateTodayInMontreal(selectedDate), [selectedDate]);
  const sameDayMinTime = useMemo(() => (isSameDaySelected ? getMinimumSameDayBookingTime(2, 30) : null), [isSameDaySelected]);
  const sameDayMinTimeMinutes = useMemo(() => (sameDayMinTime ? toMinutes(sameDayMinTime) : null), [sameDayMinTime]);
  const sameDayLeadValid = useMemo(() => {
    if (!isSameDaySelected) return true;
    if (!sameDayMinTime || sameDayMinTimeMinutes === null || selectedTimeMinutes === null) return false;
    return selectedTimeMinutes >= sameDayMinTimeMinutes;
  }, [isSameDaySelected, sameDayMinTime, sameDayMinTimeMinutes, selectedTimeMinutes]);
  const dateValidationMessage = selectedDate.length === 0 ? t.dateRequired : (selectedDateValid ? null : t.dateInvalid);
  const timeValidationMessage = selectedTime.length === 0
    ? (selectedDate ? t.timeRequired : null)
    : (selectedTimeValid ? (sameDayLeadValid ? null : t.sameDayLeadError) : t.timeInvalid);
  const ready = Boolean(selectedSpace && selectedServices.length > 0 && selectedDateValid && selectedTimeValid && sameDayLeadValid);
  const missingRequirements = useMemo(() => {
    const missing: string[] = [];
    if (!selectedSpace) {
      missing.push(t.missingAddress);
    }
    if (selectedServices.length === 0) {
      missing.push(t.missingService);
    }
    if (!selectedDate) {
      missing.push(t.missingDate);
    } else if (!selectedDateValid) {
      missing.push(t.missingDateInvalid);
    }
    if (!selectedTime) {
      missing.push(t.missingTime);
    } else if (!selectedTimeValid) {
      missing.push(t.missingTimeInvalid);
    } else if (!sameDayLeadValid) {
      missing.push(t.missingLeadTime);
    }
    return missing;
  }, [sameDayLeadValid, selectedDate, selectedDateValid, selectedServices.length, selectedSpace, selectedTime, selectedTimeValid, t.missingAddress, t.missingDate, t.missingDateInvalid, t.missingLeadTime, t.missingService, t.missingTime, t.missingTimeInvalid]);

  useEffect(() => {
    if (!sameDayMinTime || sameDayMinTimeMinutes === null || selectedTimeMinutes === null) return;
    if (selectedTimeMinutes < sameDayMinTimeMinutes) setSelectedTime(sameDayMinTime);
  }, [sameDayMinTime, sameDayMinTimeMinutes, selectedTimeMinutes]);

  const matchingPipeline = useMemo<MatchingPipeline>(() => {
    const raw = cleaners;
    const serviceFailures: ServiceFailure[] = [];
    const zoneFailures: ZoneFailure[] = [];
    const availabilityFailures: AvailabilityFailure[] = [];
    const normalizedSelectedZone = normalizeMatch(selectedZone);
    const afterService = raw.filter((cleaner) => {
      const serviceOk = cleaner.services.some((s) => selectedServices.includes(s));
      if (!serviceOk) serviceFailures.push({ cleanerId: cleaner.id, cleanerServices: cleaner.services, selectedServices });
      return serviceOk;
    });
    const afterZone = afterService.filter((cleaner) => {
      if (!normalizedSelectedZone) return true;
      const zoneOk = cleaner.serviceAreas.some((area) => {
        const normalizedAreaZone = normalizeMatch(area.zone);
        const normalizedAreaName = normalizeMatch(area.name);
        return normalizedAreaZone === normalizedSelectedZone || normalizedAreaName === normalizedSelectedZone;
      });
      if (!zoneOk) zoneFailures.push({ cleanerId: cleaner.id, selectedZone, selectedZoneNormalized: normalizedSelectedZone, cleanerAreas: cleaner.serviceAreas.map((a) => ({ zone: a.zone, name: a.name })) });
      return zoneOk;
    });
    const afterAvailability = afterZone.filter((cleaner) => {
      const weekly = cleaner.availability as Record<string, { enabled: boolean; start: string; end: string }> | null;
      if (!weekly || typeof weekly !== 'object') return true;
      const dt = combineMontrealDateTimeToUtc(selectedDate, selectedTime);
      if (!dt) { availabilityFailures.push({ cleanerId: cleaner.id, selectedDate, selectedTime, weekday: null, dayAvailability: null, reason: 'invalid_datetime' }); return false; }
      const weekdayKey = weekday[dt.getDay()];
      const day = weekly[weekdayKey];
      if (!day?.enabled) { availabilityFailures.push({ cleanerId: cleaner.id, selectedDate, selectedTime, weekday: weekdayKey, dayAvailability: day ?? null, reason: 'day_disabled' }); return false; }
      const within = isWithin(selectedTime, day.start, day.end);
      if (!within) availabilityFailures.push({ cleanerId: cleaner.id, selectedDate, selectedTime, weekday: weekdayKey, dayAvailability: day, reason: 'time_out_of_range' });
      return within;
    });
    return { raw, afterService, afterZone, afterAvailability, serviceFailures, zoneFailures, availabilityFailures };
  }, [cleaners, selectedDate, selectedServices, selectedTime, selectedZone]);

  const matched = useMemo(() => {
    if (!ready) return [];
    return matchingPipeline.afterAvailability;
  }, [matchingPipeline.afterAvailability, ready]);
  const sortedMatched = useMemo(() => {
    const indexed = matched.map((cleaner, index) => ({ cleaner, index }));
    indexed.sort((left, right) => {
      const a = left.cleaner;
      const b = right.cleaner;
      if (sortBy === 'price_asc') {
        const ar = a.hourlyRate ?? Number.POSITIVE_INFINITY;
        const br = b.hourlyRate ?? Number.POSITIVE_INFINITY;
        if (ar !== br) return ar - br;
        return left.index - right.index;
      }
      if (sortBy === 'price_desc') {
        const ar = a.hourlyRate ?? Number.NEGATIVE_INFINITY;
        const br = b.hourlyRate ?? Number.NEGATIVE_INFINITY;
        if (ar !== br) return br - ar;
        return left.index - right.index;
      }
      if (sortBy === 'jobs_desc') {
        if (a.completedJobs !== b.completedJobs) return b.completedJobs - a.completedJobs;
        const ar = a.hourlyRate ?? Number.POSITIVE_INFINITY;
        const br = b.hourlyRate ?? Number.POSITIVE_INFINITY;
        if (ar !== br) return ar - br;
        return left.index - right.index;
      }
      const aHasRating = typeof a.averageRating === 'number' && Number.isFinite(a.averageRating);
      const bHasRating = typeof b.averageRating === 'number' && Number.isFinite(b.averageRating);
      if (aHasRating && bHasRating) {
        if (a.averageRating !== b.averageRating) return (b.averageRating ?? 0) - (a.averageRating ?? 0);
        if (a.ratingCount !== b.ratingCount) return b.ratingCount - a.ratingCount;
        return left.index - right.index;
      }
      if (aHasRating !== bHasRating) {
        return aHasRating ? -1 : 1;
      }
      return left.index - right.index;
    });
    return indexed.map((entry) => entry.cleaner);
  }, [matched, sortBy]);
  const cleanersTotalPages = Math.max(1, Math.ceil(sortedMatched.length / CLEANERS_PER_PAGE));
  const paginatedCleaners = useMemo(() => {
    const start = (cleanersPage - 1) * CLEANERS_PER_PAGE;
    return sortedMatched.slice(start, start + CLEANERS_PER_PAGE);
  }, [cleanersPage, sortedMatched, CLEANERS_PER_PAGE]);

  useEffect(() => {
    if (!DEBUG_RESERVATION_MATCHING) return;
    const inputSnapshot = { selectedPlace: selectedSpace?.name ?? null, selectedAddress: selectedSpace?.address ?? null, derivedCity: selectedSpace?.city ?? null, derivedZone: selectedZone || null, selectedServices, selectedDate, selectedTime, selectedDateValid, selectedTimeValid, ready };
    const rawCleanerSnapshot = matchingPipeline.raw.map((c) => ({ id: c.id, hourly_rate: c.hourlyRate, services: c.services, service_areas: c.serviceAreas, weekly_availability: c.availability, availability_exceptions: c.exceptions }));
    console.groupCollapsed('[Reservation Matching Debug]');
    console.info('Step 1 - Reservation runtime values:', inputSnapshot);
    console.info('Step 2 - Raw cleaners count:', matchingPipeline.raw.length);
    console.info('Step 2 - Raw cleaners:', rawCleanerSnapshot);
    console.info('Step 3 - Count after service filter:', matchingPipeline.afterService.length);
    if (matchingPipeline.raw.length > 0 && matchingPipeline.afterService.length === 0) console.warn('Service filter dropped all cleaners:', matchingPipeline.serviceFailures);
    console.info('Step 3 - Count after zone filter:', matchingPipeline.afterZone.length);
    if (matchingPipeline.afterService.length > 0 && matchingPipeline.afterZone.length === 0) console.warn('Zone filter dropped all cleaners:', matchingPipeline.zoneFailures);
    console.info('Step 3 - Count after availability filter:', matchingPipeline.afterAvailability.length);
    if (matchingPipeline.afterZone.length > 0 && matchingPipeline.afterAvailability.length === 0) console.warn('Availability filter dropped all cleaners:', matchingPipeline.availabilityFailures);
    console.info('Rendered cleaners count:', matched.length);
    if (!ready) console.warn('Rendered hint because step completion is false (ready=false).');
    console.groupEnd();
  }, [matched.length, matchingPipeline.afterAvailability.length, matchingPipeline.afterService.length, matchingPipeline.afterZone.length, matchingPipeline.availabilityFailures, matchingPipeline.raw, matchingPipeline.serviceFailures, matchingPipeline.zoneFailures, ready, selectedDate, selectedDateValid, selectedServices, selectedSpace?.address, selectedSpace?.city, selectedSpace?.name, selectedTime, selectedTimeValid, selectedZone]);

  const openBookingFlow = (cleaner: CleanerCandidate, options?: { presetServices?: ServiceId[] }) => {
    if (options?.presetServices && options.presetServices.length > 0) {
      setSelectedServices(options.presetServices);
    }
    setErrorMessage(null);
    setBookingCleaner(cleaner);
    setBookingStep(1);
    setEstimatedHours(3);
    setFullDescriptionOpen(false);
    setModalCleaner(null);
  };

  useEffect(() => {
    if (!modalCleaner) {
      setFullDescriptionOpen(false);
    }
  }, [modalCleaner]);

  useEffect(() => {
    setCleanersPage(1);
  }, [sortedMatched]);

  useEffect(() => {
    if (cleanersPage > cleanersTotalPages) {
      setCleanersPage(cleanersTotalPages);
    }
  }, [cleanersPage, cleanersTotalPages]);

  const dismissRebookBanner = () => {
    if (rebookDismissKey) window.localStorage.setItem(rebookDismissKey, '1');
    setRebookDismissed(true);
  };

  const handleRebookNow = () => {
    if (!rebookCleaner) {
      setRebookSuggestion(null);
      return;
    }
    const presetServices =
      rebookSuggestion?.services && rebookSuggestion.services.length > 0
        ? rebookSuggestion.services
        : selectedServices.length > 0
          ? selectedServices
          : rebookCleaner.services.slice(0, 1);
    openBookingFlow(rebookCleaner, { presetServices });
  };

  const reserve = async (cleaner: CleanerCandidate) => {
    if (!user?.id) return;
    if (!selectedSpace || selectedServices.length === 0 || !selectedDateValid || !selectedTimeValid) {
      setErrorMessage(`${t.missingIntro} ${missingRequirements.join(', ')}`);
      return;
    }
    if (!hasMinimumLeadHoursFromMontrealDateTime(selectedDate, selectedTime, 2)) {
      setErrorMessage(t.sameDayLeadError);
      return;
    }
    const scheduledDate = combineMontrealDateTimeToUtc(selectedDate, selectedTime);
    if (!scheduledDate) { setErrorMessage(t.timeInvalid); return; }
    const weekly = cleaner.availability as Record<string, { enabled: boolean; start: string; end: string }> | null;
    if (weekly && typeof weekly === 'object') {
      const day = weekly[weekday[scheduledDate.getDay()]];
      if (!day?.enabled || !isWithin(selectedTime, day.start, day.end)) {
        setErrorMessage(t.bookingUnavailable);
        return;
      }
    }
    setReservingId(cleaner.id);
    const scheduledAt = scheduledDate.toISOString();
    let insertRes = await supabase
      .from('bookings')
      .insert([{ client_id: user.id, cleaner_id: cleaner.id, space_id: selectedSpace.id, service_type: selectedServices.join(','), scheduled_at: scheduledAt, estimated_hours: estimatedHours, status: 'pending' }])
      .select('id,status').single();
    let error = insertRes.error;
    if (error && (error.code === '42703' || error.message?.toLowerCase().includes('cleaner_id') || error.message?.toLowerCase().includes('estimated_hours'))) {
      insertRes = await supabase
        .from('bookings')
        .insert([{ client_id: user.id, cleaner_id: cleaner.id, space_id: selectedSpace.id, service_type: selectedServices.join(','), scheduled_at: scheduledAt, status: 'pending' }])
        .select('id,status').single();
      error = insertRes.error;
    }
    setReservingId(null);
    if (error) { setErrorMessage(t.reserveError); return; }
    const createdBooking = insertRes.data as BookingInsertResult | null;
    if (createdBooking?.id) {
      await triggerBookingCreatedNotification(createdBooking.id, session?.access_token ?? null);
      const nextPath = `${successPath}?booking=${encodeURIComponent(createdBooking.id)}`;
      window.history.pushState({}, '', nextPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
      setBookingCleaner(null);
      return;
    }
    setToast(t.reserveSuccess);
    setBookingCleaner(null);
  };

  const approxTotal = useMemo(() => {
    if (!bookingCleaner?.hourlyRate) return null;
    return bookingCleaner.hourlyRate * estimatedHours;
  }, [bookingCleaner?.hourlyRate, estimatedHours]);

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // Some browsers require a strict user gesture; focus fallback still helps.
      }
    }
  };

  // Compute current step for progress indicator
  const currentStep = useMemo(() => {
    if (!selectedSpace) return 1;
    if (selectedServices.length === 0) return 2;
    if (!selectedDateValid || !selectedTimeValid) return 3;
    return 4;
  }, [selectedSpace, selectedServices.length, selectedDateValid, selectedTimeValid]);

  if (!isClient()) return null;

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#F0F4F8] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {reservationPageStyles()}

        {/* Toast */}
        {toast && (
          <div className="fixed right-4 top-24 z-50 flex items-center gap-2 rounded-2xl bg-[#1A1A2E] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(17,24,39,0.25)]">
            <CheckCircle2 size={15} className="text-[#A8E6CF]" />
            {toast}
          </div>
        )}

        {/* Page header */}
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#4FC3F7]">Nettoyó</p>
            <h1 className="mt-1 text-2xl font-bold text-[#1A1A2E] sm:text-3xl">{t.title}</h1>
            <p className="mt-1 text-sm text-[#6B7280]">{t.subtitle}</p>
          </div>
          <StepProgress
            steps={[t.step1, t.step2, t.step3, t.step4]}
            current={currentStep}
          />
        </div>

        {!loading && rebookCleaner && !rebookDismissed ? (
          <section className="mb-5 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 shadow-[0_6px_20px_rgba(17,24,39,0.06)] sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1A1A2E]">
                  {t.rebookTitlePrefix} {rebookCleaner.displayName}
                  {t.rebookTitleSuffix}
                </p>
                <p className="mt-0.5 text-xs text-[#6B7280]">{t.rebookSubtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRebookNow}
                  className="rounded-xl bg-[#4FC3F7] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#3FAAD4]"
                >
                  {t.rebookCta}
                </button>
                <button
                  type="button"
                  onClick={dismissRebookBanner}
                  className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#6B7280] transition-colors hover:border-[#CBD5E1] hover:text-[#4B5563]"
                >
                  {t.rebookLater}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {loading ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white py-20 shadow-[0_4px_24px_rgba(17,24,39,0.06)]">
            <Loader2 className="animate-spin text-[#4FC3F7]" size={28} />
            <p className="mt-4 text-sm font-medium text-[#6B7280]">{t.loading}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">

            {/* Step 1: Address */}
            <section className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] text-xs font-bold text-[#0284C7]">1</span>
                <h2 className="text-base font-bold text-[#1A1A2E]">{t.step1}</h2>
              </div>

              {spaces.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#BFE9FB] bg-[#F8FCFF] p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(79,195,247,0.12)] text-[#4FC3F7]">
                    <Home size={20} />
                  </div>
                  <p className="mt-3 text-sm font-medium text-[#4B5563]">{t.noSpace}</p>
                  <a
                    href={addSpacePath}
                    onClick={(e) => { e.preventDefault(); navigateTo('clientAddSpace'); }}
                    className="mt-4 inline-flex rounded-2xl bg-[#4FC3F7] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.3)] transition-all hover:bg-[#38B2E8]"
                  >
                    {t.addSpace}
                  </a>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {spaces.map((s) => {
                    const selected = s.id === selectedSpaceId;
                    const zone = s.derived_zone || deriveZoneFromCityName(s.city) || '--';
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSpaceId(s.id)}
                        className={`group relative rounded-2xl border p-4 text-left transition-all ${
                          selected
                            ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.06)] shadow-[0_0_0_1px_#4FC3F7]'
                            : 'border-[#E5E7EB] hover:border-[#BFE9FB] hover:bg-[#FAFCFF]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-[#1A1A2E]">{s.name}</p>
                          {selected && (
                            <CheckCircle2 size={16} className="flex-shrink-0 text-[#4FC3F7]" />
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#6B7280]">
                          {[s.address, s.city].filter(Boolean).join(', ') || '--'}
                        </p>
                        <span className="mt-3 inline-flex rounded-lg bg-[rgba(168,230,207,0.28)] px-2.5 py-1 text-[11px] font-semibold text-[#065F46]">
                          {zone}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Step 2: Services */}
            <section className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] text-xs font-bold text-[#0284C7]">2</span>
                <h2 className="text-base font-bold text-[#1A1A2E]">{t.step2}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {services.map((service) => {
                  const selected = selectedServices.includes(service);
                  return (
                    <button
                      key={service}
                      type="button"
                      onClick={() =>
                        setSelectedServices((cur) =>
                          selected ? cur.filter((item) => item !== service) : [...cur, service]
                        )
                      }
                      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition-all ${
                        selected
                          ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.1)] text-[#0284C7] shadow-[0_0_0_1px_rgba(79,195,247,0.4)]'
                          : 'border-[#E5E7EB] text-[#4B5563] hover:border-[#BFE9FB]'
                      }`}
                    >
                      {serviceLabels[service][language]}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 3: Date & Time */}
            <section className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] text-xs font-bold text-[#0284C7]">3</span>
                <h2 className="text-base font-bold text-[#1A1A2E]">{t.step3}</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className="cursor-pointer rounded-2xl border border-[#E5E7EB] px-4 py-3.5 transition-colors focus-within:border-[#4FC3F7] focus-within:shadow-[0_0_0_1px_rgba(79,195,247,0.3)]"
                  onPointerDown={(event) => {
                    if (event.target instanceof HTMLInputElement) {
                      return;
                    }
                    event.preventDefault();
                    openDatePicker();
                  }}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    <Calendar size={12} />
                    {t.dateLabel}
                  </div>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={selectedDate}
                    min={minBookDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="min-h-[44px] w-full cursor-pointer bg-transparent text-sm font-semibold text-[#1A1A2E] outline-none"
                  />
                  {dateValidationMessage && (
                    <p className="mt-2 text-xs font-medium text-[#DC2626]">{dateValidationMessage}</p>
                  )}
                </label>

                <div className="rounded-2xl border border-[#E5E7EB] px-4 py-3.5 transition-colors focus-within:border-[#4FC3F7] focus-within:shadow-[0_0_0_1px_rgba(79,195,247,0.3)]">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    <Clock3 size={12} />
                    {t.timeLabel}
                  </div>
                  <TimePickerField value={selectedTime} onChange={setSelectedTime} label={t.timeLabel} />
                  {timeValidationMessage && (
                    <p className="mt-2 text-xs font-medium text-[#DC2626]">{timeValidationMessage}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Step 4: Cleaners */}
            <section className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] text-xs font-bold text-[#0284C7]">4</span>
                  <h2 className="text-base font-bold text-[#1A1A2E]">{t.step4}</h2>
                  {ready && sortedMatched.length > 0 && (
                    <span className="rounded-lg bg-[rgba(168,230,207,0.3)] px-2 py-0.5 text-xs font-bold text-[#065F46]">
                      {sortedMatched.length}
                    </span>
                  )}
                </div>
                {ready && sortedMatched.length > 0 && (
                  <label className="inline-flex flex-shrink-0 items-center gap-1.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#D1E7F7] bg-[#F8FCFF] text-[#6B7280]">
                      <ArrowUpDown size={14} aria-hidden="true" />
                    </span>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as SortOption)}
                      aria-label="Trier les r\u00e9sultats"
                      className="min-w-0 rounded-xl border border-[#D1E7F7] bg-[#F8FCFF] px-2.5 py-2 text-xs font-semibold text-[#1A1A2E] outline-none transition-colors focus:border-[#4FC3F7] sm:px-3 sm:text-sm"
                    >
                      <option value="price_asc">{t.sortPriceAsc}</option>
                      <option value="price_desc">{t.sortPriceDesc}</option>
                      <option value="jobs_desc">{t.sortJobsDesc}</option>
                      <option value="rating_desc">{t.sortRatingDesc}</option>
                    </select>
                  </label>
                )}
              </div>

              {errorMessage && (
                <div className="mb-4 rounded-2xl bg-[rgba(220,38,38,0.08)] px-4 py-3 text-sm font-medium text-[#DC2626]">
                  {errorMessage}
                </div>
              )}

              {!ready ? (
                <div
                  className="rounded-2xl border bg-[#F8FCFF] px-5 py-6"
                  style={{ animation: 'reservation-missing-soft-pulse 2.2s ease-in-out infinite' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(79,195,247,0.14)] text-[#4FC3F7]">
                      <Search size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1A1A2E]">{t.missingIntro}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {missingRequirements.map((item) => (
                          <span
                            key={item}
                            className="inline-flex rounded-full border border-[#BFE9FB] bg-white px-2.5 py-1 text-xs font-semibold text-[#0284C7]"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : sortedMatched.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-12 text-center">
                  <p className="text-sm font-medium text-[#4B5563]">{t.noResult}</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {paginatedCleaners.map((cleaner) => (
                      <CleanerCard
                        key={cleaner.id}
                        cleaner={cleaner}
                        language={language}
                        t={t}
                        onDetails={() => setModalCleaner(cleaner)}
                        onBook={() => openBookingFlow(cleaner)}
                        reservingId={reservingId}
                      />
                    ))}
                  </div>
                  <PaginationControls
                    page={cleanersPage}
                    totalPages={cleanersTotalPages}
                    onPageChange={setCleanersPage}
                    labels={paginationLabels}
                  />
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Cleaner details modal */}
      {modalCleaner && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-4"
          onClick={() => setModalCleaner(null)}
        >
          <div
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(17,24,39,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex flex-shrink-0 items-start gap-4 p-6 pb-5">
              {modalCleaner.photoUrl ? (
                <img src={modalCleaner.photoUrl} alt={modalCleaner.displayName} className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[rgba(79,195,247,0.2)] to-[rgba(168,230,207,0.2)] text-[#4FC3F7]">
                  <User size={24} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-[#1A1A2E]">{modalCleaner.displayName}</p>
                <p className="mt-0.5 text-sm font-semibold text-[#0284C7]">{formatHourlyRate(modalCleaner.hourlyRate)}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalCleaner(null)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] text-[#9CA3AF] transition-colors hover:border-[#DC2626] hover:text-[#DC2626]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="border-t border-[#F0F4F8]" />

            {/* Modal body */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
              <div className="rounded-2xl bg-[#F8FAFC] p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">
                  {t.descriptionTitle}
                </p>
                <p className="line-clamp-3 text-sm leading-relaxed text-[#4B5563]">
                  {modalCleaner.description || t.descriptionEmpty}
                </p>
                {modalCleaner.description.trim().length > 180 ? (
                  <button
                    type="button"
                    onClick={() => setFullDescriptionOpen(true)}
                    className="mt-3 text-xs font-semibold text-[#0284C7] transition-colors hover:text-[#0369A1]"
                  >
                    {t.seeMore}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex flex-shrink-0 items-center gap-3 border-t border-[#F0F4F8] p-5">
              <button
                type="button"
                onClick={() => setModalCleaner(null)}
                className="flex-1 rounded-2xl border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#6B7280] transition-colors hover:border-[#9CA3AF]"
              >
                {t.close}
              </button>
              <button
                type="button"
                onClick={() => openBookingFlow(modalCleaner)}
                className="flex flex-1 items-center justify-center rounded-2xl bg-[#4FC3F7] py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.35)] transition-all hover:bg-[#38B2E8]"
              >
                {t.reserve}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCleaner && fullDescriptionOpen ? (
        <div
          className="fixed inset-0 z-[75] flex items-end justify-center overflow-y-auto overscroll-contain bg-black/50 px-4 pb-4 sm:items-center sm:pb-0"
          onClick={() => setFullDescriptionOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl bg-white p-6 shadow-[0_20px_60px_rgba(17,24,39,0.3)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-[#1A1A2E]">{t.fullDescriptionTitle}</h3>
              <button
                type="button"
                onClick={() => setFullDescriptionOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#9CA3AF] transition-colors hover:border-[#DC2626] hover:text-[#DC2626]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-2xl bg-[#F8FAFC] p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#4B5563]">
                {modalCleaner.description || t.descriptionEmpty}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Booking flow modal */}
      {bookingCleaner && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto overscroll-contain bg-black/45 px-4 pb-4 sm:items-center sm:pb-0"
          onClick={() => setBookingCleaner(null)}
        >
          <div
            className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl bg-white shadow-[0_24px_70px_rgba(17,24,39,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between gap-3 border-b border-[#F0F4F8] px-6 py-5">
              <div>
                <h3 className="text-base font-bold text-[#1A1A2E]">{t.bookingFlowTitle}</h3>
                <p className="mt-0.5 text-sm font-medium text-[#0284C7]">{bookingCleaner.displayName}</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Mini step dots */}
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${bookingStep >= 1 ? 'bg-[#4FC3F7]' : 'bg-[#E5E7EB]'}`} />
                  <span className={`h-2 w-2 rounded-full ${bookingStep >= 2 ? 'bg-[#4FC3F7]' : 'bg-[#E5E7EB]'}`} />
                </div>
                <button
                  type="button"
                  onClick={() => setBookingCleaner(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#9CA3AF] transition-colors hover:border-[#DC2626] hover:text-[#DC2626]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Step 1: Hours */}
            {bookingStep === 1 && (
              <div className="p-6">
                <h4 className="text-sm font-bold text-[#1A1A2E]">{t.bookingStep1Title}</h4>
                <p className="mt-0.5 text-xs font-semibold text-[#0284C7]">{t.bookingStep1Hint}</p>

                {/* Guidance card */}
                <div className="mt-4 rounded-2xl border border-[#D1E7F7] bg-[#F8FCFF] p-4 text-xs leading-relaxed text-[#4B5563]">
                  <p>{t.bookingGuideSmall}</p>
                  <p className="mt-1">{t.bookingGuideMedium}</p>
                  <p className="mt-1">{t.bookingGuideLarge}</p>
                  <p className="mt-1">{t.bookingGuideMove}</p>
                </div>

                {/* Hour selector */}
                <div className="mt-5">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">{t.bookingHoursLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {estimatedHourOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setEstimatedHours(value)}
                        className={`rounded-2xl border px-4 py-2 text-sm font-bold transition-all ${
                          estimatedHours === value
                            ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.12)] text-[#0284C7] shadow-[0_0_0_1px_rgba(79,195,247,0.4)]'
                            : 'border-[#E5E7EB] text-[#4B5563] hover:border-[#BFE9FB]'
                        }`}
                      >
                        {value}h
                      </button>
                    ))}
                  </div>
                </div>

                <p className="mt-4 rounded-2xl bg-[rgba(251,191,36,0.12)] px-4 py-3 text-xs font-medium text-[#92400E]">
                  {t.bookingAdjustDisclaimer}
                </p>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setBookingStep(2)}
                    className="rounded-2xl bg-[#4FC3F7] px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.35)] transition-all hover:bg-[#38B2E8]"
                  >
                    {t.continue}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Summary */}
            {bookingStep === 2 && (
              <div className="p-6">
                <h4 className="mb-4 text-sm font-bold text-[#1A1A2E]">{t.bookingSummaryTitle}</h4>

                <div className="mb-3 grid gap-2.5 sm:grid-cols-2">
                  <label className="rounded-2xl border border-[#E5E7EB] px-4 py-3 transition-colors focus-within:border-[#4FC3F7] focus-within:shadow-[0_0_0_1px_rgba(79,195,247,0.3)]">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                      <Calendar size={12} />
                      {t.dateLabel}
                    </div>
                    <input
                      type="date"
                      value={selectedDate}
                      min={minBookDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="min-h-[40px] w-full bg-transparent text-sm font-semibold text-[#1A1A2E] outline-none"
                    />
                    {dateValidationMessage && (
                      <p className="mt-2 text-xs font-medium text-[#DC2626]">{dateValidationMessage}</p>
                    )}
                  </label>
                  <div className="rounded-2xl border border-[#E5E7EB] px-4 py-3 transition-colors focus-within:border-[#4FC3F7] focus-within:shadow-[0_0_0_1px_rgba(79,195,247,0.3)]">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                      <Clock3 size={12} />
                      {t.timeLabel}
                    </div>
                    <TimePickerField value={selectedTime} onChange={setSelectedTime} label={t.timeLabel} />
                    {timeValidationMessage && (
                      <p className="mt-2 text-xs font-medium text-[#DC2626]">{timeValidationMessage}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[
                    { label: t.bookingSummaryAddress, value: [selectedSpace?.address, selectedSpace?.city].filter(Boolean).join(', ') || '--' },
                    { label: t.bookingSummaryRate, value: formatHourlyRate(bookingCleaner.hourlyRate) },
                    { label: t.bookingSummaryHours, value: `${estimatedHours}h` },
                    { label: t.bookingSummaryDate, value: selectedDate || '--' },
                    { label: t.bookingSummaryTime, value: selectedTime || '--' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-2xl border border-[#EEF2F7] bg-[#F8FAFC] p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-[#1A1A2E]">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Total highlight */}
                <div className="mt-3.5 flex items-center justify-between rounded-2xl border border-[#A7F3D0] bg-[rgba(168,230,207,0.18)] px-4 py-3">
                  <span className="text-sm font-semibold text-[#065F46]">{t.bookingApproxTotal}</span>
                  <span className="text-base font-bold text-[#065F46]">
                    {bookingCleaner.hourlyRate && approxTotal !== null
                      ? `~${approxTotal}$`
                      : '--'}
                  </span>
                </div>

                {/* Payment notice */}
                <div className="mt-3 rounded-2xl border border-[#D1E7F7] bg-[#F8FCFF] px-4 py-3 text-xs leading-relaxed text-[#4B5563]">
                  <p>{t.paymentDisclaimer1}</p>
                  <p className="mt-1">{t.paymentDisclaimer2}</p>
                </div>
                {errorMessage && (
                  <div className="mt-3 rounded-2xl bg-[rgba(220,38,38,0.08)] px-4 py-3 text-sm font-medium text-[#DC2626]">
                    {errorMessage}
                  </div>
                )}

                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setBookingStep(1)}
                    className="flex-1 rounded-2xl border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#6B7280] transition-colors hover:border-[#9CA3AF]"
                  >
                    {t.back}
                  </button>
                  <button
                    type="button"
                    disabled={reservingId === bookingCleaner.id}
                    onClick={() => void reserve(bookingCleaner)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#4FC3F7] py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.35)] transition-all hover:bg-[#38B2E8] disabled:opacity-60"
                  >
                    {reservingId === bookingCleaner.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : t.finish}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

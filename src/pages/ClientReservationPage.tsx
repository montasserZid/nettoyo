import { Calendar, Clock3, Home, Loader2, MapPin, Search, Sparkles, User, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TimePickerField } from '../components/TimePickerField';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getPathForRoute } from '../i18n/routes';
import { deriveZoneFromCityName } from '../lib/zoneMapping';
import supabase from '../lib/supabase';

type ServiceId = 'domicile' | 'deep_cleaning' | 'office' | 'moving' | 'post_renovation' | 'airbnb';
type SpaceRecord = { id: string; name: string; address: string | null; city: string | null; derived_zone: string | null; is_favorite: boolean; is_active: boolean };
type CleanerProfileRecord = { id: string; description: string | null; hourly_rate: number | null; services: string[] | null; photo_url: string | null; service_areas: unknown; weekly_availability: unknown; availability_exceptions: unknown };
type AreaSelection = { id: string; zone: string; name: string; lat: number; lng: number };
type CleanerIdentity = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };
type CleanerCandidate = { id: string; displayName: string; description: string; photoUrl: string | null; hourlyRate: number | null; services: ServiceId[]; serviceAreas: AreaSelection[]; availability: unknown; exceptions: unknown };
type BookingInsertResult = { id: string; status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'accepted' };

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
    step1: '1. Adresse', step2: '2. Service(s)', step3: '3. Date & heure', step4: '4. Nettoyeurs',
    dateLabel: 'Date', timeLabel: 'Heure', dateRequired: 'Veuillez choisir une date.', dateInvalid: 'Date invalide.',
    addSpace: 'Ajouter un espace', noSpace: 'Vous devez ajouter un espace avant de reserver.',
    details: 'Details', reserve: 'Reserver', selected: 'Selectionne', noResult: 'Aucun nettoyeur compatible.',
    hint: 'Completer les etapes 1 a 3 pour afficher les nettoyeurs.',
    trust: 'Nouveau sur Nettoyo', zoneMatch: 'Zone compatible', avail: 'Disponible a cette date',
    modalServices: 'Services', modalZones: 'Zones', close: 'Fermer',
    reserveSuccess: 'Reservation creee.', reserveError: 'Impossible de reserver pour le moment.', loading: 'Chargement...',
    timeRequired: 'Veuillez choisir une heure.', timeInvalid: 'Format d heure invalide.',
    hourlyRate: 'Taux horaire', bookingFlowTitle: 'Estimation du menage', bookingStep1Title: 'Combien d heures pensez-vous que le menage prendra ?', bookingStep1Hint: 'Estimations a titre indicatif',
    bookingGuideSmall: 'Petit appartement / condo (1-2 chambres): 2-3 heures', bookingGuideMedium: 'Maison moyenne (3-4 chambres): 4-6 heures', bookingGuideLarge: 'Grande maison / menage en profondeur: 6-10+ heures', bookingGuideMove: 'Menage de demenagement: 7-10+ heures',
    bookingAdjustDisclaimer: 'Cette estimation n est pas finale. Vous pourrez ajuster avec le nettoyeur selon le travail reel.', bookingHoursLabel: 'Heures estimees',
    bookingSummaryTitle: 'Resume de la reservation', bookingSummaryAddress: 'Adresse', bookingSummaryRate: 'Taux horaire', bookingSummaryHours: 'Heures estimees', bookingSummaryDate: 'Date', bookingSummaryTime: 'Heure',
    bookingApproxTotal: 'Total approximatif', paymentDisclaimer1: 'Le paiement se fait directement avec le nettoyeur (cash ou Interac).', paymentDisclaimer2: 'Le montant affiche est approximatif et peut varier selon le travail reel.',
    back: 'Retour', continue: 'Continuer', finish: 'Terminer'
  },
  en: {
    title: 'Book', subtitle: 'Choose address, service, date and time before results.',
    step1: '1. Address', step2: '2. Service(s)', step3: '3. Date & time', step4: '4. Cleaners',
    dateLabel: 'Date', timeLabel: 'Time', dateRequired: 'Please choose a date.', dateInvalid: 'Invalid date.',
    addSpace: 'Add a space', noSpace: 'You need a saved space before booking.',
    details: 'Details', reserve: 'Reserve', selected: 'Selected', noResult: 'No matching cleaner yet.',
    hint: 'Complete steps 1 to 3 to display cleaners.',
    trust: 'New on Nettoyo', zoneMatch: 'Zone match', avail: 'Available on this date',
    modalServices: 'Services', modalZones: 'Zones', close: 'Close',
    reserveSuccess: 'Booking created.', reserveError: 'Unable to book right now.', loading: 'Loading...',
    timeRequired: 'Please choose a time.', timeInvalid: 'Invalid time format.',
    hourlyRate: 'Hourly rate', bookingFlowTitle: 'Cleaning estimate', bookingStep1Title: 'How many hours do you think the cleaning will take?', bookingStep1Hint: 'Guidance only',
    bookingGuideSmall: 'Small apartment / condo (1-2 bed): 2-3 hours', bookingGuideMedium: 'Average home (3-4 bed): 4-6 hours', bookingGuideLarge: 'Large home / deep clean: 6-10+ hours', bookingGuideMove: 'Move-in / move-out clean: 7-10+ hours',
    bookingAdjustDisclaimer: 'This estimate is not final. You can adjust with the cleaner based on actual work.', bookingHoursLabel: 'Estimated hours',
    bookingSummaryTitle: 'Booking summary', bookingSummaryAddress: 'Address', bookingSummaryRate: 'Hourly rate', bookingSummaryHours: 'Estimated hours', bookingSummaryDate: 'Date', bookingSummaryTime: 'Time',
    bookingApproxTotal: 'Approximate total', paymentDisclaimer1: 'Payment is made directly to the cleaner (cash or Interac).', paymentDisclaimer2: 'Displayed amount is approximate and may vary based on actual work.',
    back: 'Back', continue: 'Continue', finish: 'Confirm'
  },
  es: {
    title: 'Reservar', subtitle: 'Elige direccion, servicio, fecha y hora antes de ver resultados.',
    step1: '1. Direccion', step2: '2. Servicio(s)', step3: '3. Fecha y hora', step4: '4. Limpiadores',
    dateLabel: 'Fecha', timeLabel: 'Hora', dateRequired: 'Selecciona una fecha.', dateInvalid: 'Fecha invalida.',
    addSpace: 'Agregar espacio', noSpace: 'Debes agregar un espacio antes de reservar.',
    details: 'Detalles', reserve: 'Reservar', selected: 'Seleccionado', noResult: 'Aun no hay limpiadores compatibles.',
    hint: 'Completa los pasos 1 a 3 para mostrar limpiadores.',
    trust: 'Nuevo en Nettoyo', zoneMatch: 'Zona compatible', avail: 'Disponible en esta fecha',
    modalServices: 'Servicios', modalZones: 'Zonas', close: 'Cerrar',
    reserveSuccess: 'Reserva creada.', reserveError: 'No se pudo reservar.', loading: 'Cargando...',
    timeRequired: 'Selecciona una hora.', timeInvalid: 'Formato de hora invalido.',
    hourlyRate: 'Tarifa por hora', bookingFlowTitle: 'Estimacion de limpieza', bookingStep1Title: 'Cuantas horas crees que tomara la limpieza?', bookingStep1Hint: 'Estimaciones orientativas',
    bookingGuideSmall: 'Apartamento pequeno / condo (1-2 hab): 2-3 horas', bookingGuideMedium: 'Casa media (3-4 hab): 4-6 horas', bookingGuideLarge: 'Casa grande / limpieza profunda: 6-10+ horas', bookingGuideMove: 'Limpieza de mudanza: 7-10+ horas',
    bookingAdjustDisclaimer: 'Esta estimacion no es final. Podras ajustarla con el limpiador segun el trabajo real.', bookingHoursLabel: 'Horas estimadas',
    bookingSummaryTitle: 'Resumen de reserva', bookingSummaryAddress: 'Direccion', bookingSummaryRate: 'Tarifa por hora', bookingSummaryHours: 'Horas estimadas', bookingSummaryDate: 'Fecha', bookingSummaryTime: 'Hora',
    bookingApproxTotal: 'Total aproximado', paymentDisclaimer1: 'El pago se realiza directamente con el limpiador (efectivo o Interac).', paymentDisclaimer2: 'El monto mostrado es aproximado y puede variar segun el trabajo real.',
    back: 'Atras', continue: 'Continuar', finish: 'Terminar'
  }
} as const;

const serviceLabels: Record<ServiceId, { fr: string; en: string; es: string }> = {
  domicile: { fr: 'Domicile', en: 'Home', es: 'Domicilio' }, deep_cleaning: { fr: 'Profondeur', en: 'Deep cleaning', es: 'Profunda' }, office: { fr: 'Bureau', en: 'Office', es: 'Oficina' },
  moving: { fr: 'Demenagement', en: 'Moving', es: 'Mudanza' }, post_renovation: { fr: 'Post-renovation', en: 'Post-renovation', es: 'Post-renovacion' }, airbnb: { fr: 'Airbnb', en: 'Airbnb', es: 'Airbnb' }
};

const parseAreas = (value: unknown): AreaSelection[] => Array.isArray(value) ? value.filter((v): v is AreaSelection => Boolean(v && typeof v === 'object' && typeof (v as AreaSelection).zone === 'string' && typeof (v as AreaSelection).name === 'string')) : [];
const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const normalizeMatch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const serviceAliasMap: Record<string, ServiceId> = { domicile: 'domicile', home: 'domicile', domicilio: 'domicile', 'deep cleaning': 'deep_cleaning', deep_cleaning: 'deep_cleaning', profondeur: 'deep_cleaning', profunda: 'deep_cleaning', office: 'office', bureau: 'office', oficina: 'office', moving: 'moving', demenagement: 'moving', mudanza: 'moving', post_renovation: 'post_renovation', 'post renovation': 'post_renovation', airbnb: 'airbnb' };
const normalizeServiceId = (value: string): ServiceId | null => serviceAliasMap[normalizeMatch(value)] ?? null;
const toLocalDateInputValue = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const toMinutes = (v: string) => { const m = v.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/); if (!m) return null; const rawHour = Number(m[1]); const minute = Number(m[2]); const second = m[3] ? Number(m[3]) : 0; const meridiem = m[4]?.toUpperCase() as 'AM' | 'PM' | undefined; if (Number.isNaN(rawHour) || Number.isNaN(minute) || Number.isNaN(second) || minute > 59 || second > 59) return null; if (meridiem) { if (rawHour < 1 || rawHour > 12) return null; const hour24 = meridiem === 'PM' ? (rawHour % 12) + 12 : rawHour % 12; return hour24 * 60 + minute; } if (rawHour < 0 || rawHour > 23) return null; return rawHour * 60 + minute; };
const isWithin = (t: string,s: string,e: string) => { const tt=toMinutes(t); const ss=toMinutes(s); const ee=toMinutes(e); if(tt===null||ss===null||ee===null) return true; if(ee<ss) return tt>=ss||tt<=ee; return tt>=ss&&tt<=ee; };
const formatHourlyRate = (rate: number | null) => (typeof rate === 'number' && Number.isFinite(rate) ? `${rate}$/h` : '--');
const formatDescriptionPreview = (description: string, max = 96) => { const text = description.trim(); return text.length <= max ? text : `${text.slice(0, max).trim()}...`; };
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
    if (!response.ok) {
      console.error('Booking-created notification failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Booking-created notification request error:', error);
  }
};

export function ClientReservationPage() {
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
  const [selectedDate, setSelectedDate] = useState(toLocalDateInputValue);
  const [selectedTime, setSelectedTime] = useState('06:00');
  const [modalCleaner, setModalCleaner] = useState<CleanerCandidate | null>(null);
  const [bookingCleaner, setBookingCleaner] = useState<CleanerCandidate | null>(null);
  const [bookingStep, setBookingStep] = useState<1 | 2>(1);
  const [estimatedHours, setEstimatedHours] = useState<number>(3);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [minBookDate] = useState(toLocalDateInputValue);

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2400); return () => window.clearTimeout(timer); }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id || !isClient()) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      setLoading(true);
      const [spacesRes, cleanersRes] = await Promise.all([
        supabase.from('spaces').select('id,name,address,city,derived_zone,is_favorite,is_active').eq('client_id', user.id).eq('is_active', true).order('is_favorite', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('cleaner_profiles').select('id,description,hourly_rate,services,photo_url,service_areas,weekly_availability,availability_exceptions')
      ]);
      if (!active) return;
      if (spacesRes.error) { setErrorMessage(spacesRes.error.message); setLoading(false); return; }
      const nextSpaces = (spacesRes.data as SpaceRecord[] | null) ?? [];
      setSpaces(nextSpaces);
      if (nextSpaces[0]) setSelectedSpaceId((v) => v || nextSpaces[0].id);

      if (cleanersRes.error) { setCleaners([]); setLoading(false); return; }
      const rows = (cleanersRes.data as CleanerProfileRecord[] | null) ?? [];
      const ids = rows.map((r) => r.id);
      const profileRes = ids.length > 0 ? await supabase.from('profiles').select('id,first_name,last_name,avatar_url').in('id', ids).eq('role', 'nettoyeur') : { data: null, error: null };
      const idMap = new Map<string, CleanerIdentity>(((profileRes.data as CleanerIdentity[] | null) ?? []).map((p) => [p.id, p]));

      setCleaners(rows.map((row) => {
        const identity = idMap.get(row.id);
        const first = identity?.first_name?.trim();
        const initial = identity?.last_name?.trim()?.[0]?.toUpperCase();
        const name = first ? `${first}${initial ? ` ${initial}.` : ''}` : 'Nettoyo Cleaner';
        const normalizedServices = (Array.isArray(row.services) ? row.services : []).map(normalizeServiceId).filter((service): service is ServiceId => Boolean(service));
        return {
          id: row.id,
          displayName: name,
          description: row.description?.trim() || 'Nettoyeur professionnel disponible localement.',
          photoUrl: identity?.avatar_url ?? row.photo_url,
          hourlyRate: typeof row.hourly_rate === 'number' ? row.hourly_rate : null,
          services: normalizedServices,
          serviceAreas: parseAreas(row.service_areas),
          availability: row.weekly_availability,
          exceptions: row.availability_exceptions
        };
      }));
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [authLoading, isClient, user?.id]);

  useEffect(() => {
    if (spaces.length === 0) { if (selectedSpaceId) setSelectedSpaceId(''); return; }
    if (!spaces.some((space) => space.id === selectedSpaceId)) setSelectedSpaceId(spaces[0].id);
  }, [selectedSpaceId, spaces]);

  const selectedSpace = useMemo(() => spaces.find((s) => s.id === selectedSpaceId) ?? null, [spaces, selectedSpaceId]);
  const selectedZone = useMemo(() => selectedSpace ? (selectedSpace.derived_zone || deriveZoneFromCityName(selectedSpace.city) || '') : '', [selectedSpace]);
  const selectedDateValid = useMemo(() => /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) && selectedDate >= minBookDate, [minBookDate, selectedDate]);
  const selectedTimeMinutes = useMemo(() => (selectedTime ? toMinutes(selectedTime) : null), [selectedTime]);
  const selectedTimeValid = selectedTimeMinutes !== null;
  const dateValidationMessage = selectedDate.length === 0 ? t.dateRequired : (selectedDateValid ? null : t.dateInvalid);
  const timeValidationMessage = selectedTime.length === 0 ? (selectedDate ? t.timeRequired : null) : (selectedTimeValid ? null : t.timeInvalid);
  const ready = Boolean(selectedSpace && selectedServices.length > 0 && selectedDateValid && selectedTimeValid);

  const matchingPipeline = useMemo<MatchingPipeline>(() => {
    const raw = cleaners;
    const serviceFailures: ServiceFailure[] = [];
    const zoneFailures: ZoneFailure[] = [];
    const availabilityFailures: AvailabilityFailure[] = [];
    const normalizedSelectedZone = normalizeMatch(selectedZone);

    const afterService = raw.filter((cleaner) => {
      const serviceOk = cleaner.services.some((service) => selectedServices.includes(service));
      if (!serviceOk) serviceFailures.push({ cleanerId: cleaner.id, cleanerServices: cleaner.services, selectedServices });
      return serviceOk;
    });

    const afterZone = afterService.filter((cleaner) => {
      const zoneOk = cleaner.serviceAreas.some((area) => {
        const normalizedAreaZone = normalizeMatch(area.zone);
        const normalizedAreaName = normalizeMatch(area.name);
        return normalizedAreaZone === normalizedSelectedZone || normalizedAreaName === normalizedSelectedZone;
      });
      if (!zoneOk) zoneFailures.push({ cleanerId: cleaner.id, selectedZone, selectedZoneNormalized: normalizedSelectedZone, cleanerAreas: cleaner.serviceAreas.map((area) => ({ zone: area.zone, name: area.name })) });
      return zoneOk;
    });

    const afterAvailability = afterZone.filter((cleaner) => {
      const weekly = cleaner.availability as Record<string, { enabled: boolean; start: string; end: string }> | null;
      if (!weekly || typeof weekly !== 'object') return true;
      const dt = new Date(`${selectedDate}T${selectedTime}:00`);
      if (Number.isNaN(dt.getTime())) { availabilityFailures.push({ cleanerId: cleaner.id, selectedDate, selectedTime, weekday: null, dayAvailability: null, reason: 'invalid_datetime' }); return false; }
      const weekdayKey = weekday[dt.getDay()];
      const day = weekly[weekdayKey];
      if (!day?.enabled) { availabilityFailures.push({ cleanerId: cleaner.id, selectedDate, selectedTime, weekday: weekdayKey, dayAvailability: day ?? null, reason: 'day_disabled' }); return false; }
      const within = isWithin(selectedTime, day.start, day.end);
      if (!within) availabilityFailures.push({ cleanerId: cleaner.id, selectedDate, selectedTime, weekday: weekdayKey, dayAvailability: day, reason: 'time_out_of_range' });
      return within;
    });

    return { raw, afterService, afterZone, afterAvailability, serviceFailures, zoneFailures, availabilityFailures };
  }, [cleaners, selectedDate, selectedServices, selectedTime, selectedZone]);

  const matched = useMemo(() => { if (!ready || !selectedZone) return []; return matchingPipeline.afterAvailability; }, [matchingPipeline.afterAvailability, ready, selectedZone]);

  useEffect(() => {
    if (!DEBUG_RESERVATION_MATCHING) return;
    const inputSnapshot = { selectedPlace: selectedSpace?.name ?? null, selectedAddress: selectedSpace?.address ?? null, derivedCity: selectedSpace?.city ?? null, derivedZone: selectedZone || null, selectedServices, selectedDate, selectedTime, selectedDateValid, selectedTimeValid, ready };
    const rawCleanerSnapshot = matchingPipeline.raw.map((cleaner) => ({ id: cleaner.id, hourly_rate: cleaner.hourlyRate, services: cleaner.services, service_areas: cleaner.serviceAreas, weekly_availability: cleaner.availability, availability_exceptions: cleaner.exceptions }));
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

  const openBookingFlow = (cleaner: CleanerCandidate) => { setBookingCleaner(cleaner); setBookingStep(1); setEstimatedHours(3); setModalCleaner(null); };

  const reserve = async (cleaner: CleanerCandidate) => {
    if (!user?.id || !selectedSpace || !selectedDateValid || !selectedTimeValid || selectedServices.length === 0) return;
    setReservingId(cleaner.id);
    const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    let insertRes = await supabase
      .from('bookings')
      .insert([
        {
          client_id: user.id,
          cleaner_id: cleaner.id,
          space_id: selectedSpace.id,
          service_type: selectedServices.join(','),
          scheduled_at: scheduledAt,
          estimated_hours: estimatedHours,
          status: 'pending'
        }
      ])
      .select('id,status')
      .single();
    let error = insertRes.error;
    if (error && (error.code === '42703' || error.message?.toLowerCase().includes('cleaner_id') || error.message?.toLowerCase().includes('estimated_hours'))) {
      insertRes = await supabase
        .from('bookings')
        .insert([
          {
            client_id: user.id,
            cleaner_id: cleaner.id,
            space_id: selectedSpace.id,
            service_type: selectedServices.join(','),
            scheduled_at: scheduledAt,
            status: 'pending'
          }
        ])
        .select('id,status')
        .single();
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

  const approxTotal = useMemo(() => { if (!bookingCleaner?.hourlyRate) return null; return bookingCleaner.hourlyRate * estimatedHours; }, [bookingCleaner?.hourlyRate, estimatedHours]);

  if (!isClient()) return null;

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#F7F7F7] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {toast ? <div className="fixed right-4 top-24 z-50 rounded-full bg-[#1A1A2E] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(17,24,39,0.2)]">{toast}</div> : null}
        <section className="rounded-[28px] bg-white px-6 py-8 shadow-[0_16px_36px_rgba(17,24,39,0.07)] sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4FC3F7]">Reservation</p><h1 className="mt-2 text-2xl font-bold text-[#1A1A2E] sm:text-3xl">{t.title}</h1><p className="mt-2 max-w-2xl text-sm text-[#6B7280]">{t.subtitle}</p></section>

        {loading ? <section className="mt-6 rounded-[28px] bg-white p-12 text-center shadow-[0_14px_32px_rgba(17,24,39,0.06)]"><Loader2 className="mx-auto animate-spin text-[#4FC3F7]" size={28} /><p className="mt-4 text-sm font-medium text-[#6B7280]">{t.loading}</p></section> : (
          <>
            <section className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7"><h2 className="text-lg font-bold text-[#1A1A2E]">{t.step1}</h2>{spaces.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-[#BFE9FB] bg-[#F8FCFF] p-6 text-center"><Home size={22} className="mx-auto text-[#4FC3F7]" /><p className="mt-3 text-sm text-[#6B7280]">{t.noSpace}</p><a href={addSpacePath} onClick={(e)=>{e.preventDefault();navigateTo('clientAddSpace');}} className="mt-4 inline-flex rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white">{t.addSpace}</a></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{spaces.map((s)=>{const selected=s.id===selectedSpaceId; const zone=s.derived_zone || deriveZoneFromCityName(s.city) || '--'; return <button key={s.id} type="button" onClick={()=>setSelectedSpaceId(s.id)} className={`rounded-2xl border p-4 text-left ${selected?'border-[#4FC3F7] bg-[#F8FCFF]':'border-[#E5E7EB] hover:border-[#BFE9FB]'}`}><p className="text-sm font-bold text-[#1A1A2E]">{s.name}</p><p className="mt-1 text-xs text-[#6B7280]">{[s.address,s.city].filter(Boolean).join(', ')||'--'}</p><div className="mt-3 flex items-center justify-between"><span className="rounded-full bg-[rgba(168,230,207,0.28)] px-2.5 py-1 text-[11px] font-semibold text-[#1A1A2E]">{zone}</span>{selected?<span className="text-[11px] font-semibold text-[#4FC3F7]">{t.selected}</span>:null}</div></button>;})}</div>}</section>
            <section className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7"><h2 className="text-lg font-bold text-[#1A1A2E]">{t.step2}</h2><div className="mt-4 flex flex-wrap gap-2.5">{services.map((service)=>{const selected=selectedServices.includes(service); return <button key={service} type="button" onClick={()=>setSelectedServices((cur)=>selected?cur.filter((item)=>item!==service):[...cur,service])} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selected?'border-[#4FC3F7] bg-[rgba(79,195,247,0.12)] text-[#0284C7]':'border-[#E5E7EB] text-[#1A1A2E]'}`}>{serviceLabels[service][language]}</button>;})}</div></section>
            <section className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7"><h2 className="text-lg font-bold text-[#1A1A2E]">{t.step3}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="rounded-2xl border border-[#E5E7EB] px-4 py-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><Calendar size={13}/>{t.dateLabel}</div><input type="date" value={selectedDate} min={minBookDate} onChange={(e)=>setSelectedDate(e.target.value)} className="w-full bg-transparent text-sm font-semibold text-[#1A1A2E] outline-none"/>{dateValidationMessage?<p className="mt-2 text-xs font-medium text-[#B91C1C]">{dateValidationMessage}</p>:null}</label><div className="rounded-2xl border border-[#E5E7EB] px-4 py-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><Clock3 size={13}/>{t.timeLabel}</div><TimePickerField value={selectedTime} onChange={setSelectedTime} label={t.timeLabel} />{timeValidationMessage?<p className="mt-2 text-xs font-medium text-[#B91C1C]">{timeValidationMessage}</p>:null}</div></div></section>
            <section className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#1A1A2E]">{t.step4}</h2><span className="inline-flex items-center gap-1 rounded-full bg-[rgba(79,195,247,0.12)] px-3 py-1 text-xs font-semibold text-[#0284C7]"><Search size={12}/>{t.hint}</span></div>{errorMessage?<div className="mb-4 rounded-xl bg-[rgba(239,68,68,0.1)] px-4 py-3 text-sm font-medium text-[#B91C1C]">{errorMessage}</div>:null}{!ready?<div className="rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-8 text-center text-sm text-[#6B7280]">{t.hint}</div>:matched.length===0?<div className="rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-8 text-center text-sm text-[#6B7280]">{t.noResult}</div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{matched.map((cleaner)=>{const showServices=cleaner.services.slice(0,4); return <article key={cleaner.id} className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-[0_14px_30px_rgba(17,24,39,0.06)]"><div className="flex items-start gap-3">{cleaner.photoUrl?<img src={cleaner.photoUrl} alt={cleaner.displayName} className="h-14 w-14 rounded-full object-cover"/>:<div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] text-[#4FC3F7]"><User size={20}/></div>}<div className="min-w-0"><p className="truncate text-base font-bold text-[#1A1A2E]">{cleaner.displayName}</p><p className="mt-1 text-xs font-semibold text-[#0284C7]">{t.hourlyRate}: {formatHourlyRate(cleaner.hourlyRate)}</p><p className="mt-1 line-clamp-2 text-sm text-[#6B7280]">{formatDescriptionPreview(cleaner.description)}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{showServices.map((s)=><span key={`${cleaner.id}-${s}`} className="inline-flex rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]">{serviceLabels[s][language]}</span>)}</div><div className="mt-4 space-y-2 text-xs text-[#6B7280]"><p className="inline-flex items-center gap-1 rounded-full bg-[rgba(168,230,207,0.32)] px-2.5 py-1 font-semibold text-[#1A1A2E]"><MapPin size={12}/>{t.zoneMatch}</p><p className="inline-flex items-center gap-1 rounded-full bg-[rgba(79,195,247,0.12)] px-2.5 py-1 font-semibold text-[#0284C7]"><Clock3 size={12}/>{t.avail}</p></div><p className="mt-4 inline-flex items-center gap-1 rounded-full bg-[rgba(79,195,247,0.12)] px-2.5 py-1 text-xs font-semibold text-[#0284C7]"><Sparkles size={12}/>{t.trust}</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setModalCleaner(cleaner)} className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#1A1A2E]">{t.details}</button><button type="button" onClick={()=>openBookingFlow(cleaner)} className="inline-flex items-center justify-center rounded-full bg-[#4FC3F7] px-3 py-2 text-sm font-semibold text-white">{t.reserve}</button></div></article>;})}</div>}</section>
          </>
        )}
      </div>

      {modalCleaner ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 px-4 py-4 sm:items-center"><div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(17,24,39,0.2)] sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3">{modalCleaner.photoUrl?<img src={modalCleaner.photoUrl} alt={modalCleaner.displayName} className="h-16 w-16 rounded-full object-cover"/>:<div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(79,195,247,0.14)] text-[#4FC3F7]"><User size={22}/></div>}<div><p className="text-lg font-bold text-[#1A1A2E]">{modalCleaner.displayName}</p><p className="mt-1 text-sm font-semibold text-[#0284C7]">{t.hourlyRate}: {formatHourlyRate(modalCleaner.hourlyRate)}</p><p className="mt-1 text-sm text-[#6B7280]">{modalCleaner.description}</p></div></div><button type="button" onClick={()=>setModalCleaner(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280]"><X size={16}/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#E5E7EB] p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{t.modalServices}</p><div className="mt-2 flex flex-wrap gap-2">{modalCleaner.services.map((s)=><span key={`modal-s-${s}`} className="inline-flex rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-semibold text-[#4B5563]">{serviceLabels[s][language]}</span>)}</div></div><div className="rounded-2xl border border-[#E5E7EB] p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{t.modalZones}</p><div className="mt-2 flex flex-wrap gap-2">{modalCleaner.serviceAreas.slice(0,8).map((a)=><span key={`modal-z-${a.id}`} className="inline-flex rounded-full bg-[rgba(168,230,207,0.28)] px-2.5 py-1 text-xs font-semibold text-[#1A1A2E]">{a.zone}</span>)}</div></div></div><div className="mt-6 flex items-center justify-end gap-2"><button type="button" onClick={()=>setModalCleaner(null)} className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280]">{t.close}</button><button type="button" onClick={()=>openBookingFlow(modalCleaner)} className="inline-flex min-w-[120px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white">{t.reserve}</button></div></div></div> : null}
      {bookingCleaner ? <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-4 py-4 sm:items-center"><div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.28)] sm:p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-[#1A1A2E]">{t.bookingFlowTitle}</h3><p className="mt-1 text-sm text-[#4B5563]">{bookingCleaner.displayName}</p></div><button type="button" onClick={()=>setBookingCleaner(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280]"><X size={16}/></button></div>{bookingStep===1?<div className="mt-5 space-y-4"><h4 className="text-base font-bold text-[#1A1A2E]">{t.bookingStep1Title}</h4><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0284C7]">{t.bookingStep1Hint}</p><div className="rounded-2xl border border-[#D1E7F7] bg-[#F8FCFF] p-4 text-xs leading-relaxed text-[#4B5563]"><p>{t.bookingGuideSmall}</p><p className="mt-1">{t.bookingGuideMedium}</p><p className="mt-1">{t.bookingGuideLarge}</p><p className="mt-1">{t.bookingGuideMove}</p></div><div><p className="mb-2 text-sm font-semibold text-[#1A1A2E]">{t.bookingHoursLabel}</p><div className="flex flex-wrap gap-2">{estimatedHourOptions.map((value)=><button key={value} type="button" onClick={()=>setEstimatedHours(value)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${estimatedHours===value?'border-[#4FC3F7] bg-[rgba(79,195,247,0.12)] text-[#0284C7]':'border-[#E5E7EB] text-[#1A1A2E]'}`}>{value}h</button>)}</div></div><p className="rounded-xl bg-[rgba(251,191,36,0.14)] px-4 py-3 text-xs font-medium text-[#92400E]">{t.bookingAdjustDisclaimer}</p><div className="mt-6 flex justify-end"><button type="button" onClick={()=>setBookingStep(2)} className="rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white">{t.continue}</button></div></div>:<div className="mt-5 space-y-4"><h4 className="text-base font-bold text-[#1A1A2E]">{t.bookingSummaryTitle}</h4><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#E5E7EB] p-3"><p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{t.bookingSummaryAddress}</p><p className="mt-1 text-sm font-semibold text-[#1A1A2E]">{[selectedSpace?.address,selectedSpace?.city].filter(Boolean).join(', ')||'--'}</p></div><div className="rounded-xl border border-[#E5E7EB] p-3"><p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{t.bookingSummaryRate}</p><p className="mt-1 text-sm font-semibold text-[#1A1A2E]">{formatHourlyRate(bookingCleaner.hourlyRate)}</p></div><div className="rounded-xl border border-[#E5E7EB] p-3"><p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{t.bookingSummaryHours}</p><p className="mt-1 text-sm font-semibold text-[#1A1A2E]">{estimatedHours}h</p></div><div className="rounded-xl border border-[#E5E7EB] p-3"><p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{t.bookingSummaryDate}</p><p className="mt-1 text-sm font-semibold text-[#1A1A2E]">{selectedDate}</p></div><div className="rounded-xl border border-[#E5E7EB] p-3"><p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{t.bookingSummaryTime}</p><p className="mt-1 text-sm font-semibold text-[#1A1A2E]">{selectedTime}</p></div></div><div className="rounded-xl border border-[#A7F3D0] bg-[rgba(168,230,207,0.22)] px-4 py-3 text-sm font-semibold text-[#065F46]">{t.bookingApproxTotal}: {bookingCleaner.hourlyRate && approxTotal!==null ? `${bookingCleaner.hourlyRate}$/h x ${estimatedHours}h = ${approxTotal}$ (approx)` : '--'}</div><div className="rounded-xl border border-[#D1E7F7] bg-[#F8FCFF] px-4 py-3 text-xs text-[#4B5563]"><p>{t.paymentDisclaimer1}</p><p className="mt-1">{t.paymentDisclaimer2}</p></div><div className="mt-6 flex items-center justify-end gap-2"><button type="button" onClick={()=>setBookingStep(1)} className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280]">{t.back}</button><button type="button" disabled={reservingId===bookingCleaner.id} onClick={()=>void reserve(bookingCleaner)} className="inline-flex min-w-[120px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white disabled:opacity-70">{reservingId===bookingCleaner.id?<Loader2 size={14} className="animate-spin"/>:t.finish}</button></div></div>}</div></div> : null}
    </div>
  );
}

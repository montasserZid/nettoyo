import { Calendar, Clock3, Home, Loader2, MapPin, Search, Sparkles, User, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TimeStepControl } from '../components/TimeStepControl';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getPathForRoute } from '../i18n/routes';
import { deriveZoneFromCityName } from '../lib/zoneMapping';
import supabase from '../lib/supabase';

type ServiceId = 'domicile' | 'deep_cleaning' | 'office' | 'moving' | 'post_renovation' | 'airbnb';
type SpaceRecord = { id: string; name: string; address: string | null; city: string | null; derived_zone: string | null; is_favorite: boolean; is_active: boolean };
type CleanerProfileRecord = { id: string; description: string | null; services: string[] | null; photo_url: string | null; service_areas: unknown; weekly_availability: unknown; availability_exceptions: unknown };
type AreaSelection = { id: string; zone: string; name: string; lat: number; lng: number };
type CleanerIdentity = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };
type CleanerCandidate = { id: string; displayName: string; description: string; photoUrl: string | null; services: ServiceId[]; serviceAreas: AreaSelection[]; availability: unknown; exceptions: unknown };
type ServiceFailure = { cleanerId: string; cleanerServices: ServiceId[]; selectedServices: ServiceId[] };
type ZoneFailure = { cleanerId: string; selectedZone: string; selectedZoneNormalized: string; cleanerAreas: { zone: string; name: string }[] };
type AvailabilityFailure = {
  cleanerId: string;
  selectedDate: string;
  selectedTime: string;
  weekday: string | null;
  dayAvailability: { enabled: boolean; start: string; end: string } | null;
  reason: 'invalid_datetime' | 'day_disabled' | 'time_out_of_range';
};
type MatchingPipeline = {
  raw: CleanerCandidate[];
  afterService: CleanerCandidate[];
  afterZone: CleanerCandidate[];
  afterAvailability: CleanerCandidate[];
  serviceFailures: ServiceFailure[];
  zoneFailures: ZoneFailure[];
  availabilityFailures: AvailabilityFailure[];
};
const DEBUG_RESERVATION_MATCHING = true;

const services: ServiceId[] = ['domicile', 'deep_cleaning', 'office', 'moving', 'post_renovation', 'airbnb'];
const labels = {
  fr: {
    title: 'Reserver', subtitle: 'Choisissez adresse, service, date et heure avant les resultats.',
    step1: '1. Adresse', step2: '2. Service(s)', step3: '3. Date & heure', step4: '4. Nettoyeurs',
    dateLabel: 'Date', timeLabel: 'Heure',
    dateRequired: 'Veuillez choisir une date.',
    dateInvalid: 'Date invalide.',
    addSpace: 'Ajouter un espace', noSpace: 'Vous devez ajouter un espace avant de reserver.',
    details: 'Details', reserve: 'Reserver', selected: 'Selectionne', noResult: 'Aucun nettoyeur compatible.',
    hint: 'Completer les etapes 1 a 3 pour afficher les nettoyeurs.',
    trust: 'Nouveau sur Nettoyo', zoneMatch: 'Zone compatible', avail: 'Disponible a cette date',
    modalServices: 'Services', modalZones: 'Zones', close: 'Fermer',
    reserveSuccess: 'Reservation creee.', reserveError: 'Impossible de reserver pour le moment.', loading: 'Chargement...',
    timeRequired: "Veuillez choisir une heure.",
    timeInvalid: "Format d'heure invalide."
  },
  en: {
    title: 'Book', subtitle: 'Choose address, service, date and time before results.',
    step1: '1. Address', step2: '2. Service(s)', step3: '3. Date & time', step4: '4. Cleaners',
    dateLabel: 'Date', timeLabel: 'Time',
    dateRequired: 'Please choose a date.',
    dateInvalid: 'Invalid date.',
    addSpace: 'Add a space', noSpace: 'You need a saved space before booking.',
    details: 'Details', reserve: 'Reserve', selected: 'Selected', noResult: 'No matching cleaner yet.',
    hint: 'Complete steps 1 to 3 to display cleaners.',
    trust: 'New on Nettoyo', zoneMatch: 'Zone match', avail: 'Available on this date',
    modalServices: 'Services', modalZones: 'Zones', close: 'Close',
    reserveSuccess: 'Booking created.', reserveError: 'Unable to book right now.', loading: 'Loading...',
    timeRequired: 'Please choose a time.',
    timeInvalid: 'Invalid time format.'
  },
  es: {
    title: 'Reservar', subtitle: 'Elige direccion, servicio, fecha y hora antes de ver resultados.',
    step1: '1. Direccion', step2: '2. Servicio(s)', step3: '3. Fecha y hora', step4: '4. Limpiadores',
    dateLabel: 'Fecha', timeLabel: 'Hora',
    dateRequired: 'Selecciona una fecha.',
    dateInvalid: 'Fecha invalida.',
    addSpace: 'Agregar espacio', noSpace: 'Debes agregar un espacio antes de reservar.',
    details: 'Detalles', reserve: 'Reservar', selected: 'Seleccionado', noResult: 'Aun no hay limpiadores compatibles.',
    hint: 'Completa los pasos 1 a 3 para mostrar limpiadores.',
    trust: 'Nuevo en Nettoyo', zoneMatch: 'Zona compatible', avail: 'Disponible en esta fecha',
    modalServices: 'Servicios', modalZones: 'Zonas', close: 'Cerrar',
    reserveSuccess: 'Reserva creada.', reserveError: 'No se pudo reservar.', loading: 'Cargando...',
    timeRequired: 'Selecciona una hora.',
    timeInvalid: 'Formato de hora invalido.'
  }
} as const;

const serviceLabels: Record<ServiceId, { fr: string; en: string; es: string }> = {
  domicile: { fr: 'Domicile', en: 'Home', es: 'Domicilio' },
  deep_cleaning: { fr: 'Profondeur', en: 'Deep cleaning', es: 'Profunda' },
  office: { fr: 'Bureau', en: 'Office', es: 'Oficina' },
  moving: { fr: 'Demenagement', en: 'Moving', es: 'Mudanza' },
  post_renovation: { fr: 'Post-renovation', en: 'Post-renovation', es: 'Post-renovacion' },
  airbnb: { fr: 'Airbnb', en: 'Airbnb', es: 'Airbnb' }
};

const parseAreas = (value: unknown): AreaSelection[] => Array.isArray(value) ? value.filter((v): v is AreaSelection => Boolean(v && typeof v === 'object' && typeof (v as AreaSelection).zone === 'string' && typeof (v as AreaSelection).name === 'string')) : [];
const weekday = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const;
const normalizeMatch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const serviceAliasMap: Record<string, ServiceId> = {
  domicile: 'domicile',
  home: 'domicile',
  domicilio: 'domicile',
  'deep cleaning': 'deep_cleaning',
  deep_cleaning: 'deep_cleaning',
  profondeur: 'deep_cleaning',
  profunda: 'deep_cleaning',
  office: 'office',
  bureau: 'office',
  oficina: 'office',
  moving: 'moving',
  demenagement: 'moving',
  mudanza: 'moving',
  post_renovation: 'post_renovation',
  'post renovation': 'post_renovation',
  airbnb: 'airbnb'
};
const normalizeServiceId = (value: string): ServiceId | null => serviceAliasMap[normalizeMatch(value)] ?? null;
const toLocalDateInputValue = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const toMinutes = (v: string) => {
  const m = v.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  const rawHour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] ? Number(m[3]) : 0;
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
const isWithin = (t: string,s: string,e: string) => { const tt=toMinutes(t); const ss=toMinutes(s); const ee=toMinutes(e); if(tt===null||ss===null||ee===null) return true; if(ee<ss) return tt>=ss||tt<=ee; return tt>=ss&&tt<=ee; };
export function ClientReservationPage() {
  const { language, navigateTo } = useLanguage();
  const { user, isClient, loading: authLoading } = useAuth();
  const t = labels[language];
  const addSpacePath = getPathForRoute(language, 'clientAddSpace');

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
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [minBookDate] = useState(toLocalDateInputValue);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id || !isClient()) { setLoading(false); return; }

    let active = true;
    const load = async () => {
      setLoading(true);
      const [spacesRes, cleanersRes] = await Promise.all([
        supabase.from('spaces').select('id,name,address,city,derived_zone,is_favorite,is_active').eq('client_id', user.id).eq('is_active', true).order('is_favorite', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('cleaner_profiles').select('id,description,services,photo_url,service_areas,weekly_availability,availability_exceptions')
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
        const normalizedServices = (Array.isArray(row.services) ? row.services : [])
          .map(normalizeServiceId)
          .filter((service): service is ServiceId => Boolean(service));
        return {
          id: row.id,
          displayName: name,
          description: (row.description?.trim() || 'Nettoyeur professionnel disponible localement.').slice(0, 120),
          photoUrl: identity?.avatar_url ?? row.photo_url,
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
    if (spaces.length === 0) {
      if (selectedSpaceId) setSelectedSpaceId('');
      return;
    }
    if (!spaces.some((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [selectedSpaceId, spaces]);

  const selectedSpace = useMemo(() => spaces.find((s) => s.id === selectedSpaceId) ?? null, [spaces, selectedSpaceId]);
  const selectedZone = useMemo(() => selectedSpace ? (selectedSpace.derived_zone || deriveZoneFromCityName(selectedSpace.city) || '') : '', [selectedSpace]);
  const selectedDateValid = useMemo(
    () => /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) && selectedDate >= minBookDate,
    [minBookDate, selectedDate]
  );
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
      if (!serviceOk) {
        serviceFailures.push({
          cleanerId: cleaner.id,
          cleanerServices: cleaner.services,
          selectedServices
        });
      }
      return serviceOk;
    });

    const afterZone = afterService.filter((cleaner) => {
      const zoneOk = cleaner.serviceAreas.some((area) => {
        const normalizedAreaZone = normalizeMatch(area.zone);
        const normalizedAreaName = normalizeMatch(area.name);
        return normalizedAreaZone === normalizedSelectedZone || normalizedAreaName === normalizedSelectedZone;
      });
      if (!zoneOk) {
        zoneFailures.push({
          cleanerId: cleaner.id,
          selectedZone,
          selectedZoneNormalized: normalizedSelectedZone,
          cleanerAreas: cleaner.serviceAreas.map((area) => ({ zone: area.zone, name: area.name }))
        });
      }
      return zoneOk;
    });

    const afterAvailability = afterZone.filter((cleaner) => {
      const weekly = cleaner.availability as Record<string, { enabled: boolean; start: string; end: string }> | null;
      if (!weekly || typeof weekly !== 'object') return true;

      const dt = new Date(`${selectedDate}T${selectedTime}:00`);
      if (Number.isNaN(dt.getTime())) {
        availabilityFailures.push({
          cleanerId: cleaner.id,
          selectedDate,
          selectedTime,
          weekday: null,
          dayAvailability: null,
          reason: 'invalid_datetime'
        });
        return false;
      }

      const weekdayKey = weekday[dt.getDay()];
      const day = weekly[weekdayKey];
      if (!day?.enabled) {
        availabilityFailures.push({
          cleanerId: cleaner.id,
          selectedDate,
          selectedTime,
          weekday: weekdayKey,
          dayAvailability: day ?? null,
          reason: 'day_disabled'
        });
        return false;
      }
      const within = isWithin(selectedTime, day.start, day.end);
      if (!within) {
        availabilityFailures.push({
          cleanerId: cleaner.id,
          selectedDate,
          selectedTime,
          weekday: weekdayKey,
          dayAvailability: day,
          reason: 'time_out_of_range'
        });
      }
      return within;
    });

    return {
      raw,
      afterService,
      afterZone,
      afterAvailability,
      serviceFailures,
      zoneFailures,
      availabilityFailures
    };
  }, [cleaners, selectedDate, selectedServices, selectedTime, selectedZone]);

  const matched = useMemo(() => {
    if (!ready || !selectedZone) return [];
    return matchingPipeline.afterAvailability;
  }, [matchingPipeline.afterAvailability, ready, selectedZone]);

  useEffect(() => {
    if (!DEBUG_RESERVATION_MATCHING) return;

    const inputSnapshot = {
      selectedPlace: selectedSpace?.name ?? null,
      selectedAddress: selectedSpace?.address ?? null,
      derivedCity: selectedSpace?.city ?? null,
      derivedZone: selectedZone || null,
      selectedServices,
      selectedDate,
      selectedTime,
      selectedDateValid,
      selectedTimeValid,
      ready
    };

    const rawCleanerSnapshot = matchingPipeline.raw.map((cleaner) => ({
      id: cleaner.id,
      services: cleaner.services,
      service_areas: cleaner.serviceAreas,
      weekly_availability: cleaner.availability,
      availability_exceptions: cleaner.exceptions
    }));

    console.groupCollapsed('[Reservation Matching Debug]');
    console.info('Step 1 - Reservation runtime values:', inputSnapshot);
    console.info('Step 2 - Raw cleaners count:', matchingPipeline.raw.length);
    console.info('Step 2 - Raw cleaners:', rawCleanerSnapshot);
    console.info('Step 3 - Count after service filter:', matchingPipeline.afterService.length);
    if (matchingPipeline.raw.length > 0 && matchingPipeline.afterService.length === 0) {
      console.warn('Service filter dropped all cleaners:', matchingPipeline.serviceFailures);
    }
    console.info('Step 3 - Count after zone filter:', matchingPipeline.afterZone.length);
    if (matchingPipeline.afterService.length > 0 && matchingPipeline.afterZone.length === 0) {
      console.warn('Zone filter dropped all cleaners:', matchingPipeline.zoneFailures);
    }
    console.info('Step 3 - Count after availability filter:', matchingPipeline.afterAvailability.length);
    if (matchingPipeline.afterZone.length > 0 && matchingPipeline.afterAvailability.length === 0) {
      console.warn('Availability filter dropped all cleaners:', matchingPipeline.availabilityFailures);
    }
    console.info('Rendered cleaners count:', matched.length);
    if (!ready) {
      console.warn('Rendered hint because step completion is false (ready=false).');
    }
    console.groupEnd();
  }, [
    matched.length,
    matchingPipeline.afterAvailability.length,
    matchingPipeline.afterService.length,
    matchingPipeline.afterZone.length,
    matchingPipeline.availabilityFailures,
    matchingPipeline.raw,
    matchingPipeline.serviceFailures,
    matchingPipeline.zoneFailures,
    ready,
    selectedDate,
    selectedDateValid,
    selectedServices,
    selectedSpace?.address,
    selectedSpace?.city,
    selectedSpace?.name,
    selectedTime,
    selectedTimeValid,
    selectedZone
  ]);
  const reserve = async (cleaner: CleanerCandidate) => {
    if (!user?.id || !selectedSpace || !selectedDateValid || !selectedTimeValid || selectedServices.length === 0) return;
    setReservingId(cleaner.id);
    const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    let { error } = await supabase.from('bookings').insert([{ client_id: user.id, cleaner_id: cleaner.id, space_id: selectedSpace.id, service_type: selectedServices.join(','), scheduled_at: scheduledAt, status: 'pending' }]);
    if (error && (error.code === '42703' || error.message?.toLowerCase().includes('cleaner_id'))) {
      const retry = await supabase.from('bookings').insert([{ client_id: user.id, space_id: selectedSpace.id, service_type: selectedServices.join(','), scheduled_at: scheduledAt, status: 'pending' }]);
      error = retry.error;
    }
    setReservingId(null);
    if (error) { setErrorMessage(t.reserveError); return; }
    setToast(t.reserveSuccess);
    setModalCleaner(null);
  };

  if (!isClient()) return null;

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#F7F7F7] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {toast ? <div className="fixed right-4 top-24 z-50 rounded-full bg-[#1A1A2E] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(17,24,39,0.2)]">{toast}</div> : null}
        <section className="rounded-[28px] bg-white px-6 py-8 shadow-[0_16px_36px_rgba(17,24,39,0.07)] sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4FC3F7]">Reservation</p><h1 className="mt-2 text-2xl font-bold text-[#1A1A2E] sm:text-3xl">{t.title}</h1><p className="mt-2 max-w-2xl text-sm text-[#6B7280]">{t.subtitle}</p></section>

        {loading ? <section className="mt-6 rounded-[28px] bg-white p-12 text-center shadow-[0_14px_32px_rgba(17,24,39,0.06)]"><Loader2 className="mx-auto animate-spin text-[#4FC3F7]" size={28} /><p className="mt-4 text-sm font-medium text-[#6B7280]">{t.loading}</p></section> : (
          <>
            <section className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7"><h2 className="text-lg font-bold text-[#1A1A2E]">{t.step1}</h2>
              {spaces.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-[#BFE9FB] bg-[#F8FCFF] p-6 text-center"><Home size={22} className="mx-auto text-[#4FC3F7]" /><p className="mt-3 text-sm text-[#6B7280]">{t.noSpace}</p><a href={addSpacePath} onClick={(e)=>{e.preventDefault();navigateTo('clientAddSpace');}} className="mt-4 inline-flex rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white">{t.addSpace}</a></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{spaces.map((s)=>{const selected=s.id===selectedSpaceId; const zone=s.derived_zone || deriveZoneFromCityName(s.city) || '—'; return <button key={s.id} type="button" onClick={()=>setSelectedSpaceId(s.id)} className={`rounded-2xl border p-4 text-left ${selected?'border-[#4FC3F7] bg-[#F8FCFF]':'border-[#E5E7EB] hover:border-[#BFE9FB]'}`}><p className="text-sm font-bold text-[#1A1A2E]">{s.name}</p><p className="mt-1 text-xs text-[#6B7280]">{[s.address,s.city].filter(Boolean).join(', ')||'—'}</p><div className="mt-3 flex items-center justify-between"><span className="rounded-full bg-[rgba(168,230,207,0.28)] px-2.5 py-1 text-[11px] font-semibold text-[#1A1A2E]">{zone}</span>{selected?<span className="text-[11px] font-semibold text-[#4FC3F7]">{t.selected}</span>:null}</div></button>;})}</div>}
            </section>

            <section className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7"><h2 className="text-lg font-bold text-[#1A1A2E]">{t.step2}</h2><div className="mt-4 flex flex-wrap gap-2.5">{services.map((service)=>{const selected=selectedServices.includes(service); return <button key={service} type="button" onClick={()=>setSelectedServices((cur)=>selected?cur.filter((item)=>item!==service):[...cur,service])} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selected?'border-[#4FC3F7] bg-[rgba(79,195,247,0.12)] text-[#0284C7]':'border-[#E5E7EB] text-[#1A1A2E]'}`}>{serviceLabels[service][language]}</button>;})}</div></section>

            <section className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7"><h2 className="text-lg font-bold text-[#1A1A2E]">{t.step3}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="rounded-2xl border border-[#E5E7EB] px-4 py-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><Calendar size={13}/>{t.dateLabel}</div><input type="date" value={selectedDate} min={minBookDate} onChange={(e)=>setSelectedDate(e.target.value)} className="w-full bg-transparent text-sm font-semibold text-[#1A1A2E] outline-none"/>{dateValidationMessage?<p className="mt-2 text-xs font-medium text-[#B91C1C]">{dateValidationMessage}</p>:null}</label><div className="rounded-2xl border border-[#E5E7EB] px-4 py-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><Clock3 size={13}/>{t.timeLabel}</div><TimeStepControl value={selectedTime} onChange={setSelectedTime} />{timeValidationMessage?<p className="mt-2 text-xs font-medium text-[#B91C1C]">{timeValidationMessage}</p>:null}</div></div></section>

            <section className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#1A1A2E]">{t.step4}</h2><span className="inline-flex items-center gap-1 rounded-full bg-[rgba(79,195,247,0.12)] px-3 py-1 text-xs font-semibold text-[#0284C7]"><Search size={12}/>{t.hint}</span></div>{errorMessage?<div className="mb-4 rounded-xl bg-[rgba(239,68,68,0.1)] px-4 py-3 text-sm font-medium text-[#B91C1C]">{errorMessage}</div>:null}{!ready?<div className="rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-8 text-center text-sm text-[#6B7280]">{t.hint}</div>:matched.length===0?<div className="rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-8 text-center text-sm text-[#6B7280]">{t.noResult}</div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{matched.map((cleaner)=>{const showServices=cleaner.services.slice(0,4); return <article key={cleaner.id} className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-[0_14px_30px_rgba(17,24,39,0.06)]"><div className="flex items-start gap-3">{cleaner.photoUrl?<img src={cleaner.photoUrl} alt={cleaner.displayName} className="h-14 w-14 rounded-full object-cover"/>:<div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] text-[#4FC3F7]"><User size={20}/></div>}<div className="min-w-0"><p className="truncate text-base font-bold text-[#1A1A2E]">{cleaner.displayName}</p><p className="mt-1 line-clamp-2 text-sm text-[#6B7280]">{cleaner.description}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{showServices.map((s)=><span key={`${cleaner.id}-${s}`} className="inline-flex rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]">{serviceLabels[s as ServiceId][language] ?? s}</span>)}</div><div className="mt-4 space-y-2 text-xs text-[#6B7280]"><p className="inline-flex items-center gap-1 rounded-full bg-[rgba(168,230,207,0.32)] px-2.5 py-1 font-semibold text-[#1A1A2E]"><MapPin size={12}/>{t.zoneMatch}</p><p className="inline-flex items-center gap-1 rounded-full bg-[rgba(79,195,247,0.12)] px-2.5 py-1 font-semibold text-[#0284C7]"><Clock3 size={12}/>{t.avail}</p></div><p className="mt-4 inline-flex items-center gap-1 rounded-full bg-[rgba(79,195,247,0.12)] px-2.5 py-1 text-xs font-semibold text-[#0284C7]"><Sparkles size={12}/>{t.trust}</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setModalCleaner(cleaner)} className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#1A1A2E]">{t.details}</button><button type="button" disabled={reservingId===cleaner.id} onClick={()=>void reserve(cleaner)} className="inline-flex items-center justify-center rounded-full bg-[#4FC3F7] px-3 py-2 text-sm font-semibold text-white disabled:opacity-70">{reservingId===cleaner.id?<Loader2 size={14} className="animate-spin"/>:t.reserve}</button></div></article>;})}</div>}</section>
          </>
        )}
      </div>
      {modalCleaner ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 px-4 py-4 sm:items-center"><div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(17,24,39,0.2)] sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3">{modalCleaner.photoUrl?<img src={modalCleaner.photoUrl} alt={modalCleaner.displayName} className="h-16 w-16 rounded-full object-cover"/>:<div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(79,195,247,0.14)] text-[#4FC3F7]"><User size={22}/></div>}<div><p className="text-lg font-bold text-[#1A1A2E]">{modalCleaner.displayName}</p><p className="mt-1 text-sm text-[#6B7280]">{modalCleaner.description}</p></div></div><button type="button" onClick={()=>setModalCleaner(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280]"><X size={16}/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#E5E7EB] p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{t.modalServices}</p><div className="mt-2 flex flex-wrap gap-2">{modalCleaner.services.map((s)=><span key={`modal-s-${s}`} className="inline-flex rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-semibold text-[#4B5563]">{serviceLabels[s as ServiceId][language] ?? s}</span>)}</div></div><div className="rounded-2xl border border-[#E5E7EB] p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{t.modalZones}</p><div className="mt-2 flex flex-wrap gap-2">{modalCleaner.serviceAreas.slice(0,8).map((a)=><span key={`modal-z-${a.id}`} className="inline-flex rounded-full bg-[rgba(168,230,207,0.28)] px-2.5 py-1 text-xs font-semibold text-[#1A1A2E]">{a.zone}</span>)}</div></div></div><div className="mt-6 flex items-center justify-end gap-2"><button type="button" onClick={()=>setModalCleaner(null)} className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280]">{t.close}</button><button type="button" disabled={reservingId===modalCleaner.id} onClick={()=>void reserve(modalCleaner)} className="inline-flex min-w-[120px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white disabled:opacity-70">{reservingId===modalCleaner.id?<Loader2 size={14} className="animate-spin"/>:t.reserve}</button></div></div></div> : null}
    </div>
  );
}


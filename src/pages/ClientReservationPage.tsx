import { Calendar, Clock3, Home, Loader2, MapPin, Search, Sparkles, User, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
type CleanerCandidate = { id: string; displayName: string; description: string; photoUrl: string | null; services: string[]; serviceAreas: AreaSelection[]; availability: unknown; exceptions: unknown };

const services: ServiceId[] = ['domicile', 'deep_cleaning', 'office', 'moving', 'post_renovation', 'airbnb'];
const labels = {
  fr: {
    title: 'Reserver', subtitle: 'Choisissez adresse, service, date et heure avant les resultats.',
    step1: '1. Adresse', step2: '2. Service(s)', step3: '3. Date & heure', step4: '4. Nettoyeurs',
    addSpace: 'Ajouter un espace', noSpace: 'Vous devez ajouter un espace avant de reserver.',
    details: 'Details', reserve: 'Reserver', selected: 'Selectionne', noResult: 'Aucun nettoyeur compatible.',
    hint: 'Completer les etapes 1 a 3 pour afficher les nettoyeurs.',
    trust: 'Nouveau sur Nettoyo', zoneMatch: 'Zone compatible', avail: 'Disponible a cette date',
    modalServices: 'Services', modalZones: 'Zones', close: 'Fermer',
    reserveSuccess: 'Reservation creee.', reserveError: 'Impossible de reserver pour le moment.', loading: 'Chargement...'
  },
  en: {
    title: 'Book', subtitle: 'Choose address, service, date and time before results.',
    step1: '1. Address', step2: '2. Service(s)', step3: '3. Date & time', step4: '4. Cleaners',
    addSpace: 'Add a space', noSpace: 'You need a saved space before booking.',
    details: 'Details', reserve: 'Reserve', selected: 'Selected', noResult: 'No matching cleaner yet.',
    hint: 'Complete steps 1 to 3 to display cleaners.',
    trust: 'New on Nettoyo', zoneMatch: 'Zone match', avail: 'Available on this date',
    modalServices: 'Services', modalZones: 'Zones', close: 'Close',
    reserveSuccess: 'Booking created.', reserveError: 'Unable to book right now.', loading: 'Loading...'
  },
  es: {
    title: 'Reservar', subtitle: 'Elige direccion, servicio, fecha y hora antes de ver resultados.',
    step1: '1. Direccion', step2: '2. Servicio(s)', step3: '3. Fecha y hora', step4: '4. Limpiadores',
    addSpace: 'Agregar espacio', noSpace: 'Debes agregar un espacio antes de reservar.',
    details: 'Detalles', reserve: 'Reservar', selected: 'Seleccionado', noResult: 'Aun no hay limpiadores compatibles.',
    hint: 'Completa los pasos 1 a 3 para mostrar limpiadores.',
    trust: 'Nuevo en Nettoyo', zoneMatch: 'Zona compatible', avail: 'Disponible en esta fecha',
    modalServices: 'Servicios', modalZones: 'Zonas', close: 'Cerrar',
    reserveSuccess: 'Reserva creada.', reserveError: 'No se pudo reservar.', loading: 'Cargando...'
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
const toMinutes = (v: string) => { const m=v.match(/^(\d{1,2}):(\d{2})$/); if(!m)return null; return Number(m[1])*60+Number(m[2]); };
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
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [modalCleaner, setModalCleaner] = useState<CleanerCandidate | null>(null);
  const [reservingId, setReservingId] = useState<string | null>(null);

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
        return {
          id: row.id,
          displayName: name,
          description: (row.description?.trim() || 'Nettoyeur professionnel disponible localement.').slice(0, 120),
          photoUrl: identity?.avatar_url ?? row.photo_url,
          services: Array.isArray(row.services) ? row.services : [],
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

  const selectedSpace = useMemo(() => spaces.find((s) => s.id === selectedSpaceId) ?? null, [spaces, selectedSpaceId]);
  const selectedZone = useMemo(() => selectedSpace ? (selectedSpace.derived_zone || deriveZoneFromCityName(selectedSpace.city) || '') : '', [selectedSpace]);
  const ready = Boolean(selectedSpace && selectedServices.length > 0 && selectedDate && selectedTime);

  const matched = useMemo(() => {
    if (!ready || !selectedZone) return [];
    return cleaners.filter((cleaner) => {
      const zoneOk = cleaner.serviceAreas.some((a) => a.zone.toLowerCase() === selectedZone.toLowerCase() || a.name.toLowerCase() === selectedZone.toLowerCase());
      if (!zoneOk) return false;
      const serviceOk = cleaner.services.some((s) => selectedServices.includes(s as ServiceId));
      if (!serviceOk) return false;

      const weekly = cleaner.availability as Record<string, { enabled: boolean; start: string; end: string }> | null;
      if (!weekly || typeof weekly !== 'object') return true;
      const dt = new Date(`${selectedDate}T${selectedTime}:00`);
      if (Number.isNaN(dt.getTime())) return true;
      const day = weekly[weekday[dt.getDay()]];
      if (!day?.enabled) return false;
      return isWithin(selectedTime, day.start, day.end);
    });
  }, [cleaners, ready, selectedDate, selectedServices, selectedTime, selectedZone]);
  const reserve = async (cleaner: CleanerCandidate) => {
    if (!user?.id || !selectedSpace || !selectedDate || !selectedTime || selectedServices.length === 0) return;
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

            <section className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7"><h2 className="text-lg font-bold text-[#1A1A2E]">{t.step3}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="rounded-2xl border border-[#E5E7EB] px-4 py-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><Calendar size={13}/>Date</div><input type="date" value={selectedDate} min={new Date().toISOString().slice(0,10)} onChange={(e)=>setSelectedDate(e.target.value)} className="w-full bg-transparent text-sm font-semibold text-[#1A1A2E] outline-none"/></label><label className="rounded-2xl border border-[#E5E7EB] px-4 py-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><Clock3 size={13}/>Time</div><input type="time" value={selectedTime} onChange={(e)=>setSelectedTime(e.target.value)} className="w-full bg-transparent text-sm font-semibold text-[#1A1A2E] outline-none"/></label></div></section>

            <section className="mt-6 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#1A1A2E]">{t.step4}</h2><span className="inline-flex items-center gap-1 rounded-full bg-[rgba(79,195,247,0.12)] px-3 py-1 text-xs font-semibold text-[#0284C7]"><Search size={12}/>{t.hint}</span></div>{errorMessage?<div className="mb-4 rounded-xl bg-[rgba(239,68,68,0.1)] px-4 py-3 text-sm font-medium text-[#B91C1C]">{errorMessage}</div>:null}{!ready?<div className="rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-8 text-center text-sm text-[#6B7280]">{t.hint}</div>:matched.length===0?<div className="rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-5 py-8 text-center text-sm text-[#6B7280]">{t.noResult}</div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{matched.map((cleaner)=>{const showServices=cleaner.services.slice(0,4); return <article key={cleaner.id} className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-[0_14px_30px_rgba(17,24,39,0.06)]"><div className="flex items-start gap-3">{cleaner.photoUrl?<img src={cleaner.photoUrl} alt={cleaner.displayName} className="h-14 w-14 rounded-full object-cover"/>:<div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] text-[#4FC3F7]"><User size={20}/></div>}<div className="min-w-0"><p className="truncate text-base font-bold text-[#1A1A2E]">{cleaner.displayName}</p><p className="mt-1 line-clamp-2 text-sm text-[#6B7280]">{cleaner.description}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{showServices.map((s)=><span key={`${cleaner.id}-${s}`} className="inline-flex rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]">{serviceLabels[s as ServiceId][language] ?? s}</span>)}</div><div className="mt-4 space-y-2 text-xs text-[#6B7280]"><p className="inline-flex items-center gap-1 rounded-full bg-[rgba(168,230,207,0.32)] px-2.5 py-1 font-semibold text-[#1A1A2E]"><MapPin size={12}/>{t.zoneMatch}</p><p className="inline-flex items-center gap-1 rounded-full bg-[rgba(79,195,247,0.12)] px-2.5 py-1 font-semibold text-[#0284C7]"><Clock3 size={12}/>{t.avail}</p></div><p className="mt-4 inline-flex items-center gap-1 rounded-full bg-[rgba(79,195,247,0.12)] px-2.5 py-1 text-xs font-semibold text-[#0284C7]"><Sparkles size={12}/>{t.trust}</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setModalCleaner(cleaner)} className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#1A1A2E]">{t.details}</button><button type="button" disabled={reservingId===cleaner.id} onClick={()=>void reserve(cleaner)} className="inline-flex items-center justify-center rounded-full bg-[#4FC3F7] px-3 py-2 text-sm font-semibold text-white disabled:opacity-70">{reservingId===cleaner.id?<Loader2 size={14} className="animate-spin"/>:t.reserve}</button></div></article>;})}</div>}</section>
          </>
        )}
      </div>
      {modalCleaner ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 px-4 py-4 sm:items-center"><div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(17,24,39,0.2)] sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3">{modalCleaner.photoUrl?<img src={modalCleaner.photoUrl} alt={modalCleaner.displayName} className="h-16 w-16 rounded-full object-cover"/>:<div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(79,195,247,0.14)] text-[#4FC3F7]"><User size={22}/></div>}<div><p className="text-lg font-bold text-[#1A1A2E]">{modalCleaner.displayName}</p><p className="mt-1 text-sm text-[#6B7280]">{modalCleaner.description}</p></div></div><button type="button" onClick={()=>setModalCleaner(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280]"><X size={16}/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#E5E7EB] p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{t.modalServices}</p><div className="mt-2 flex flex-wrap gap-2">{modalCleaner.services.map((s)=><span key={`modal-s-${s}`} className="inline-flex rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-semibold text-[#4B5563]">{serviceLabels[s as ServiceId][language] ?? s}</span>)}</div></div><div className="rounded-2xl border border-[#E5E7EB] p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9CA3AF]">{t.modalZones}</p><div className="mt-2 flex flex-wrap gap-2">{modalCleaner.serviceAreas.slice(0,8).map((a)=><span key={`modal-z-${a.id}`} className="inline-flex rounded-full bg-[rgba(168,230,207,0.28)] px-2.5 py-1 text-xs font-semibold text-[#1A1A2E]">{a.zone}</span>)}</div></div></div><div className="mt-6 flex items-center justify-end gap-2"><button type="button" onClick={()=>setModalCleaner(null)} className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280]">{t.close}</button><button type="button" disabled={reservingId===modalCleaner.id} onClick={()=>void reserve(modalCleaner)} className="inline-flex min-w-[120px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white disabled:opacity-70">{reservingId===modalCleaner.id?<Loader2 size={14} className="animate-spin"/>:t.reserve}</button></div></div></div> : null}
    </div>
  );
}

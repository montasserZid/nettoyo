import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronUp,
  Check,
  Clock3,
  Home,
  Paintbrush,
  Plus,
  Sparkles,
  Trash2,
  Truck,
  UserCircle2,
  Wand2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

type CleanerServiceId = 'domicile' | 'deep_cleaning' | 'office' | 'moving' | 'post_renovation' | 'airbnb';
type WeekdayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type ExceptionMode = 'all_day' | 'partial';

type ServiceOption = { id: CleanerServiceId; icon: typeof Home };
type WeeklyAvailabilityDay = { enabled: boolean; start: string; end: string };
type WeeklyAvailability = Record<WeekdayKey, WeeklyAvailabilityDay>;
type AvailabilityException = { id: string; date: string; mode: ExceptionMode; start: string; end: string };
type StoredCleanerProfile = {
  description?: string;
  services?: CleanerServiceId[];
  photoDataUrl?: string | null;
  weekly_availability?: WeeklyAvailability;
  availability_exceptions?: AvailabilityException[];
};

const serviceOptions: ServiceOption[] = [
  { id: 'domicile', icon: Home },
  { id: 'deep_cleaning', icon: Sparkles },
  { id: 'office', icon: Briefcase },
  { id: 'moving', icon: Truck },
  { id: 'post_renovation', icon: Paintbrush },
  { id: 'airbnb', icon: Building2 }
];

const weekdayOrder: WeekdayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const defaultWeeklyAvailability: WeeklyAvailability = {
  monday: { enabled: true, start: '06:00', end: '16:00' },
  tuesday: { enabled: true, start: '06:00', end: '16:00' },
  wednesday: { enabled: true, start: '06:00', end: '16:00' },
  thursday: { enabled: true, start: '06:00', end: '16:00' },
  friday: { enabled: true, start: '06:00', end: '16:00' },
  saturday: { enabled: true, start: '06:00', end: '16:00' },
  sunday: { enabled: true, start: '06:00', end: '16:00' }
};

const contentByLanguage = {
  fr: {
    pageBadge: 'Espace nettoyeur',
    pageTitle: 'Mon profil professionnel',
    pageIntro: 'Decrivez votre expertise, vos services et vos disponibilites pour aider les clients a reserver facilement.',
    publicPreview: 'Apercu public',
    publicPreviewHelp: 'Votre profil sera utilise pour presenter vos prestations aux clients.',
    saveSuccess: 'Profil mis a jour avec succes',
    saveButton: 'Enregistrer le profil',
    selectedServices: 'service(s) selectionne(s)',
    saveHint: 'Donnees preparees pour integration Supabase',
    photoTitle: 'Photo de profil',
    photoHelp: 'Optionnelle mais recommandee',
    addPhoto: 'Ajouter une photo',
    changePhoto: 'Changer la photo',
    removePhoto: 'Retirer',
    descriptionTitle: 'Description professionnelle',
    descriptionHelp: 'Parlez de votre experience, de vos specialites et de votre methode de travail.',
    descriptionPlaceholder:
      'Exemple: Plus de 5 ans d experience, specialise en menage residentiel et Airbnb. Ponctuelle, minutieuse et equipee pour les interventions en profondeur.',
    servicesTitle: 'Services proposes',
    servicesHelp: 'Selectionnez les prestations que vous acceptez actuellement.',
    availabilityTitle: 'Disponibilite hebdomadaire',
    availabilityHelp: 'Activez les jours travailles et definissez vos horaires pour chaque jour.',
    unavailableDay: 'Indisponible',
    start: 'Debut',
    end: 'Fin',
    exceptionsTitle: 'Exceptions de disponibilite',
    exceptionsHelp: 'Ajoutez des dates indisponibles en journee complete ou sur un horaire partiel.',
    exceptionDate: 'Date',
    exceptionMode: 'Mode',
    allDayUnavailable: 'Indisponible toute la journee',
    partialUnavailable: 'Indisponible sur un horaire',
    addException: 'Ajouter exception',
    noExceptions: 'Aucune exception ajoutee',
    removeException: 'Supprimer',
    invalidException: "Veuillez completer la date et l'horaire de l'exception."
  },
  en: {
    pageBadge: 'Cleaner Workspace',
    pageTitle: 'My professional profile',
    pageIntro: 'Describe your expertise, services, and availability so clients can book with confidence.',
    publicPreview: 'Public preview',
    publicPreviewHelp: 'Your profile will be used to present your services to clients.',
    saveSuccess: 'Profile updated successfully',
    saveButton: 'Save profile',
    selectedServices: 'service(s) selected',
    saveHint: 'Data prepared for Supabase integration',
    photoTitle: 'Profile photo',
    photoHelp: 'Optional but recommended',
    addPhoto: 'Add photo',
    changePhoto: 'Change photo',
    removePhoto: 'Remove',
    descriptionTitle: 'Professional description',
    descriptionHelp: 'Highlight your experience, specialties, and working style.',
    descriptionPlaceholder:
      'Example: 5+ years of experience, specialized in residential and Airbnb cleaning. Reliable, detail-oriented, and equipped for deep cleaning sessions.',
    servicesTitle: 'Services offered',
    servicesHelp: 'Select all services you currently offer.',
    availabilityTitle: 'Weekly availability',
    availabilityHelp: 'Enable working days and set start/end hours for each day.',
    unavailableDay: 'Unavailable',
    start: 'Start',
    end: 'End',
    exceptionsTitle: 'Date exceptions',
    exceptionsHelp: 'Add unavailable dates as full-day or partial time-range blocks.',
    exceptionDate: 'Date',
    exceptionMode: 'Mode',
    allDayUnavailable: 'Unavailable all day',
    partialUnavailable: 'Unavailable in a time range',
    addException: 'Add exception',
    noExceptions: 'No exceptions added',
    removeException: 'Remove',
    invalidException: 'Please complete exception date and time range.'
  },
  es: {
    pageBadge: 'Espacio limpiador',
    pageTitle: 'Mi perfil profesional',
    pageIntro: 'Describe tu experiencia, servicios y disponibilidad para que los clientes reserven con confianza.',
    publicPreview: 'Vista publica',
    publicPreviewHelp: 'Tu perfil se usara para presentar tus servicios a los clientes.',
    saveSuccess: 'Perfil actualizado con exito',
    saveButton: 'Guardar perfil',
    selectedServices: 'servicio(s) seleccionado(s)',
    saveHint: 'Datos listos para integracion con Supabase',
    photoTitle: 'Foto de perfil',
    photoHelp: 'Opcional pero recomendada',
    addPhoto: 'Agregar foto',
    changePhoto: 'Cambiar foto',
    removePhoto: 'Quitar',
    descriptionTitle: 'Descripcion profesional',
    descriptionHelp: 'Destaca tu experiencia, especialidades y forma de trabajar.',
    descriptionPlaceholder:
      'Ejemplo: Mas de 5 anos de experiencia, especializada en limpieza residencial y Airbnb. Puntual, detallista y preparada para limpiezas profundas.',
    servicesTitle: 'Servicios ofrecidos',
    servicesHelp: 'Selecciona todos los servicios que ofreces actualmente.',
    availabilityTitle: 'Disponibilidad semanal',
    availabilityHelp: 'Activa los dias laborales y define horarios de inicio y fin por dia.',
    unavailableDay: 'No disponible',
    start: 'Inicio',
    end: 'Fin',
    exceptionsTitle: 'Excepciones por fecha',
    exceptionsHelp: 'Agrega fechas no disponibles de dia completo o por rango horario.',
    exceptionDate: 'Fecha',
    exceptionMode: 'Modo',
    allDayUnavailable: 'No disponible todo el dia',
    partialUnavailable: 'No disponible en un rango horario',
    addException: 'Agregar excepcion',
    noExceptions: 'No hay excepciones agregadas',
    removeException: 'Eliminar',
    invalidException: 'Completa la fecha y el rango horario de la excepcion.'
  }
} as const;

const weekdayLabelByLanguage: Record<'fr' | 'en' | 'es', Record<WeekdayKey, string>> = {
  fr: { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' },
  en: { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' },
  es: { monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miercoles', thursday: 'Jueves', friday: 'Viernes', saturday: 'Sabado', sunday: 'Domingo' }
};

const serviceLabelByLanguage: Record<'fr' | 'en' | 'es', Record<CleanerServiceId, { title: string; description: string }>> = {
  fr: {
    domicile: { title: 'Domicile', description: 'Maisons et appartements' },
    deep_cleaning: { title: 'Nettoyage en profondeur', description: 'Interventions intensives' },
    office: { title: 'Bureau', description: 'Espaces professionnels' },
    moving: { title: 'Demenagement', description: 'Entree / sortie de logement' },
    post_renovation: { title: 'Post-renovation', description: 'Poussiere et finitions' },
    airbnb: { title: 'Airbnb', description: 'Rotation rapide et fiable' }
  },
  en: {
    domicile: { title: 'Home', description: 'Houses and apartments' },
    deep_cleaning: { title: 'Deep cleaning', description: 'Intensive sessions' },
    office: { title: 'Office', description: 'Professional spaces' },
    moving: { title: 'Moving', description: 'Move-in / move-out cleaning' },
    post_renovation: { title: 'Post-renovation', description: 'Dust and finishing cleanup' },
    airbnb: { title: 'Airbnb', description: 'Fast, reliable turnovers' }
  },
  es: {
    domicile: { title: 'Domicilio', description: 'Casas y apartamentos' },
    deep_cleaning: { title: 'Limpieza profunda', description: 'Intervenciones intensivas' },
    office: { title: 'Oficina', description: 'Espacios profesionales' },
    moving: { title: 'Mudanza', description: 'Limpieza de entrada / salida' },
    post_renovation: { title: 'Post-renovacion', description: 'Polvo y acabados' },
    airbnb: { title: 'Airbnb', description: 'Rotacion rapida y confiable' }
  }
};

function getCleanerStorageKey(userId?: string) {
  return `nettoyo-cleaner-profile-${userId ?? 'anonymous'}`;
}

function isValidWeeklyAvailability(value: unknown): value is WeeklyAvailability {
  if (!value || typeof value !== 'object') return false;
  return weekdayOrder.every((day) => {
    const dayData = (value as Record<WeekdayKey, WeeklyAvailabilityDay>)[day];
    return Boolean(dayData && typeof dayData.enabled === 'boolean' && typeof dayData.start === 'string' && typeof dayData.end === 'string');
  });
}

function isValidException(value: unknown): value is AvailabilityException {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as AvailabilityException;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.date === 'string' &&
    (candidate.mode === 'all_day' || candidate.mode === 'partial') &&
    typeof candidate.start === 'string' &&
    typeof candidate.end === 'string'
  );
}

type Meridiem = 'AM' | 'PM';

type TimeParts = {
  hour12: number;
  minute: number;
  meridiem: Meridiem;
};

function toTimeParts(value: string): TimeParts {
  const [rawHour, rawMinute] = value.split(':');
  const hour24 = Number.parseInt(rawHour ?? '0', 10);
  const minute = Number.parseInt(rawMinute ?? '0', 10);
  const meridiem: Meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour24 % 12;
  return {
    hour12: normalizedHour === 0 ? 12 : normalizedHour,
    minute: Number.isNaN(minute) ? 0 : Math.min(59, Math.max(0, minute)),
    meridiem
  };
}

function fromTimeParts(parts: TimeParts): string {
  const normalizedHour12 = Math.min(12, Math.max(1, parts.hour12));
  const normalizedMinute = Math.min(59, Math.max(0, parts.minute));
  const hour24 = parts.meridiem === 'PM' ? (normalizedHour12 % 12) + 12 : normalizedHour12 % 12;
  return `${String(hour24).padStart(2, '0')}:${String(normalizedMinute).padStart(2, '0')}`;
}

function TimeStepControl({
  value,
  onChange,
  disabled = false
}: {
  value: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
}) {
  const timeParts = toTimeParts(value);

  const update = (patch: Partial<TimeParts>) => {
    onChange(fromTimeParts({ ...timeParts, ...patch }));
  };

  const adjustHour = (delta: number) => {
    const nextHour = ((timeParts.hour12 - 1 + delta + 12) % 12) + 1;
    update({ hour12: nextHour });
  };

  const adjustMinute = (delta: number) => {
    const step = 5;
    const totalMinutes = (timeParts.minute + delta * step + 60) % 60;
    update({ minute: totalMinutes });
  };

  const toggleMeridiem = () => {
    update({ meridiem: timeParts.meridiem === 'AM' ? 'PM' : 'AM' });
  };

  const buttonBase =
    'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#C9E6F7] bg-white text-[#0284C7] shadow-[0_2px_5px_rgba(17,24,39,0.08)] transition-all hover:-translate-y-[1px] hover:border-[#4FC3F7] hover:bg-[#F0FAFF] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0';

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-[#FCFCFD] px-2.5 py-1.5 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-1">
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustHour(1)} aria-label="hour-up">
          <ChevronUp size={13} />
        </button>
        <span className="min-w-6 text-center text-sm font-semibold text-[#1A1A2E]">{String(timeParts.hour12).padStart(2, '0')}</span>
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustHour(-1)} aria-label="hour-down">
          <ChevronDown size={13} />
        </button>
      </div>

      <span className="text-sm font-semibold text-[#6B7280]">:</span>

      <div className="flex items-center gap-1">
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustMinute(1)} aria-label="minute-up">
          <ChevronUp size={13} />
        </button>
        <span className="min-w-6 text-center text-sm font-semibold text-[#1A1A2E]">{String(timeParts.minute).padStart(2, '0')}</span>
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustMinute(-1)} aria-label="minute-down">
          <ChevronDown size={13} />
        </button>
      </div>

      <div className="ml-3 flex items-center gap-1.5 border-l border-[#E5E7EB] pl-3">
        <button type="button" disabled={disabled} className={buttonBase} onClick={toggleMeridiem} aria-label="meridiem-up">
          <ChevronUp size={13} />
        </button>
        <span className="min-w-8 text-center text-xs font-bold tracking-[0.08em] text-[#1A1A2E]">{timeParts.meridiem}</span>
        <button type="button" disabled={disabled} className={buttonBase} onClick={toggleMeridiem} aria-label="meridiem-down">
          <ChevronDown size={13} />
        </button>
      </div>
    </div>
  );
}

export function CleanerDashboardPage() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const content = contentByLanguage[language];
  const weekdayLabels = weekdayLabelByLanguage[language];
  const serviceLabels = serviceLabelByLanguage[language];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [description, setDescription] = useState('');
  const [selectedServices, setSelectedServices] = useState<CleanerServiceId[]>([]);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>(defaultWeeklyAvailability);
  const [availabilityExceptions, setAvailabilityExceptions] = useState<AvailabilityException[]>([]);
  const [exceptionDraftDate, setExceptionDraftDate] = useState('');
  const [exceptionDraftMode, setExceptionDraftMode] = useState<ExceptionMode>('all_day');
  const [exceptionDraftStart, setExceptionDraftStart] = useState('06:00');
  const [exceptionDraftEnd, setExceptionDraftEnd] = useState('16:00');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState(false);

  const storageKey = useMemo(() => getCleanerStorageKey(user?.id), [user?.id]);
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'Nettoyo';
  const email = user?.email || profile?.email || '';

  useEffect(() => {
    const savedRaw = window.localStorage.getItem(storageKey);
    if (!savedRaw) {
      setDescription('');
      setSelectedServices([]);
      setPhotoDataUrl(profile?.avatar_url ?? null);
      setWeeklyAvailability(defaultWeeklyAvailability);
      setAvailabilityExceptions([]);
      return;
    }

    try {
      const saved = JSON.parse(savedRaw) as StoredCleanerProfile;
      setDescription(saved.description ?? '');
      setSelectedServices(saved.services ?? []);
      setPhotoDataUrl(saved.photoDataUrl ?? profile?.avatar_url ?? null);
      setWeeklyAvailability(isValidWeeklyAvailability(saved.weekly_availability) ? saved.weekly_availability : defaultWeeklyAvailability);
      setAvailabilityExceptions(Array.isArray(saved.availability_exceptions) ? saved.availability_exceptions.filter(isValidException) : []);
    } catch {
      setDescription('');
      setSelectedServices([]);
      setPhotoDataUrl(profile?.avatar_url ?? null);
      setWeeklyAvailability(defaultWeeklyAvailability);
      setAvailabilityExceptions([]);
    }
  }, [profile?.avatar_url, storageKey]);

  useEffect(() => {
    if (!saveToast) return;
    const timer = window.setTimeout(() => setSaveToast(false), 2400);
    return () => window.clearTimeout(timer);
  }, [saveToast]);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = window.setTimeout(() => setErrorMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [errorMessage]);

  const toggleService = (serviceId: CleanerServiceId) => {
    setSelectedServices((current) => (current.includes(serviceId) ? current.filter((item) => item !== serviceId) : [...current, serviceId]));
  };

  const updateWeeklyAvailability = (day: WeekdayKey, patch: Partial<WeeklyAvailabilityDay>) => {
    setWeeklyAvailability((current) => ({
      ...current,
      [day]: { ...current[day], ...patch }
    }));
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const handlePhotoRemove = () => {
    setPhotoDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addException = () => {
    if (!exceptionDraftDate) {
      setErrorMessage(content.invalidException);
      return;
    }
    if (exceptionDraftMode === 'partial' && (!exceptionDraftStart || !exceptionDraftEnd || exceptionDraftStart >= exceptionDraftEnd)) {
      setErrorMessage(content.invalidException);
      return;
    }
    const newException: AvailabilityException = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: exceptionDraftDate,
      mode: exceptionDraftMode,
      start: exceptionDraftMode === 'partial' ? exceptionDraftStart : '00:00',
      end: exceptionDraftMode === 'partial' ? exceptionDraftEnd : '23:59'
    };
    setAvailabilityExceptions((current) => [...current, newException].sort((a, b) => a.date.localeCompare(b.date)));
    setExceptionDraftDate('');
    setExceptionDraftMode('all_day');
    setExceptionDraftStart('06:00');
    setExceptionDraftEnd('16:00');
    setErrorMessage(null);
  };

  const removeException = (id: string) => {
    setAvailabilityExceptions((current) => current.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    const payload: StoredCleanerProfile = {
      description: description.trim(),
      services: selectedServices,
      photoDataUrl,
      weekly_availability: weeklyAvailability,
      availability_exceptions: availabilityExceptions
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    setSaveToast(true);
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#F7F7F7] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {saveToast ? (
          <div className="fixed right-4 top-24 z-50 rounded-full bg-[#1A1A2E] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(17,24,39,0.2)]">
            {content.saveSuccess}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[rgba(239,68,68,0.14)] px-4 py-2 text-sm font-semibold text-[#B91C1C] shadow-[0_12px_24px_rgba(17,24,39,0.12)]">
            {errorMessage}
          </div>
        ) : null}

        <section className="rounded-[28px] bg-white px-6 py-8 shadow-[0_16px_36px_rgba(17,24,39,0.07)] sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4FC3F7]">{content.pageBadge}</p>
          <h1 className="mt-2 text-3xl font-bold text-[#1A1A2E]">{content.pageTitle}</h1>
          <p className="mt-3 max-w-3xl text-[#6B7280]">{content.pageIntro}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[rgba(168,230,207,0.35)] px-4 py-2 text-sm font-semibold text-[#1A1A2E]">
            <UserCircle2 size={16} />
            {displayName} {email ? `· ${email}` : ''}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
          <aside className="space-y-6">
            <section className="rounded-[24px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)]">
              <h2 className="text-lg font-bold text-[#1A1A2E]">{content.photoTitle}</h2>
              <p className="mt-2 text-sm text-[#6B7280]">{content.photoHelp}</p>

              <div className="mt-5 flex justify-center">
                {photoDataUrl ? (
                  <img
                    src={photoDataUrl}
                    alt="Cleaner profile"
                    className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-[0_16px_32px_rgba(79,195,247,0.24)]"
                  />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[#4FC3F7] to-[#A8E6CF] text-white shadow-[0_16px_32px_rgba(79,195,247,0.24)]">
                    <Camera size={34} />
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:flex-col">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#4FC3F7] px-5 py-3 font-semibold text-white shadow-[0_12px_24px_rgba(79,195,247,0.25)] transition-all hover:bg-[#3FAAD4]"
                >
                  <Camera size={16} />
                  {photoDataUrl ? content.changePhoto : content.addPhoto}
                </button>
                {photoDataUrl ? (
                  <button
                    type="button"
                    onClick={handlePhotoRemove}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#E5E7EB] px-5 py-3 font-semibold text-[#6B7280] transition-colors hover:bg-[#F7F7F7]"
                  >
                    <X size={16} />
                    {content.removePhoto}
                  </button>
                ) : null}
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </section>

            <section className="rounded-[24px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)]">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#4FC3F7]">{content.publicPreview}</h3>
              <p className="mt-2 text-sm text-[#6B7280]">{content.publicPreviewHelp}</p>
            </section>
          </aside>

          <main className="space-y-6">
            <section className="rounded-[24px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="flex items-center gap-2">
                <Wand2 size={18} className="text-[#4FC3F7]" />
                <h2 className="text-xl font-bold text-[#1A1A2E]">{content.descriptionTitle}</h2>
              </div>
              <p className="mt-2 text-sm text-[#6B7280]">{content.descriptionHelp}</p>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                placeholder={content.descriptionPlaceholder}
                className="mt-4 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-[#1A1A2E] outline-none transition-all placeholder:text-[#9CA3AF] focus:border-[#4FC3F7] focus:shadow-[0_0_0_4px_rgba(79,195,247,0.12)]"
              />
              <p className="mt-2 text-right text-xs text-[#9CA3AF]">{description.length}/1200</p>
            </section>

            <section className="rounded-[24px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7">
              <h2 className="text-xl font-bold text-[#1A1A2E]">{content.servicesTitle}</h2>
              <p className="mt-2 text-sm text-[#6B7280]">{content.servicesHelp}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {serviceOptions.map((service) => {
                  const selected = selectedServices.includes(service.id);
                  const Icon = service.icon;
                  const labels = serviceLabels[service.id];
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleService(service.id)}
                      className={`group relative rounded-2xl border p-4 text-left transition-all ${
                        selected
                          ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.08)] shadow-[0_0_0_3px_rgba(79,195,247,0.12)]'
                          : 'border-[#E5E7EB] bg-white hover:border-[#BFE9FB] hover:bg-[#FBFDFF]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                            selected ? 'bg-[#4FC3F7] text-white' : 'bg-[rgba(79,195,247,0.14)] text-[#4FC3F7]'
                          }`}
                        >
                          <Icon size={18} />
                        </span>
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                            selected
                              ? 'border-[#4FC3F7] bg-[#4FC3F7] text-white'
                              : 'border-[#D1D5DB] bg-white text-transparent group-hover:border-[#4FC3F7]'
                          }`}
                        >
                          <Check size={14} />
                        </span>
                      </div>
                      <p className="mt-3 font-semibold text-[#1A1A2E]">{labels.title}</p>
                      <p className="mt-1 text-xs text-[#6B7280]">{labels.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[24px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="flex items-center gap-2">
                <Clock3 size={18} className="text-[#4FC3F7]" />
                <h2 className="text-xl font-bold text-[#1A1A2E]">{content.availabilityTitle}</h2>
              </div>
              <p className="mt-2 text-sm text-[#6B7280]">{content.availabilityHelp}</p>

              <div className="mt-5 space-y-3">
                {weekdayOrder.map((day) => {
                  const value = weeklyAvailability[day];
                  return (
                    <div key={day} className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-[#1A1A2E]">{weekdayLabels[day]}</p>
                          <button
                            type="button"
                            onClick={() => updateWeeklyAvailability(day, { enabled: !value.enabled })}
                            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-all ${
                              value.enabled
                                ? 'border-[#4FC3F7] bg-[#4FC3F7] shadow-[0_0_0_4px_rgba(79,195,247,0.18)]'
                                : 'border-[#D1D5DB] bg-[#E5E7EB]'
                            }`}
                            aria-label={`toggle-${day}`}
                          >
                            <span
                              className={`absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#1A1A2E] shadow-[0_4px_10px_rgba(17,24,39,0.22)] transition-transform ${
                                value.enabled ? 'translate-x-7' : 'translate-x-0.5'
                              }`}
                            >
                              {value.enabled ? <Check size={12} /> : <X size={12} />}
                            </span>
                          </button>
                        </div>

                        {value.enabled ? (
                          <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-3">
                            <label className="text-xs font-semibold text-[#6B7280]">
                              {content.start}
                              <div className="mt-1">
                                <TimeStepControl
                                  value={value.start}
                                  onChange={(nextValue) => updateWeeklyAvailability(day, { start: nextValue })}
                                />
                              </div>
                            </label>
                            <label className="text-xs font-semibold text-[#6B7280]">
                              {content.end}
                              <div className="mt-1">
                                <TimeStepControl
                                  value={value.end}
                                  onChange={(nextValue) => updateWeeklyAvailability(day, { end: nextValue })}
                                />
                              </div>
                            </label>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-[rgba(229,231,235,0.65)] px-3 py-1 text-xs font-semibold text-[#6B7280]">
                            {content.unavailableDay}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[24px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:p-7">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-[#4FC3F7]" />
                <h2 className="text-xl font-bold text-[#1A1A2E]">{content.exceptionsTitle}</h2>
              </div>
              <p className="mt-2 text-sm text-[#6B7280]">{content.exceptionsHelp}</p>

              <div className="mt-4 rounded-2xl border border-[#E5E7EB] p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs font-semibold text-[#6B7280]">
                    {content.exceptionDate}
                    <input
                      type="date"
                      value={exceptionDraftDate}
                      onChange={(event) => setExceptionDraftDate(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm text-[#1A1A2E] outline-none focus:border-[#4FC3F7] focus:shadow-[0_0_0_3px_rgba(79,195,247,0.12)]"
                    />
                  </label>
                  <div className="rounded-2xl border border-[#E5E7EB] bg-[#FBFDFF] p-2">
                    <p className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#6B7280]">{content.exceptionMode}</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setExceptionDraftMode('all_day')}
                        className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                          exceptionDraftMode === 'all_day'
                            ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.10)] text-[#0284C7] shadow-[0_0_0_3px_rgba(79,195,247,0.16)]'
                            : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#BFE9FB]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays size={14} />
                          {content.allDayUnavailable}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExceptionDraftMode('partial')}
                        className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                          exceptionDraftMode === 'partial'
                            ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.10)] text-[#0284C7] shadow-[0_0_0_3px_rgba(79,195,247,0.16)]'
                            : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#BFE9FB]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Clock3 size={14} />
                          {content.partialUnavailable}
                        </span>
                      </button>
                    </div>
                  </div>
                  {exceptionDraftMode === 'partial' ? (
                    <>
                      <label className="text-xs font-semibold text-[#6B7280]">
                        {content.start}
                        <div className="mt-1">
                          <TimeStepControl
                            value={exceptionDraftStart}
                            onChange={setExceptionDraftStart}
                          />
                        </div>
                      </label>
                      <label className="text-xs font-semibold text-[#6B7280]">
                        {content.end}
                        <div className="mt-1">
                          <TimeStepControl
                            value={exceptionDraftEnd}
                            onChange={setExceptionDraftEnd}
                          />
                        </div>
                      </label>
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={addException}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#1A1A2E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#111827]"
                >
                  <Plus size={14} />
                  {content.addException}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {availabilityExceptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#D1D5DB] px-4 py-6 text-center text-sm text-[#6B7280]">
                    {content.noExceptions}
                  </div>
                ) : (
                  availabilityExceptions.map((entry) => (
                    <div key={entry.id} className="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-[#1A1A2E]">{entry.date}</p>
                        <p className="mt-1 text-sm text-[#6B7280]">
                          {entry.mode === 'all_day' ? content.allDayUnavailable : `${content.partialUnavailable}: ${entry.start} - ${entry.end}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeException(entry.id)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] transition-colors hover:bg-[#F7F7F7]"
                      >
                        <Trash2 size={14} />
                        {content.removeException}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="sticky bottom-4 rounded-[24px] border border-[#E5E7EB] bg-white/95 p-4 shadow-[0_18px_34px_rgba(17,24,39,0.10)] backdrop-blur sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A2E]">
                    {selectedServices.length} {content.selectedServices}
                  </p>
                  <p className="text-xs text-[#6B7280]">{content.saveHint}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center justify-center rounded-full bg-[#4FC3F7] px-6 py-3 font-semibold text-white shadow-[0_12px_24px_rgba(79,195,247,0.25)] transition-all hover:bg-[#3FAAD4]"
                >
                  {content.saveButton}
                </button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

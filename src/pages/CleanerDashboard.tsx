import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, Building2, CalendarDays, Camera, ChevronDown, ChevronUp, Check, Clock3, Home, Paintbrush, Plus, Sparkles, Trash2, Truck, CircleUser as UserCircle2, Wand2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { convertToWebP } from '../lib/imageUtils';
import supabase from '../lib/supabase';

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
type CleanerProfileRow = {
  description: string | null;
  services: string[] | null;
  photo_url: string | null;
  weekly_availability: unknown;
  availability_exceptions: unknown;
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
    profileLoading: 'Chargement du profil...',
    photoTitle: 'Photo de profil',
    photoHelp: 'Optionnelle mais recommandee',
    addPhoto: 'Ajouter une photo',
    changePhoto: 'Changer la photo',
    removePhoto: 'Retirer',
    chooseFromGallery: 'Choisir depuis le telephone',
    takePhoto: 'Prendre une photo',
    photoSourceTitle: 'Ajouter une photo',
    photoSourceHelp: 'Choisissez une photo existante ou ouvrez la camera.',
    close: 'Fermer',
    viewPhoto: 'Voir la photo',
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
    invalidException: "Veuillez completer la date et l'horaire de l'exception.",
    saveError: 'Impossible de sauvegarder le profil pour le moment.',
    loadError: 'Impossible de charger le profil enregistre.'
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
    profileLoading: 'Loading profile...',
    photoTitle: 'Profile photo',
    photoHelp: 'Optional but recommended',
    addPhoto: 'Add photo',
    changePhoto: 'Change photo',
    removePhoto: 'Remove',
    chooseFromGallery: 'Choose from device',
    takePhoto: 'Take a photo',
    photoSourceTitle: 'Add a photo',
    photoSourceHelp: 'Choose an existing picture or open the camera.',
    close: 'Close',
    viewPhoto: 'View photo',
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
    invalidException: 'Please complete exception date and time range.',
    saveError: 'Unable to save the profile right now.',
    loadError: 'Unable to load the saved profile.'
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
    profileLoading: 'Cargando perfil...',
    photoTitle: 'Foto de perfil',
    photoHelp: 'Opcional pero recomendada',
    addPhoto: 'Agregar foto',
    changePhoto: 'Cambiar foto',
    removePhoto: 'Quitar',
    chooseFromGallery: 'Elegir desde el telefono',
    takePhoto: 'Tomar una foto',
    photoSourceTitle: 'Agregar una foto',
    photoSourceHelp: 'Elige una foto existente o abre la camara.',
    close: 'Cerrar',
    viewPhoto: 'Ver foto',
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
    invalidException: 'Completa la fecha y el rango horario de la excepcion.',
    saveError: 'No se puede guardar el perfil en este momento.',
    loadError: 'No se puede cargar el perfil guardado.'
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

function isCleanerServiceId(value: string): value is CleanerServiceId {
  return serviceOptions.some((option) => option.id === value);
}

function normalizeCleanerProfile(
  row: CleanerProfileRow | null,
  fallbackAvatarUrl: string | null,
  fallbackLocalProfile?: StoredCleanerProfile | null
) {
  const sourceDescription = row?.description ?? fallbackLocalProfile?.description ?? '';
  const sourceServices = row?.services ?? fallbackLocalProfile?.services ?? [];
  const sourcePhoto = row?.photo_url ?? fallbackLocalProfile?.photoDataUrl ?? fallbackAvatarUrl ?? null;
  const sourceWeeklyAvailability = row?.weekly_availability ?? fallbackLocalProfile?.weekly_availability;
  const sourceExceptions = row?.availability_exceptions ?? fallbackLocalProfile?.availability_exceptions;

  const services = Array.isArray(sourceServices) ? sourceServices.filter(isCleanerServiceId) : [];
  const weeklyAvailability = isValidWeeklyAvailability(sourceWeeklyAvailability)
    ? sourceWeeklyAvailability
    : defaultWeeklyAvailability;
  const availabilityExceptions = Array.isArray(sourceExceptions) ? sourceExceptions.filter(isValidException) : [];

  return {
    description: sourceDescription,
    services,
    photoDataUrl: sourcePhoto,
    weeklyAvailability,
    availabilityExceptions
  };
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
    'inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#4FC3F7] transition-all hover:border-[#4FC3F7] hover:bg-[#F0FAFF] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E5E7EB] disabled:hover:bg-white';

  return (
    <div
      className={`inline-flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 shadow-sm ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-0.5">
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustHour(1)} aria-label="hour-up">
          <ChevronUp size={12} strokeWidth={2.5} />
        </button>
        <span className="mx-1 min-w-[28px] text-center text-sm font-bold text-[#1A1A2E]">{String(timeParts.hour12).padStart(2, '0')}</span>
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustHour(-1)} aria-label="hour-down">
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>
      </div>

      <span className="text-sm font-bold text-[#6B7280]">:</span>

      <div className="flex items-center gap-0.5">
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustMinute(1)} aria-label="minute-up">
          <ChevronUp size={12} strokeWidth={2.5} />
        </button>
        <span className="mx-1 min-w-[28px] text-center text-sm font-bold text-[#1A1A2E]">{String(timeParts.minute).padStart(2, '0')}</span>
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustMinute(-1)} aria-label="minute-down">
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>
      </div>

      <div className="ml-1 flex items-center gap-0.5 border-l border-[#E5E7EB] pl-2">
        <button type="button" disabled={disabled} className={buttonBase} onClick={toggleMeridiem} aria-label="meridiem-up">
          <ChevronUp size={12} strokeWidth={2.5} />
        </button>
        <span className="mx-1 min-w-[32px] text-center text-xs font-bold tracking-wider text-[#1A1A2E]">{timeParts.meridiem}</span>
        <button type="button" disabled={disabled} className={buttonBase} onClick={toggleMeridiem} aria-label="meridiem-down">
          <ChevronDown size={12} strokeWidth={2.5} />
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
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

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
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  const storageKey = useMemo(() => getCleanerStorageKey(user?.id), [user?.id]);
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'Nettoyo';
  const email = user?.email || profile?.email || '';

  useEffect(() => {
    let cancelled = false;

    const loadCleanerProfile = async () => {
      if (!user?.id) {
        setDescription('');
        setSelectedServices([]);
        setPhotoDataUrl(profile?.avatar_url ?? null);
        setWeeklyAvailability(defaultWeeklyAvailability);
        setAvailabilityExceptions([]);
        setIsProfileLoading(false);
        return;
      }

      setIsProfileLoading(true);

      let fallbackLocalProfile: StoredCleanerProfile | null = null;
      const savedRaw = window.localStorage.getItem(storageKey);
      if (savedRaw) {
        try {
          fallbackLocalProfile = JSON.parse(savedRaw) as StoredCleanerProfile;
        } catch {
          fallbackLocalProfile = null;
        }
      }

      const { data, error } = await supabase
        .from('cleaner_profiles')
        .select('description, services, photo_url, weekly_availability, availability_exceptions')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error && error.code !== 'PGRST205') {
        console.error('cleaner profile fetch error:', error);
        setErrorMessage(content.loadError);
      }

      const normalized = normalizeCleanerProfile(
        (data as CleanerProfileRow | null) ?? null,
        profile?.avatar_url ?? null,
        fallbackLocalProfile
      );
      setDescription(normalized.description);
      setSelectedServices(normalized.services);
      setPhotoDataUrl(normalized.photoDataUrl);
      setWeeklyAvailability(normalized.weeklyAvailability);
      setAvailabilityExceptions(normalized.availabilityExceptions);
      setIsProfileLoading(false);
    };

    void loadCleanerProfile();

    return () => {
      cancelled = true;
    };
  }, [content.loadError, profile?.avatar_url, storageKey, user?.id]);

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

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let fileToUse = file;
    if (file.type !== 'image/webp') {
      try {
        fileToUse = await convertToWebP(file);
      } catch {
        fileToUse = file;
      }
    }

    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(fileToUse);
    setPhotoSourceOpen(false);
  };

  const handlePhotoRemove = () => {
    setPhotoDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    setPhotoModalOpen(false);
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

  const handleSave = async () => {
    if (!user?.id) {
      setErrorMessage(content.saveError);
      return;
    }

    setIsSaving(true);

    const payload: StoredCleanerProfile = {
      description: description.trim(),
      services: selectedServices,
      photoDataUrl,
      weekly_availability: weeklyAvailability,
      availability_exceptions: availabilityExceptions
    };

    const { error } = await supabase
      .from('cleaner_profiles')
      .upsert(
        {
          id: user.id,
          description: payload.description,
          services: payload.services,
          photo_url: payload.photoDataUrl,
          weekly_availability: payload.weekly_availability,
          availability_exceptions: payload.availability_exceptions
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('cleaner profile save error:', error);
      setErrorMessage(content.saveError);
      setIsSaving(false);
      return;
    }

    const { error: profileUpdateError } = await supabase.from('profiles').update({ avatar_url: payload.photoDataUrl }).eq('id', user.id);
    if (profileUpdateError) {
      console.error('profile avatar sync error:', profileUpdateError);
    }

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    setSaveToast(true);
    setIsSaving(false);
  };

  return (
    <div className="min-h-[calc(100vh-160px)] overflow-x-hidden bg-[#F7F7F7] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {saveToast ? (
          <div className="fixed right-4 top-24 z-50 animate-[slideUp_0.3s_ease] rounded-xl bg-[#1A1A2E] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(17,24,39,0.2)]">
            {content.saveSuccess}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[slideUp_0.3s_ease] rounded-xl bg-[rgba(239,68,68,0.14)] px-5 py-3 text-sm font-semibold text-[#B91C1C] shadow-[0_12px_24px_rgba(17,24,39,0.12)]">
            {errorMessage}
          </div>
        ) : null}

        <section className="mb-6 rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(17,24,39,0.04)] sm:mb-8 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[#4FC3F7] sm:text-sm">{content.pageBadge}</p>
              <h1 className="mt-2 text-2xl font-bold text-[#1A1A2E] sm:text-3xl">{content.pageTitle}</h1>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280] sm:text-base">{content.pageIntro}</p>
            </div>
            <div className="inline-flex min-w-0 shrink items-center gap-2 self-start rounded-full border border-[#A8E6CF] bg-[rgba(168,230,207,0.15)] px-3 py-2 text-xs font-semibold text-[#1A1A2E] sm:px-4 sm:text-sm">
              <UserCircle2 size={16} className="shrink-0" />
              <span className="truncate max-w-[160px] sm:max-w-xs">{displayName}</span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[300px,1fr] lg:gap-8">
          <aside className="space-y-6">
            <section className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
              <div className="p-5 sm:p-6">
                <h2 className="text-base font-bold text-[#1A1A2E] sm:text-lg">{content.photoTitle}</h2>
                <p className="mt-1 text-xs text-[#6B7280] sm:text-sm">{content.photoHelp}</p>

                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (photoDataUrl) {
                        setPhotoModalOpen(true);
                      }
                    }}
                    className="group relative"
                  >
                    {photoDataUrl ? (
                      <img
                        src={photoDataUrl}
                        alt="Cleaner profile"
                        className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-[0_8px_24px_rgba(79,195,247,0.2)] ring-2 ring-[#4FC3F7]/20 transition-all group-hover:scale-105 group-hover:shadow-[0_12px_32px_rgba(79,195,247,0.3)] sm:h-32 sm:w-32"
                      />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#4FC3F7] to-[#A8E6CF] text-white shadow-[0_8px_24px_rgba(79,195,247,0.2)] transition-all group-hover:scale-105 group-hover:shadow-[0_12px_32px_rgba(79,195,247,0.3)] sm:h-32 sm:w-32">
                        <Camera size={32} className="sm:h-9 sm:w-9" />
                      </div>
                    )}
                  </button>
                </div>

                {photoDataUrl ? (
                  <button
                    type="button"
                    onClick={() => setPhotoModalOpen(true)}
                    className="mt-4 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#6B7280] transition-all hover:bg-[#F7F7F7]"
                  >
                    {content.viewPhoto}
                  </button>
                ) : null}
              </div>

              <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] p-4 sm:p-5">
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setPhotoSourceOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#4FC3F7] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(79,195,247,0.25)] transition-all hover:bg-[#3FAAD4] hover:shadow-[0_6px_16px_rgba(79,195,247,0.35)]"
                  >
                    <Camera size={16} />
                    {photoDataUrl ? content.changePhoto : content.addPhoto}
                  </button>
                  {photoDataUrl ? (
                    <button
                      type="button"
                      onClick={handlePhotoRemove}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B7280] transition-all hover:bg-[#F7F7F7] hover:border-[#D1D5DB]"
                    >
                      <X size={16} />
                      {content.removePhoto}
                    </button>
                  ) : null}
                </div>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={(event) => void handlePhotoUpload(event)} className="hidden" />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => void handlePhotoUpload(event)}
                className="hidden"
              />
            </section>

            <section className="hidden rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_8px_rgba(17,24,39,0.03)] lg:block">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4FC3F7]">{content.publicPreview}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">{content.publicPreviewHelp}</p>
            </section>
          </aside>

          <main className="space-y-6">
            <section className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(79,195,247,0.12)]">
                    <Wand2 size={18} className="text-[#4FC3F7]" />
                  </div>
                  <h2 className="text-lg font-bold text-[#1A1A2E] sm:text-xl">{content.descriptionTitle}</h2>
                </div>
                {isProfileLoading ? <p className="mt-3 text-sm font-semibold text-[#6B7280]">{content.profileLoading}</p> : null}
                <p className="mt-2 text-xs leading-relaxed text-[#6B7280] sm:text-sm">{content.descriptionHelp}</p>
              </div>

              <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] p-5 sm:p-6">
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  placeholder={content.descriptionPlaceholder}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#1A1A2E] outline-none transition-all placeholder:text-[#9CA3AF] focus:border-[#4FC3F7] focus:shadow-[0_0_0_4px_rgba(79,195,247,0.08)] sm:text-base"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-[#9CA3AF]">{description.length}/1200</p>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
              <div className="p-5 sm:p-6">
                <h2 className="text-lg font-bold text-[#1A1A2E] sm:text-xl">{content.servicesTitle}</h2>
                <p className="mt-2 text-xs leading-relaxed text-[#6B7280] sm:text-sm">{content.servicesHelp}</p>
              </div>

              <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {serviceOptions.map((service) => {
                    const selected = selectedServices.includes(service.id);
                    const Icon = service.icon;
                    const labels = serviceLabels[service.id];
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(service.id)}
                        className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
                          selected
                            ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.05)] shadow-[0_0_0_2px_rgba(79,195,247,0.1)]'
                            : 'border-[#E5E7EB] bg-white hover:border-[#4FC3F7] hover:bg-[#FBFDFF] hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all ${
                              selected ? 'bg-[#4FC3F7] text-white shadow-sm' : 'bg-[rgba(79,195,247,0.1)] text-[#4FC3F7]'
                            }`}
                          >
                            <Icon size={18} />
                          </div>
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${
                              selected
                                ? 'border-[#4FC3F7] bg-[#4FC3F7] text-white'
                                : 'border-[#D1D5DB] bg-white text-transparent group-hover:border-[#4FC3F7]'
                            }`}
                          >
                            <Check size={13} strokeWidth={2.5} />
                          </div>
                        </div>
                        <p className="mt-3 text-sm font-bold text-[#1A1A2E]">{labels.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">{labels.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(79,195,247,0.12)]">
                    <Clock3 size={18} className="text-[#4FC3F7]" />
                  </div>
                  <h2 className="text-lg font-bold text-[#1A1A2E] sm:text-xl">{content.availabilityTitle}</h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#6B7280] sm:text-sm">{content.availabilityHelp}</p>
              </div>

              <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] p-5 sm:p-6">
                <div className="space-y-3">
                  {weekdayOrder.map((day) => {
                    const value = weeklyAvailability[day];
                    return (
                      <div key={day} className="min-w-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
                        <div className="p-4">
                          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center justify-between gap-3 sm:flex-1 sm:justify-start">
                              <p className="text-sm font-bold text-[#1A1A2E] sm:min-w-[100px]">{weekdayLabels[day]}</p>
                              <button
                                type="button"
                                onClick={() => updateWeeklyAvailability(day, { enabled: !value.enabled })}
                                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all ${
                                  value.enabled
                                    ? 'bg-[#4FC3F7] shadow-[0_0_0_3px_rgba(79,195,247,0.15)]'
                                    : 'bg-[#E5E7EB]'
                                }`}
                                aria-label={`toggle-${day}`}
                              >
                                <span
                                  className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
                                    value.enabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                >
                                  {value.enabled ? <Check size={11} strokeWidth={3} className="text-[#4FC3F7]" /> : <X size={11} strokeWidth={3} className="text-[#9CA3AF]" />}
                                </span>
                              </button>
                            </div>

                            {value.enabled ? (
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <label className="w-full sm:w-auto sm:flex-initial">
                                  <span className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">{content.start}</span>
                                  <TimeStepControl
                                    value={value.start}
                                    onChange={(nextValue) => updateWeeklyAvailability(day, { start: nextValue })}
                                  />
                                </label>
                                <span className="hidden sm:block text-[#D1D5DB] font-medium">—</span>
                                <label className="w-full sm:w-auto sm:flex-initial">
                                  <span className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">{content.end}</span>
                                  <TimeStepControl
                                    value={value.end}
                                    onChange={(nextValue) => updateWeeklyAvailability(day, { end: nextValue })}
                                  />
                                </label>
                              </div>
                            ) : (
                              <span className="inline-flex self-start rounded-full bg-[#F7F7F7] border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#6B7280]">
                                {content.unavailableDay}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(79,195,247,0.12)]">
                    <CalendarDays size={18} className="text-[#4FC3F7]" />
                  </div>
                  <h2 className="text-lg font-bold text-[#1A1A2E] sm:text-xl">{content.exceptionsTitle}</h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#6B7280] sm:text-sm">{content.exceptionsHelp}</p>
              </div>

              <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] p-5 sm:p-6">
                <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
                  <div className="p-4 sm:p-5">
                    <div className="space-y-4">
                      <label className="block">
                        <span className="block text-xs font-bold uppercase tracking-wide text-[#6B7280] mb-2">{content.exceptionDate}</span>
                        <input
                          type="date"
                          value={exceptionDraftDate}
                          onChange={(event) => setExceptionDraftDate(event.target.value)}
                          className="w-full rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-sm text-[#1A1A2E] outline-none transition-all focus:border-[#4FC3F7] focus:shadow-[0_0_0_3px_rgba(79,195,247,0.08)]"
                        />
                      </label>

                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wide text-[#6B7280] mb-2">{content.exceptionMode}</span>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setExceptionDraftMode('all_day')}
                            className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-all ${
                              exceptionDraftMode === 'all_day'
                                ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.08)] text-[#0284C7] shadow-[0_0_0_2px_rgba(79,195,247,0.12)]'
                                : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#4FC3F7] hover:bg-[#FBFDFF]'
                            }`}
                          >
                            <CalendarDays size={16} />
                            <span className="truncate">{content.allDayUnavailable}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setExceptionDraftMode('partial')}
                            className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-all ${
                              exceptionDraftMode === 'partial'
                                ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.08)] text-[#0284C7] shadow-[0_0_0_2px_rgba(79,195,247,0.12)]'
                                : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#4FC3F7] hover:bg-[#FBFDFF]'
                            }`}
                          >
                            <Clock3 size={16} />
                            <span className="truncate">{content.partialUnavailable}</span>
                          </button>
                        </div>
                      </div>

                      {exceptionDraftMode === 'partial' ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className="block text-xs font-bold uppercase tracking-wide text-[#6B7280] mb-2">{content.start}</span>
                            <TimeStepControl
                              value={exceptionDraftStart}
                              onChange={setExceptionDraftStart}
                            />
                          </label>
                          <label className="block">
                            <span className="block text-xs font-bold uppercase tracking-wide text-[#6B7280] mb-2">{content.end}</span>
                            <TimeStepControl
                              value={exceptionDraftEnd}
                              onChange={setExceptionDraftEnd}
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={addException}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A1A2E] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#111827] sm:w-auto"
                    >
                      <Plus size={16} />
                      {content.addException}
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {availabilityExceptions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white px-4 py-8 text-center">
                      <p className="text-sm text-[#6B7280]">{content.noExceptions}</p>
                    </div>
                  ) : (
                    availabilityExceptions.map((entry) => (
                      <div key={entry.id} className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#1A1A2E]">{entry.date}</p>
                          <p className="mt-1 text-xs text-[#6B7280] truncate">
                            {entry.mode === 'all_day' ? content.allDayUnavailable : `${content.partialUnavailable}: ${entry.start} - ${entry.end}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeException(entry.id)}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#6B7280] transition-all hover:border-[#D1D5DB] hover:bg-[#F7F7F7]"
                        >
                          <Trash2 size={14} />
                          <span className="hidden sm:inline">{content.removeException}</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </main>
        </div>

        <section className="sticky bottom-0 z-40 mt-6 rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_-4px_24px_rgba(17,24,39,0.08)]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1A1A2E]">
                  {selectedServices.length} {content.selectedServices}
                </p>
                <p className="mt-0.5 text-xs text-[#6B7280] truncate">{content.saveHint}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || isProfileLoading}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#4FC3F7] px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(79,195,247,0.25)] transition-all hover:bg-[#3FAAD4] hover:shadow-[0_6px_20px_rgba(79,195,247,0.35)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {isSaving ? `${content.saveButton}...` : content.saveButton}
              </button>
            </div>
          </div>
        </section>
        </div>

      {photoSourceOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm p-4 sm:items-center animate-[slideUp_0.2s_ease]">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-[0_24px_50px_rgba(17,24,39,0.3)] animate-[slideUp_0.3s_ease]">
            <div className="p-5 sm:p-6">
              <h3 className="text-lg font-bold text-[#1A1A2E]">{content.photoSourceTitle}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{content.photoSourceHelp}</p>
            </div>
            <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] p-4 sm:p-5">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-[#1A1A2E] transition-all hover:border-[#4FC3F7] hover:bg-[#FBFDFF]"
                >
                  <Camera size={16} />
                  {content.chooseFromGallery}
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#4FC3F7] px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(79,195,247,0.25)] transition-all hover:bg-[#3FAAD4] hover:shadow-[0_6px_16px_rgba(79,195,247,0.35)]"
                >
                  <Camera size={16} />
                  {content.takePhoto}
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoSourceOpen(false)}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B7280] transition-all hover:bg-[#F7F7F7]"
                >
                  {content.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {photoModalOpen && photoDataUrl ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[slideUp_0.2s_ease]">
          <div className="relative w-full max-w-3xl">
            <button
              type="button"
              onClick={() => setPhotoModalOpen(false)}
              className="absolute -right-2 -top-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1A1A2E] shadow-lg transition-all hover:scale-110 hover:bg-[#F7F7F7]"
              aria-label={content.close}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
            <img
              src={photoDataUrl}
              alt="Cleaner profile modal preview"
              className="max-h-[85vh] w-full rounded-xl object-contain shadow-[0_30px_70px_rgba(17,24,39,0.5)]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

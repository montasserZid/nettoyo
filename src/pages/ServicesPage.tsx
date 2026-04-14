import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Hammer,
  Home,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Truck,
  User,
  X
} from 'lucide-react';
import { PaginationControls } from '../components/PaginationControls';
import { SEOHead } from '../components/SEOHead';
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
import { areaPoints, deriveZoneFromCityName } from '../lib/zoneMapping';
import supabase from '../lib/supabase';
import { getSeoMeta } from '../seo/metadata';
import { getHreflangAlternates } from '../seo/hreflang';

type ServiceCategory = 'all' | 'home' | 'deep' | 'office' | 'move' | 'renovation' | 'airbnb';
type ServiceId = 'domicile' | 'deep_cleaning' | 'office' | 'moving' | 'post_renovation' | 'airbnb';
type AreaSelection = { id: string; zone: string; name: string; lat: number; lng: number };
type CleanerProfileRecord = {
  id: string;
  description: string | null;
  hourly_rate: number | null;
  services: string[] | null;
  photo_url: string | null;
  service_areas: unknown;
  weekly_availability: unknown;
};
type CleanerReviewRecord = { cleaner_id: string; rating: number | null };
type CleanerCompletedBookingRecord = { cleaner_id: string | null };
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
  completedJobs: number;
  averageRating: number | null;
  ratingCount: number;
};
type SpaceRecord = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  derived_zone: string | null;
  is_favorite: boolean;
  is_active: boolean;
};
type FAQItem = { q: string; a: string };

const CLEANERS_PER_PAGE = 6;
const ESTIMATED_HOURS = [2, 3, 4, 5, 6, 8, 10];
const WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const FILTERS: Record<'fr' | 'en' | 'es', Record<ServiceCategory, string>> = {
  fr: {
    all: 'Tous les services',
    home: 'Domicile',
    deep: 'Nettoyage en profondeur',
    office: 'Bureau',
    move: 'Demenagement',
    renovation: 'Post-renovation',
    airbnb: 'Airbnb'
  },
  en: {
    all: 'All services',
    home: 'Home',
    deep: 'Deep cleaning',
    office: 'Office',
    move: 'Moving',
    renovation: 'Post-renovation',
    airbnb: 'Airbnb'
  },
  es: {
    all: 'Todos los servicios',
    home: 'Domicilio',
    deep: 'Profunda',
    office: 'Oficina',
    move: 'Mudanza',
    renovation: 'Post-renovacion',
    airbnb: 'Airbnb'
  }
};

const CATEGORY_TO_SERVICE: Record<Exclude<ServiceCategory, 'all'>, ServiceId> = {
  home: 'domicile',
  deep: 'deep_cleaning',
  office: 'office',
  move: 'moving',
  renovation: 'post_renovation',
  airbnb: 'airbnb'
};

const SERVICE_LABELS: Record<ServiceId, { fr: string; en: string; es: string }> = {
  domicile: { fr: 'Domicile', en: 'Home', es: 'Domicilio' },
  deep_cleaning: { fr: 'Profondeur', en: 'Deep cleaning', es: 'Profunda' },
  office: { fr: 'Bureau', en: 'Office', es: 'Oficina' },
  moving: { fr: 'Demenagement', en: 'Moving', es: 'Mudanza' },
  post_renovation: { fr: 'Post-renovation', en: 'Post-renovation', es: 'Post-renovacion' },
  airbnb: { fr: 'Airbnb', en: 'Airbnb', es: 'Airbnb' }
};

// Service category icons as emoji for visual differentiation
const SERVICE_ICON_COMPONENTS = {
  all: SlidersHorizontal,
  home: Home,
  deep: Sparkles,
  office: Briefcase,
  move: Truck,
  renovation: Hammer,
  airbnb: Building2
} as const;

const SERVICE_TO_CATEGORY: Record<ServiceId, Exclude<ServiceCategory, 'all'>> = {
  domicile: 'home',
  deep_cleaning: 'deep',
  office: 'office',
  moving: 'move',
  post_renovation: 'renovation',
  airbnb: 'airbnb'
};

const UI = {
  fr: {
    heroHeadline: 'Trouvez votre nettoyeur independant',
    heroSubheadline: 'Montreal · Laval · Longueuil · Rive-Nord · Rive-Sud',
    title: 'Services de nettoyage disponibles sur Nettoyo',
    subtitle:
      'Trouvez des nettoyeurs independants a Montreal, Laval, Longueuil, sur la Rive-Nord et la Rive-Sud, puis comparez prix et disponibilites.',
    servicePlaceholder: 'Type de service',
    cityPlaceholder: 'Votre ville',
    search: 'Rechercher',
    hint: 'Choisissez un type de service et une ville puis lancez la recherche.',
    noResult: 'Aucun nettoyeur compatible pour cette recherche.',
    noResultHint: 'Essayez une autre ville ou un autre service.',
    results: 'resultats',
    details: 'Details',
    avail: 'Disponibilites',
    close: 'Fermer',
    reserve: 'Reserver',
    page: 'Page',
    previous: 'Precedent',
    next: 'Suivant',
    cityRequired: 'Selectionnez une ville valide dans les suggestions.',
    noAvailability: 'Aucune disponibilite hebdomadaire renseignee.',
    sameDayLeadError: "Pour aujourd'hui, choisissez une heure au moins 2h plus tard (heure de Montreal).",
    bookingError: 'Impossible de reserver pour le moment.',
    date: 'Date',
    datePlaceholder: 'Choisir une date',
    time: 'Heure',
    hours: 'Heures estimees',
    address: 'Adresse',
    addSpace: 'Ajouter un espace',
    noSpace: 'Ajoutez un espace actif pour pouvoir reserver.',
    bookingFlowTitle: 'Estimation du menage',
    bookingStep1Title: 'Combien d heures pensez-vous que le menage prendra ?',
    bookingStep1Hint: 'Estimations a titre indicatif',
    bookingGuideSmall: 'Petit espace (1 chambre / studio): 2h a 3h',
    bookingGuideMedium: 'Appartement ou maison moyenne: 4h a 5h',
    bookingGuideLarge: 'Grande maison / plusieurs etages: 6h+',
    bookingGuideMove: 'Demenagement / menage profond: prevoir plus de temps',
    bookingHoursLabel: 'Duree estimee',
    bookingAdjustDisclaimer: 'La duree peut etre ajustee avec le nettoyeur selon l etat reel du logement.',
    continue: 'Continuer',
    bookingSummaryTitle: 'Recapitulatif',
    bookingSummaryAddress: 'Adresse',
    bookingSummaryRate: 'Taux horaire',
    bookingSummaryHours: 'Heures',
    bookingSummaryDate: 'Date',
    bookingSummaryTime: 'Heure',
    bookingApproxTotal: 'Total approximatif',
    paymentDisclaimer1: 'Le total est indicatif. Des ajustements peuvent s appliquer selon le service reel.',
    paymentDisclaimer2: 'Le paiement du service se fait directement avec le nettoyeur.',
    back: 'Retour',
    finish: 'Finaliser',
    pricingTitle: 'Tarification claire',
    pricingSubtitle: 'Comparez facilement les profils et comprenez ce qui compose le prix.',
    faqTitle: 'Questions frequentes',
    faqSubtitle: 'Les points essentiels pour reserver en confiance.',
    marketplaceTitle: 'Une marketplace locale et flexible',
    marketplaceSubtitle: 'Nettoyo vous aide a trouver le bon nettoyeur selon votre ville, vos besoins et vos disponibilites.',
    marketplaceCta: 'Lancer la recherche',
    howItWorksTitle: 'Comment ca marche',
    step1: 'Choisissez un service et une ville',
    step2: 'Comparez les profils et les tarifs',
    step3: 'Reservez directement avec le nettoyeur',
    completedJobs: 'missions',
    descriptionLabel: 'Description',
    zonesLabel: 'Zones',
    zoneFallback: 'Zone',
    monday: 'Lundi',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
    thursday: 'Jeudi',
    friday: 'Vendredi',
    saturday: 'Samedi',
    sunday: 'Dimanche'
  },
  en: {
    heroHeadline: 'Find your independent cleaner',
    heroSubheadline: 'Montreal · Laval · Longueuil · North Shore · South Shore',
    title: 'Cleaning services available on Nettoyo',
    subtitle:
      'Find independent cleaners in Montreal, Laval, Longueuil, on the North Shore and South Shore, then compare pricing and availability.',
    servicePlaceholder: 'Service type',
    cityPlaceholder: 'Your city',
    search: 'Search',
    hint: 'Choose service type and city, then search.',
    noResult: 'No matching cleaner found for this search.',
    noResultHint: 'Try another city or service type.',
    results: 'results',
    details: 'Details',
    avail: 'Availability',
    close: 'Close',
    reserve: 'Book',
    page: 'Page',
    previous: 'Previous',
    next: 'Next',
    cityRequired: 'Select a valid city from suggestions.',
    noAvailability: 'No weekly availability provided.',
    sameDayLeadError: 'For same-day bookings, choose a time at least 2 hours later (Montreal time).',
    bookingError: 'Unable to book right now.',
    date: 'Date',
    datePlaceholder: 'Choose a date',
    time: 'Time',
    hours: 'Estimated hours',
    address: 'Address',
    addSpace: 'Add space',
    noSpace: 'Add an active space before booking.',
    bookingFlowTitle: 'Cleaning estimate',
    bookingStep1Title: 'How many hours do you think the cleaning will take?',
    bookingStep1Hint: 'Guidance only',
    bookingGuideSmall: 'Small space (1 bedroom / studio): 2h to 3h',
    bookingGuideMedium: 'Average apartment or home: 4h to 5h',
    bookingGuideLarge: 'Large home / multiple floors: 6h+',
    bookingGuideMove: 'Moving or deep cleaning: plan extra time',
    bookingHoursLabel: 'Estimated duration',
    bookingAdjustDisclaimer: 'Duration can be adjusted with the cleaner based on real conditions.',
    continue: 'Continue',
    bookingSummaryTitle: 'Summary',
    bookingSummaryAddress: 'Address',
    bookingSummaryRate: 'Hourly rate',
    bookingSummaryHours: 'Hours',
    bookingSummaryDate: 'Date',
    bookingSummaryTime: 'Time',
    bookingApproxTotal: 'Approximate total',
    paymentDisclaimer1: 'Total is an estimate. It can be adjusted depending on the final service scope.',
    paymentDisclaimer2: 'Service payment is made directly with the cleaner.',
    back: 'Back',
    finish: 'Finish',
    pricingTitle: 'Clear pricing',
    pricingSubtitle: 'Compare profiles quickly and understand what makes up the price.',
    faqTitle: 'Frequently asked questions',
    faqSubtitle: 'Key answers before you book.',
    marketplaceTitle: 'A local and flexible marketplace',
    marketplaceSubtitle: 'Nettoyo helps you find the right cleaner based on city, service needs, and schedule.',
    marketplaceCta: 'Start searching',
    howItWorksTitle: 'How it works',
    step1: 'Pick a service and a city',
    step2: 'Compare profiles and rates',
    step3: 'Book directly with the cleaner',
    completedJobs: 'jobs',
    descriptionLabel: 'Description',
    zonesLabel: 'Zones',
    zoneFallback: 'Zone',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday'
  },
  es: {
    heroHeadline: 'Encuentra tu limpiador independiente',
    heroSubheadline: 'Montreal · Laval · Longueuil · Rive-Nord · Rive-Sud',
    title: 'Servicios de limpieza disponibles en Nettoyo',
    subtitle:
      'Encuentra limpiadores independientes en Montreal, Laval, Longueuil, Rive-Nord y Rive-Sud, y compara precios y disponibilidades.',
    servicePlaceholder: 'Tipo de servicio',
    cityPlaceholder: 'Tu ciudad',
    search: 'Buscar',
    hint: 'Elige tipo de servicio y ciudad antes de buscar.',
    noResult: 'No hay limpiadores compatibles para esta busqueda.',
    noResultHint: 'Prueba otra ciudad u otro tipo de servicio.',
    results: 'resultados',
    details: 'Detalles',
    avail: 'Disponibilidades',
    close: 'Cerrar',
    reserve: 'Reservar',
    page: 'Pagina',
    previous: 'Anterior',
    next: 'Siguiente',
    cityRequired: 'Selecciona una ciudad valida de las sugerencias.',
    noAvailability: 'No hay disponibilidad semanal informada.',
    sameDayLeadError: 'Para reservas del mismo dia, elige una hora al menos 2h mas tarde (hora de Montreal).',
    bookingError: 'No se pudo reservar.',
    date: 'Fecha',
    datePlaceholder: 'Elige una fecha',
    time: 'Hora',
    hours: 'Horas estimadas',
    address: 'Direccion',
    addSpace: 'Agregar espacio',
    noSpace: 'Agrega un espacio activo para reservar.',
    bookingFlowTitle: 'Estimacion de limpieza',
    bookingStep1Title: 'Cuantas horas crees que tomara la limpieza?',
    bookingStep1Hint: 'Estimaciones orientativas',
    bookingGuideSmall: 'Espacio pequeno (1 habitacion / estudio): 2h a 3h',
    bookingGuideMedium: 'Apartamento o casa media: 4h a 5h',
    bookingGuideLarge: 'Casa grande / varios pisos: 6h+',
    bookingGuideMove: 'Mudanza o limpieza profunda: considera mas tiempo',
    bookingHoursLabel: 'Duracion estimada',
    bookingAdjustDisclaimer: 'La duracion puede ajustarse con el limpiador segun el estado real del espacio.',
    continue: 'Continuar',
    bookingSummaryTitle: 'Resumen',
    bookingSummaryAddress: 'Direccion',
    bookingSummaryRate: 'Tarifa por hora',
    bookingSummaryHours: 'Horas',
    bookingSummaryDate: 'Fecha',
    bookingSummaryTime: 'Hora',
    bookingApproxTotal: 'Total aproximado',
    paymentDisclaimer1: 'El total es estimado. Puede ajustarse segun el alcance final del servicio.',
    paymentDisclaimer2: 'El pago del servicio se realiza directamente con el limpiador.',
    back: 'Volver',
    finish: 'Finalizar',
    pricingTitle: 'Precios claros',
    pricingSubtitle: 'Compara perfiles y entiende facilmente como se construye el precio.',
    faqTitle: 'Preguntas frecuentes',
    faqSubtitle: 'Respuestas clave antes de reservar.',
    marketplaceTitle: 'Un marketplace local y flexible',
    marketplaceSubtitle: 'Nettoyo te ayuda a encontrar el limpiador correcto segun ciudad, servicio y horario.',
    marketplaceCta: 'Empezar a buscar',
    howItWorksTitle: 'Como funciona',
    step1: 'Elige un servicio y ciudad',
    step2: 'Compara perfiles y tarifas',
    step3: 'Reserva directamente con el limpiador',
    completedJobs: 'servicios',
    descriptionLabel: 'Descripción',
    zonesLabel: 'Zonas',
    zoneFallback: 'Zona',
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miercoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sabado',
    sunday: 'Domingo'
  }
} as const;

const PRICING_BLOCKS = {
  fr: [
    { title: 'Frais de plateforme', text: 'Nettoyo applique un petit frais de plateforme par reservation.' },
    { title: 'Prix fixes par le nettoyeur', text: 'Chaque nettoyeur independant definit son propre tarif horaire.' },
    { title: 'Paiement direct du service', text: 'Le paiement de la prestation se fait directement avec le nettoyeur.' }
  ],
  en: [
    { title: 'Platform fee', text: 'Nettoyo applies a small platform fee per booking.' },
    { title: 'Cleaner-set pricing', text: 'Each independent cleaner sets their own hourly rate.' },
    { title: 'Direct service payment', text: 'Service payment is made directly to the cleaner.' }
  ],
  es: [
    { title: 'Comision de plataforma', text: 'Nettoyo aplica una pequena comision por reserva.' },
    { title: 'Precios del limpiador', text: 'Cada limpiador independiente fija su tarifa por hora.' },
    { title: 'Pago directo del servicio', text: 'El pago del servicio se hace directamente al limpiador.' }
  ]
} as const;

const PRICING_CARD_ICONS = [SlidersHorizontal, Clock3, MapPin] as const;

const FAQ_BY_LANG: Record<'fr' | 'en' | 'es', FAQItem[]> = {
  fr: [
    { q: 'Nettoyo fournit-il directement le service ?', a: 'Non. Nettoyo est une marketplace qui met en relation clients et nettoyeurs independants.' },
    { q: 'Pourquoi les prix varient-ils ?', a: 'Chaque nettoyeur fixe son prix selon son experience, ses zones et sa disponibilite.' },
    { q: 'Puis-je comparer plusieurs profils ?', a: 'Oui. Cette page permet de filtrer par service et ville pour comparer les nettoyeurs compatibles.' },
    { q: 'Comment reserver ?', a: 'Ouvrez les disponibilites d un nettoyeur puis cliquez sur Reserver pour lancer le flux de reservation.' }
  ],
  en: [
    { q: 'Does Nettoyo directly provide cleaning?', a: 'No. Nettoyo is a marketplace connecting clients with independent cleaners.' },
    { q: 'Why do prices vary?', a: 'Each cleaner sets pricing based on experience, service area, and schedule.' },
    { q: 'Can I compare profiles?', a: 'Yes. Filter by service and city to compare matching cleaners.' },
    { q: 'How do I book?', a: 'Open a cleaner availability modal and click Book to start the booking flow.' }
  ],
  es: [
    { q: 'Nettoyo presta directamente la limpieza?', a: 'No. Nettoyo conecta clientes con limpiadores independientes.' },
    { q: 'Por que varian los precios?', a: 'Cada limpiador define su tarifa segun experiencia, zona y horario.' },
    { q: 'Puedo comparar perfiles?', a: 'Si. Filtra por servicio y ciudad para comparar limpiadores compatibles.' },
    { q: 'Como reservo?', a: 'Abre la disponibilidad de un limpiador y pulsa Reservar para iniciar el flujo.' }
  ]
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const SERVICE_ALIAS: Record<string, ServiceId> = {
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

function normalizeServiceId(value: string): ServiceId | null {
  return SERVICE_ALIAS[normalize(value)] ?? null;
}

function parseAreas(value: unknown): AreaSelection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is AreaSelection =>
      Boolean(item && typeof item === 'object' && typeof (item as AreaSelection).zone === 'string' && typeof (item as AreaSelection).name === 'string')
  );
}

function formatRate(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}$/h` : '--';
}

function toMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!match) return null;
  const rawHour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[4]?.toUpperCase() as 'AM' | 'PM' | undefined;
  if (Number.isNaN(rawHour) || Number.isNaN(minute) || minute > 59) return null;
  if (meridiem) {
    if (rawHour < 1 || rawHour > 12) return null;
    return (meridiem === 'PM' ? (rawHour % 12) + 12 : rawHour % 12) * 60 + minute;
  }
  if (rawHour < 0 || rawHour > 23) return null;
  return rawHour * 60 + minute;
}

// Star rating renderer
function StarRating({ rating, count }: { rating: number | null; count: number }) {
  if (rating === null || count === 0) return null;
  return (
    <div className="flex items-center gap-1">
      <Star size={12} className="fill-[#F59E0B] text-[#F59E0B]" />
      <span className="text-[12px] font-bold text-[#1A1A2E]">{rating}</span>
      <span className="text-[11px] text-[#9CA3AF]">({count})</span>
    </div>
  );
}

// Skeleton card
function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-3xl border border-[#EEF2F7] bg-white shadow-[0_4px_24px_rgba(17,24,39,0.04)] animate-pulse">
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <div className="h-14 w-14 flex-shrink-0 rounded-2xl bg-[#F0F4F8]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-2/3 rounded-lg bg-[#F0F4F8]" />
            <div className="h-3 w-1/3 rounded-lg bg-[#F0F4F8]" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-16 rounded-lg bg-[#F0F4F8]" />
          <div className="h-6 w-20 rounded-lg bg-[#F0F4F8]" />
        </div>
      </div>
      <div className="mx-5 border-t border-[#F0F4F8] sm:mx-6" />
      <div className="flex items-center gap-2.5 p-4 sm:p-5">
        <div className="h-10 flex-1 rounded-2xl bg-[#F0F4F8]" />
        <div className="h-10 flex-1 rounded-2xl bg-[#E8F7FD]" />
      </div>
    </div>
  );
}

export function ServicesPage() {
  const { language, navigateTo } = useLanguage();
  const { user, session, loading: authLoading, isClient, isCleaner } = useAuth();
  const ui = UI[language];
  const filters = FILTERS[language];
  const seo = getSeoMeta('services', language);
  const hreflang = getHreflangAlternates('services');
  const addSpacePath = getPathForRoute(language, 'clientAddSpace');
  const successPath = getPathForRoute(language, 'clientReservationSuccess');
  const cityOptions = useMemo(
    () => Array.from(new Set(areaPoints.map((area) => area.name))).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    []
  );

  const [searchCategory, setSearchCategory] = useState<ServiceCategory>('all');
  const [cityInput, setCityInput] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [cityFocused, setCityFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const [hasSearched, setHasSearched] = useState(false);
  const [appliedCategory, setAppliedCategory] = useState<ServiceCategory>('all');
  const [appliedCity, setAppliedCity] = useState('');
  const [appliedZone, setAppliedZone] = useState('');

  const [cleaners, setCleaners] = useState<CleanerCandidate[]>([]);
  const [spaces, setSpaces] = useState<SpaceRecord[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultsPage, setResultsPage] = useState(1);

  const [modalCleaner, setModalCleaner] = useState<CleanerCandidate | null>(null);
  const [availabilityCleaner, setAvailabilityCleaner] = useState<CleanerCandidate | null>(null);
  const [bookingCleaner, setBookingCleaner] = useState<CleanerCandidate | null>(null);
  const [bookingStep, setBookingStep] = useState<1 | 2>(1);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [estimatedHours, setEstimatedHours] = useState(3);
  const [reserving, setReserving] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // FAQ accordion open state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const cityInputRef = useRef<HTMLInputElement | null>(null);
  useBodyScrollLock(Boolean(modalCleaner || availabilityCleaner || bookingCleaner));

  const minBookDate = useMemo(() => getMontrealToday(), []);
  const sameDayMinTime = useMemo(() => (isDateTodayInMontreal(selectedDate) ? getMinimumSameDayBookingTime(new Date(), 2, 30) : null), [selectedDate]);

  useEffect(() => {
    if (!sameDayMinTime) return;
    const minMins = toMinutes(sameDayMinTime);
    const timeMins = toMinutes(selectedTime);
    if (minMins !== null && timeMins !== null && timeMins < minMins) setSelectedTime(sameDayMinTime);
  }, [sameDayMinTime, selectedTime]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);

      const cleanersRes = await supabase
        .from('cleaner_profiles')
        .select('id,description,hourly_rate,services,photo_url,service_areas,weekly_availability,availability_exceptions');

      if (!active) return;
      if (cleanersRes.error) {
        setCleaners([]);
        setErrorMessage(cleanersRes.error.message);
        setLoading(false);
        return;
      }

      const rows = (cleanersRes.data as CleanerProfileRecord[] | null) ?? [];
      const ids = rows.map((row) => row.id);
      const [profileRes, reviewRes, completedRes] =
        ids.length > 0
          ? await Promise.all([
              supabase.from('profiles').select('id,first_name,last_name,avatar_url').in('id', ids).eq('role', 'nettoyeur'),
              supabase.from('cleaner_client_reviews').select('cleaner_id,rating').in('cleaner_id', ids),
              supabase.from('bookings').select('cleaner_id').in('cleaner_id', ids).eq('status', 'completed')
            ])
          : [
              { data: [], error: null } as { data: CleanerIdentity[]; error: null },
              { data: [], error: null } as { data: CleanerReviewRecord[]; error: null },
              { data: [], error: null } as { data: CleanerCompletedBookingRecord[]; error: null }
            ];

      const profileMap = new Map(((profileRes.data as CleanerIdentity[] | null) ?? []).map((item) => [item.id, item]));
      const ratingMap = new Map<string, { sum: number; count: number }>();
      ((reviewRes.data as CleanerReviewRecord[] | null) ?? []).forEach((row) => {
        if (!row.cleaner_id || typeof row.rating !== 'number' || !Number.isFinite(row.rating)) return;
        const current = ratingMap.get(row.cleaner_id) ?? { sum: 0, count: 0 };
        ratingMap.set(row.cleaner_id, { sum: current.sum + row.rating, count: current.count + 1 });
      });
      const completedMap = new Map<string, number>();
      ((completedRes.data as CleanerCompletedBookingRecord[] | null) ?? []).forEach((row) => {
        if (!row.cleaner_id) return;
        completedMap.set(row.cleaner_id, (completedMap.get(row.cleaner_id) ?? 0) + 1);
      });

      const nextCleaners = rows.map((row) => {
        const profile = profileMap.get(row.id);
        const displayName = [profile?.first_name ?? '', profile?.last_name ?? ''].join(' ').trim() || 'Nettoyeur';
        const cleanerServices = ((row.services ?? []) as string[]).map(normalizeServiceId).filter((value): value is ServiceId => Boolean(value));
        const rating = ratingMap.get(row.id);
        const ratingCount = rating?.count ?? 0;
        const averageRating = ratingCount > 0 ? Number((rating!.sum / ratingCount).toFixed(1)) : null;
        return {
          id: row.id,
          displayName,
          description: (row.description ?? '').trim(),
          photoUrl: profile?.avatar_url || row.photo_url || null,
          hourlyRate: row.hourly_rate ?? null,
          services: cleanerServices,
          serviceAreas: parseAreas(row.service_areas),
          availability: row.weekly_availability,
          completedJobs: completedMap.get(row.id) ?? 0,
          averageRating,
          ratingCount
        } satisfies CleanerCandidate;
      });

      if (!active) return;
      setCleaners(nextCleaners);

      if (user?.id && isClient()) {
        const spacesRes = await supabase
          .from('spaces')
          .select('id,name,address,city,derived_zone,is_favorite,is_active')
          .eq('client_id', user.id)
          .eq('is_active', true)
          .order('is_favorite', { ascending: false })
          .order('created_at', { ascending: false });

        if (!active) return;
        const nextSpaces = (spacesRes.data as SpaceRecord[] | null) ?? [];
        setSpaces(nextSpaces);
        if (nextSpaces[0]) setSelectedSpaceId((current) => current || nextSpaces[0].id);
      } else {
        setSpaces([]);
        setSelectedSpaceId('');
      }

      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [authLoading, isClient, user?.id]);

  const citySuggestions = useMemo(() => {
    const query = normalize(cityInput);
    if (!query) return cityOptions.slice(0, 8);
    return cityOptions.filter((city) => normalize(city).includes(query)).slice(0, 8);
  }, [cityInput, cityOptions]);

  const matchingCleaners = useMemo(() => {
    if (!hasSearched) return [] as CleanerCandidate[];
    const selectedService = appliedCategory === 'all' ? null : CATEGORY_TO_SERVICE[appliedCategory];
    const zoneNorm = normalize(appliedZone);

    return cleaners.filter((cleaner) => {
      const serviceOk = !selectedService || cleaner.services.includes(selectedService);
      if (!serviceOk) return false;
      if (!appliedCity) return true;
      if (!zoneNorm) return false;
      return cleaner.serviceAreas.some((area) => normalize(area.zone) === zoneNorm);
    });
  }, [appliedCategory, appliedCity, appliedZone, cleaners, hasSearched]);

  const sortedResults = useMemo(() => {
    return [...matchingCleaners].sort((left, right) => {
      if ((right.averageRating ?? -1) !== (left.averageRating ?? -1)) return (right.averageRating ?? -1) - (left.averageRating ?? -1);
      if (right.completedJobs !== left.completedJobs) return right.completedJobs - left.completedJobs;
      return (left.hourlyRate ?? Number.POSITIVE_INFINITY) - (right.hourlyRate ?? Number.POSITIVE_INFINITY);
    });
  }, [matchingCleaners]);

  const totalPages = Math.max(1, Math.ceil(sortedResults.length / CLEANERS_PER_PAGE));
  const paginatedResults = useMemo(() => {
    const start = (resultsPage - 1) * CLEANERS_PER_PAGE;
    return sortedResults.slice(start, start + CLEANERS_PER_PAGE);
  }, [resultsPage, sortedResults]);

  useEffect(() => {
    setResultsPage(1);
  }, [sortedResults.length]);

  useEffect(() => {
    if (resultsPage > totalPages) setResultsPage(totalPages);
  }, [resultsPage, totalPages]);

  const availabilityRows = useMemo(() => {
    if (!availabilityCleaner || !availabilityCleaner.availability || typeof availabilityCleaner.availability !== 'object') {
      return [] as Array<{ day: string; start: string; end: string }>;
    }
    const raw = availabilityCleaner.availability as Record<string, { enabled?: boolean; start?: string; end?: string }>;
    return WEEK
      .map((day) => {
        const slot = raw[day];
        if (!slot?.enabled || typeof slot.start !== 'string' || typeof slot.end !== 'string') return null;
        return { day, start: slot.start, end: slot.end };
      })
      .filter((row): row is { day: string; start: string; end: string } => Boolean(row));
  }, [availabilityCleaner]);

  const dayLabel = (day: string) => {
    if (day === 'monday') return ui.monday;
    if (day === 'tuesday') return ui.tuesday;
    if (day === 'wednesday') return ui.wednesday;
    if (day === 'thursday') return ui.thursday;
    if (day === 'friday') return ui.friday;
    if (day === 'saturday') return ui.saturday;
    return ui.sunday;
  };

  const selectCity = (value: string) => {
    setCityInput(value);
    setSelectedCity(value);
    setCityFocused(false);
    setActiveSuggestionIndex(-1);
  };

  const runSearch = () => {
    const city = (selectedCity || cityInput).trim();
    const zone = deriveZoneFromCityName(city);
    if (city && !zone) {
      setErrorMessage(ui.cityRequired);
      cityInputRef.current?.focus();
      return;
    }
    setErrorMessage(null);
    setAppliedCategory(searchCategory);
    setAppliedCity(city);
    setAppliedZone(zone ?? '');
    setHasSearched(true);
    setResultsPage(1);
    setCityFocused(false);
    document.getElementById('services-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const startBooking = (cleaner: CleanerCandidate) => {
    if (!user) {
      navigateTo('login');
      return;
    }
    if (!isClient()) return;
    setBookingError(null);
    setBookingStep(1);
    setBookingCleaner(cleaner);
    setAvailabilityCleaner(null);
  };

  const selectedSpace = useMemo(() => spaces.find((space) => space.id === selectedSpaceId) ?? null, [selectedSpaceId, spaces]);
  const approxTotal = bookingCleaner?.hourlyRate ? Math.round(bookingCleaner.hourlyRate * estimatedHours) : null;

  const reserveNow = async () => {
    if (!bookingCleaner || !user?.id || !isClient()) return;
    if (!selectedSpaceId) return setBookingError(ui.noSpace);
    if (!selectedDate || !selectedTime) return setBookingError(ui.bookingError);
    if (!hasMinimumLeadHoursFromMontrealDateTime(selectedDate, selectedTime, 2)) return setBookingError(ui.sameDayLeadError);
    const scheduledDate = combineMontrealDateTimeToUtc(selectedDate, selectedTime);
    if (!scheduledDate) return setBookingError(ui.bookingError);

    setReserving(true);
    setBookingError(null);

    const scheduledAt = scheduledDate.toISOString();
    let insertRes = await supabase
      .from('bookings')
      .insert([{ client_id: user.id, cleaner_id: bookingCleaner.id, space_id: selectedSpaceId, service_type: bookingCleaner.services.join(','), scheduled_at: scheduledAt, estimated_hours: estimatedHours, status: 'pending' }])
      .select('id,status')
      .single();

    if (
      insertRes.error &&
      (insertRes.error.code === '42703' ||
        insertRes.error.message?.toLowerCase().includes('estimated_hours') ||
        insertRes.error.message?.toLowerCase().includes('cleaner_id'))
    ) {
      insertRes = await supabase
        .from('bookings')
        .insert([{ client_id: user.id, cleaner_id: bookingCleaner.id, space_id: selectedSpaceId, service_type: bookingCleaner.services.join(','), scheduled_at: scheduledAt, status: 'pending' }])
        .select('id,status')
        .single();
    }

    if (insertRes.error || !insertRes.data) {
      setBookingError(insertRes.error?.message ?? ui.bookingError);
      setReserving(false);
      return;
    }

    try {
      await fetch('/api/notifications/booking-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ event: 'booking_created', bookingId: insertRes.data.id })
      });
    } catch (error) {
      console.error('booking notification request error:', error);
    }

    const nextPath = `${successPath}?booking=${encodeURIComponent(insertRes.data.id)}`;
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
    setBookingCleaner(null);
    setReserving(false);
  };

  // Scroll hero search button helper
  const scrollToSearch = () => {
    document.getElementById('search-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const itemListStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: ui.title,
    itemListElement: (Object.entries(filters) as Array<[ServiceCategory, string]>)
      .filter(([category]) => category !== 'all')
      .map(([category, label], index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: label,
        url: `${seo.canonical}#${category}`
      }))
  };

  return (
    <main className="bg-white">
      <SEOHead
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        ogImage={seo.ogImage}
        hreflang={hreflang}
        structuredData={itemListStructuredData}
      />

      <section className="border-b border-[#E5E7EB] bg-[rgba(168,230,207,0.2)]">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-[#1A1A2E] md:text-5xl">{ui.title}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg text-[#6B7280]">{ui.subtitle}</p>
          <div id="search-anchor" className="mx-auto mt-10 grid max-w-4xl gap-4 rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_20px_40px_rgba(17,24,39,0.06)] backdrop-blur-sm md:grid-cols-[1.15fr_1fr_auto]">
            <div className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">
              <SlidersHorizontal size={18} className="text-[#6B7280]" />
              <select value={searchCategory} onChange={(event) => setSearchCategory(event.target.value as ServiceCategory)} className="w-full bg-transparent text-sm text-[#1A1A2E] outline-none">
                <option value="all">{ui.servicePlaceholder}</option>
                {(Object.entries(filters) as Array<[ServiceCategory, string]>)
                  .filter(([key]) => key !== 'all')
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="relative">
              <div className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">
                <Building2 size={18} className="text-[#6B7280]" />
                <input
                  ref={cityInputRef}
                  value={cityInput}
                  onChange={(event) => {
                    setCityInput(event.target.value);
                    setSelectedCity('');
                    setActiveSuggestionIndex(-1);
                  }}
                  onFocus={() => setCityFocused(true)}
                  onBlur={() => window.setTimeout(() => setCityFocused(false), 120)}
                  onKeyDown={(event) => {
                    if (!cityFocused || citySuggestions.length === 0) {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        runSearch();
                      }
                      return;
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setActiveSuggestionIndex((current) => (current + 1) % citySuggestions.length);
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setActiveSuggestionIndex((current) => (current <= 0 ? citySuggestions.length - 1 : current - 1));
                    } else if (event.key === 'Enter') {
                      event.preventDefault();
                      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < citySuggestions.length) selectCity(citySuggestions[activeSuggestionIndex]);
                      else runSearch();
                    } else if (event.key === 'Escape') {
                      setCityFocused(false);
                    }
                  }}
                  placeholder={ui.cityPlaceholder}
                  className="w-full bg-transparent text-sm text-[#1A1A2E] outline-none placeholder:text-[#9CA3AF]"
                />
              </div>
              {cityFocused && citySuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_14px_28px_rgba(17,24,39,0.12)]">
                  {citySuggestions.map((item, index) => (
                    <button
                      key={item}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectCity(item);
                      }}
                      className={`block w-full px-4 py-2.5 text-left text-sm transition-colors ${
                        index === activeSuggestionIndex ? 'bg-[#F0FAFF] text-[#0284C7]' : 'text-[#1A1A2E] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button onClick={runSearch} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4FC3F7] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#3FAAD4]">
              <Search size={18} />
              {ui.search}
            </button>
          </div>
          {errorMessage ? <p className="mt-4 text-sm font-semibold text-[#B91C1C]">{errorMessage}</p> : null}
        </div>
      </section>

      {/* Service category filter pills (shown after first search) */}
      {hasSearched ? (
        <div className="sticky top-0 z-20 border-b border-[#EEF2F7] bg-white/95 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              {(Object.entries(filters) as Array<[ServiceCategory, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSearchCategory(key);
                    setAppliedCategory(key);
                    setResultsPage(1);
                  }}
                  className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                    appliedCategory === key
                      ? 'border border-[#4FC3F7] bg-[rgba(79,195,247,0.14)] text-[#0284C7] shadow-[0_0_0_1px_rgba(79,195,247,0.22)]'
                      : 'border border-[#E5E7EB] bg-white text-[#4B5563] hover:border-[#4FC3F7] hover:text-[#0284C7]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Results section */}
      <section id="services-grid" className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">

          {/* Results header */}
          {hasSearched ? (
            <div className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1A2E] sm:text-3xl">
                  {appliedCity ? appliedCity : filters[appliedCategory]}
                </h2>
                <p className="mt-1 text-sm text-[#9CA3AF]">
                  {sortedResults.length} {ui.results}
                  {appliedCity && appliedCategory !== 'all' ? ` · ${filters[appliedCategory]}` : ''}
                </p>
              </div>
            </div>
          ) : null}

          {/* States: loading / pre-search / empty / results */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : !hasSearched ? (
            /* Pre-search prompt */
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(79,195,247,0.12)] text-[#0284C7]">
                <Search size={26} />
              </div>
              <p className="max-w-xs text-sm font-medium text-[#4B5563]">{ui.hint}</p>
              <button
                onClick={scrollToSearch}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#4FC3F7] px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.35)] transition-all hover:bg-[#38B2E8]"
              >
                <Search size={14} />
                {ui.search}
              </button>
            </div>
          ) : sortedResults.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F0F4F8] text-[#4FC3F7]">
                <MapPin size={26} />
              </div>
              <p className="text-base font-semibold text-[#1A1A2E]">{ui.noResult}</p>
              <p className="mt-1 text-sm text-[#9CA3AF]">{ui.noResultHint}</p>
            </div>
          ) : (
            <>
              {/* Cleaner grid */}
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {paginatedResults.map((cleaner) => {
                  const tags = cleaner.services.slice(0, 3);
                  const cityTags = cleaner.serviceAreas.slice(0, 2).map((a) => a.name);

                  return (
                    <article
                      key={cleaner.id}
                      className="group flex flex-col rounded-3xl border border-[#EEF2F7] bg-white shadow-[0_4px_20px_rgba(17,24,39,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_36px_rgba(17,24,39,0.11)]"
                    >
                      <div className="flex flex-col gap-3.5 p-5 sm:p-6">
                        {/* Header row: avatar + name + rate */}
                        <div className="flex items-start gap-3.5">
                          <div className="relative flex-shrink-0">
                            {cleaner.photoUrl ? (
                              <img src={cleaner.photoUrl} alt={cleaner.displayName} className="h-14 w-14 rounded-2xl object-cover" />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[rgba(79,195,247,0.2)] to-[rgba(168,230,207,0.25)] text-[#4FC3F7]">
                                <User size={22} />
                              </div>
                            )}
                            {/* Online indicator */}
                            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#4ADE80]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-base font-bold text-[#1A1A2E]">{cleaner.displayName}</p>
                              <span className="flex-shrink-0 rounded-xl bg-[rgba(79,195,247,0.12)] px-2.5 py-1 text-sm font-bold text-[#0284C7]">
                                {formatRate(cleaner.hourlyRate)}
                              </span>
                            </div>
                            {/* Rating + completed jobs */}
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <StarRating rating={cleaner.averageRating} count={cleaner.ratingCount} />
                              {cleaner.completedJobs > 0 ? (
                                <span className="text-[11px] font-semibold text-[#9CA3AF]">
                                  {cleaner.completedJobs} {ui.completedJobs}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Service tags */}
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {tags.map((service) => (
                              <span
                                key={`${cleaner.id}-${service}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]"
                              >
                                {(() => {
                                  const category = SERVICE_TO_CATEGORY[service];
                                  const Icon = SERVICE_ICON_COMPONENTS[category];
                                  return <Icon size={11} className="text-[#6B7280]" />;
                                })()}
                                {SERVICE_LABELS[service][language]}
                              </span>
                            ))}
                            {cleaner.services.length > 3 ? (
                              <span className="text-[11px] text-[#9CA3AF]">+{cleaner.services.length - 3}</span>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Zone + availability chips */}
                        <div className="flex flex-wrap items-center gap-2">
                          {cityTags.length > 0 ? (
                            cityTags.map((city) => (
                              <span
                                key={city}
                                className="inline-flex items-center gap-1 rounded-lg bg-[rgba(168,230,207,0.28)] px-2.5 py-1 text-[11px] font-semibold text-[#065F46]"
                              >
                                <MapPin size={10} />
                                {city}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[rgba(168,230,207,0.2)] px-2.5 py-1 text-[11px] font-semibold text-[#065F46]">
                              <MapPin size={10} />
                              {ui.zoneFallback}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[rgba(79,195,247,0.1)] px-2.5 py-1 text-[11px] font-semibold text-[#0284C7]">
                            <Clock3 size={10} />
                            {ui.avail}
                          </span>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="mx-5 border-t border-[#F0F4F8] sm:mx-6" />

                      {/* CTA row */}
                      <div className="flex items-center gap-2.5 p-4 sm:p-5">
                        <button
                          type="button"
                          onClick={() => setModalCleaner(cleaner)}
                          className="flex-1 rounded-2xl border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#4B5563] transition-colors hover:border-[#4FC3F7] hover:text-[#0284C7]"
                        >
                          {ui.details}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAvailabilityCleaner(cleaner)}
                          className="flex-1 rounded-2xl bg-[#4FC3F7] px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.3)] transition-all hover:bg-[#38B2E8] active:scale-[0.98]"
                        >
                          {ui.avail}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="mt-8">
                <PaginationControls
                  page={resultsPage}
                  totalPages={totalPages}
                  onPageChange={setResultsPage}
                  labels={{ previous: ui.previous, next: ui.next, page: ui.page }}
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Pricing section */}
      <section className="bg-[#F8FCFF] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-[#1A1A2E] sm:text-3xl">{ui.pricingTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4B5563] sm:text-base">{ui.pricingSubtitle}</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PRICING_BLOCKS[language].map((item, index) => {
              const Icon = PRICING_CARD_ICONS[index] ?? SlidersHorizontal;
              return (
              <article
                key={item.title}
                className="rounded-2xl border border-[#D1E7F7] bg-white p-5 shadow-[0_6px_20px_rgba(17,24,39,0.05)] transition-shadow hover:shadow-[0_10px_28px_rgba(17,24,39,0.09)]"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(79,195,247,0.1)] text-[#0284C7]">
                  <Icon size={18} />
                </div>
                <h3 className="text-sm font-bold text-[#1A1A2E]">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#4B5563]">{item.text}</p>
              </article>
            )})}
          </div>
        </div>
      </section>

      {/* FAQ section */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-[#1A1A2E] sm:text-3xl">{ui.faqTitle}</h2>
          <p className="mt-2 text-sm text-[#4B5563] sm:text-base">{ui.faqSubtitle}</p>
          <div className="mt-8 space-y-3">
            {FAQ_BY_LANG[language].map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={item.q}
                  className={`overflow-hidden rounded-2xl border transition-colors ${
                    isOpen ? 'border-[#C7E6F9] bg-[#F8FCFF]' : 'border-[#E5E7EB] bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-[#1A1A2E]">{item.q}</span>
                    <ChevronDown
                      size={16}
                      className={`flex-shrink-0 text-[#9CA3AF] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen ? (
                    <div className="px-5 pb-4">
                      <p className="text-sm leading-relaxed text-[#4B5563]">{item.a}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA banner */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div
          className="mx-auto max-w-6xl overflow-hidden rounded-3xl p-8 sm:p-10"
          style={{
            background: 'linear-gradient(135deg, rgba(79,195,247,0.14) 0%, rgba(168,230,207,0.25) 100%)',
            border: '1px solid rgba(79,195,247,0.25)'
          }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1A1A2E] sm:text-2xl">{ui.marketplaceTitle}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#374151] sm:text-base">{ui.marketplaceSubtitle}</p>
            </div>
            <button
              onClick={scrollToSearch}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-2xl bg-[#4FC3F7] px-7 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(79,195,247,0.3)] transition-all hover:bg-[#38B2E8] active:scale-[0.98] sm:self-auto"
            >
              <Search size={15} />
              {ui.marketplaceCta}
            </button>
          </div>
        </div>
      </section>

      <section className="bg-[rgba(79,195,247,0.1)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-[#1A1A2E]">Comment fonctionne la tarification</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <article className="rounded-3xl bg-white p-6 text-center shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] text-[#0284C7]">
                <SlidersHorizontal size={20} />
              </div>
              <h3 className="text-base font-bold text-[#1A1A2E]">Frais de plateforme</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
                Nettoyó facture un petit frais de plateforme par réservation (exemple : 5 $) pour faciliter la mise en relation.
              </p>
            </article>
            <article className="rounded-3xl bg-white p-6 text-center shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] text-[#0284C7]">
                <Star size={20} />
              </div>
              <h3 className="text-base font-bold text-[#1A1A2E]">Prix fixés par les nettoyeurs</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
                Chaque nettoyeur indépendant fixe ses propres tarifs. Comparez prix, disponibilité et avis avant de choisir.
              </p>
            </article>
            <article className="rounded-3xl bg-white p-6 text-center shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(79,195,247,0.15)] text-[#0284C7]">
                <Building2 size={20} />
              </div>
              <h3 className="text-base font-bold text-[#1A1A2E]">Paiement direct du service</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
                Le paiement de la prestation est réglé directement entre le client et le nettoyeur, en dehors de la plateforme.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-[#1A1A2E] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <h2 className="text-3xl font-bold text-white">Vous gérez plusieurs logements ou locaux ?</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#D1D5DB]">
              Nettoyó vous aide à trouver des nettoyeurs indépendants selon vos besoins récurrents, sans imposer de prestataire unique.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#4FC3F7]">
                <Search size={16} />
              </div>
              <p className="pt-1 text-sm font-semibold text-white">Comparez plusieurs profils pour un même besoin</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#4FC3F7]">
                <Clock3 size={16} />
              </div>
              <p className="pt-1 text-sm font-semibold text-white">Choisissez selon disponibilité, zone et prix</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#4FC3F7]">
                <MapPin size={16} />
              </div>
              <p className="pt-1 text-sm font-semibold text-white">Coordonnez directement avec les nettoyeurs retenus</p>
            </div>
          </div>
        </div>
      </section>

      {/* Details modal */}
      {modalCleaner ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-4"
          onClick={() => setModalCleaner(null)}
        >
          <div
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(17,24,39,0.25)]"
            onClick={(event) => event.stopPropagation()}
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
                <p className="mt-0.5 text-sm font-semibold text-[#0284C7]">{formatRate(modalCleaner.hourlyRate)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StarRating rating={modalCleaner.averageRating} count={modalCleaner.ratingCount} />
                  {modalCleaner.completedJobs > 0 ? (
                    <span className="text-[11px] text-[#9CA3AF]">{modalCleaner.completedJobs} {ui.completedJobs}</span>
                  ) : null}
                </div>
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
            {/* Description */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
              <div className="rounded-2xl bg-[#F8FAFC] p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">{ui.descriptionLabel}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#4B5563]">{modalCleaner.description || '--'}</p>
              </div>
              {/* Service areas */}
              {modalCleaner.serviceAreas.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">{ui.zonesLabel}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {modalCleaner.serviceAreas.map((area) => (
                      <span key={area.id} className="inline-flex items-center gap-1 rounded-lg bg-[rgba(168,230,207,0.28)] px-2.5 py-1 text-[11px] font-semibold text-[#065F46]">
                        <MapPin size={9} />
                        {area.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {/* Footer CTAs */}
            <div className="flex flex-shrink-0 items-center gap-3 border-t border-[#F0F4F8] p-5">
              <button
                type="button"
                onClick={() => setModalCleaner(null)}
                className="flex-1 rounded-2xl border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#6B7280] transition-colors hover:border-[#9CA3AF]"
              >
                {ui.close}
              </button>
              <button
                type="button"
                onClick={() => { setModalCleaner(null); setAvailabilityCleaner(modalCleaner); }}
                className="flex flex-1 items-center justify-center rounded-2xl bg-[#4FC3F7] py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.35)] transition-all hover:bg-[#38B2E8]"
              >
                {ui.avail}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Availability modal */}
      {availabilityCleaner ? (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/45 p-4"
          onClick={() => setAvailabilityCleaner(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl bg-white p-6 shadow-[0_20px_60px_rgba(17,24,39,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#1A1A2E]">{ui.avail}</h3>
                <p className="mt-0.5 text-sm font-semibold text-[#0284C7]">{availabilityCleaner.displayName}</p>
              </div>
              <button
                type="button"
                onClick={() => setAvailabilityCleaner(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#9CA3AF] transition-colors hover:border-[#DC2626] hover:text-[#DC2626]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              {availabilityRows.length === 0 ? (
                <p className="text-sm text-[#6B7280]">{ui.noAvailability}</p>
              ) : (
                <div className="space-y-2">
                  {availabilityRows.map((row) => (
                    <div key={row.day} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm">
                      <span className="font-semibold text-[#1A1A2E]">{dayLabel(row.day)}</span>
                      <span className="rounded-lg bg-[rgba(79,195,247,0.1)] px-2.5 py-1 text-[12px] font-semibold text-[#0284C7]">
                        {`${row.start} – ${row.end}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAvailabilityCleaner(null)}
                className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] hover:border-[#9CA3AF]"
              >
                {ui.close}
              </button>
              <button
                type="button"
                onClick={() => startBooking(availabilityCleaner)}
                disabled={Boolean(user) && isCleaner()}
                className="inline-flex min-w-[130px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.35)] hover:bg-[#38B2E8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ui.reserve}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Booking modal (2-step flow; unchanged logic) */}
      {bookingCleaner ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/45 p-4"
          onClick={() => setBookingCleaner(null)}
        >
          <div
            className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl bg-white shadow-[0_24px_70px_rgba(17,24,39,0.3)]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal top bar */}
            <div className="flex items-center justify-between gap-3 border-b border-[#F0F4F8] px-6 py-5">
              <div>
                <h3 className="text-base font-bold text-[#1A1A2E]">{ui.bookingFlowTitle}</h3>
                <p className="mt-0.5 text-sm font-medium text-[#0284C7]">{bookingCleaner.displayName}</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Step indicators */}
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

            {/* Step 1 */}
            {bookingStep === 1 ? (
              <div className="p-6">
                <h4 className="text-sm font-bold text-[#1A1A2E]">{ui.bookingStep1Title}</h4>
                <p className="mt-0.5 text-xs font-semibold text-[#0284C7]">{ui.bookingStep1Hint}</p>
                <div className="mt-4 rounded-2xl border border-[#D1E7F7] bg-[#F8FCFF] p-4 text-xs leading-relaxed text-[#4B5563]">
                  <p>{ui.bookingGuideSmall}</p>
                  <p className="mt-1">{ui.bookingGuideMedium}</p>
                  <p className="mt-1">{ui.bookingGuideLarge}</p>
                  <p className="mt-1">{ui.bookingGuideMove}</p>
                </div>
                <div className="mt-5">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">{ui.bookingHoursLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {ESTIMATED_HOURS.map((value) => (
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
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-semibold text-[#1A1A2E]">
                    {ui.address}
                    <select
                      value={selectedSpaceId}
                      onChange={(event) => setSelectedSpaceId(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#4FC3F7]"
                    >
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {[space.name, space.address, space.city].filter(Boolean).join(' - ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-[#1A1A2E]">
                      {ui.date}
                      <div className="relative mt-2">
                        <input
                          type="date"
                          min={minBookDate}
                          value={selectedDate}
                          onChange={(event) => setSelectedDate(event.target.value)}
                          className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A2E] outline-none focus:border-[#4FC3F7]"
                        />
                        {!selectedDate ? (
                          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-[#9CA3AF]">
                            {ui.datePlaceholder}
                          </span>
                        ) : null}
                      </div>
                    </label>
                    <TimePickerField value={selectedTime} onChange={setSelectedTime} label={ui.time} />
                  </div>
                </div>
                <p className="mt-4 rounded-2xl bg-[rgba(251,191,36,0.12)] px-4 py-3 text-xs font-medium text-[#92400E]">
                  {ui.bookingAdjustDisclaimer}
                </p>
                {spaces.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-[#D1E7F7] bg-[#F8FCFF] px-4 py-4 text-sm text-[#4B5563]">
                    <p>{ui.noSpace}</p>
                    <a
                      href={addSpacePath}
                      onClick={(event) => { event.preventDefault(); navigateTo('clientAddSpace'); }}
                      className="mt-3 inline-flex rounded-full bg-[#4FC3F7] px-4 py-2 text-xs font-semibold text-white"
                    >
                      {ui.addSpace}
                    </a>
                  </div>
                ) : null}
                {bookingError ? <p className="mt-4 text-sm font-semibold text-[#B91C1C]">{bookingError}</p> : null}
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setBookingStep(2)}
                    disabled={spaces.length === 0 || !selectedDate || !selectedTime}
                    className="rounded-2xl bg-[#4FC3F7] px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.35)] transition-all hover:bg-[#38B2E8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {ui.continue}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Step 2 — Summary */}
            {bookingStep === 2 ? (
              <div className="p-6">
                <h4 className="mb-4 text-sm font-bold text-[#1A1A2E]">{ui.bookingSummaryTitle}</h4>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[
                    { label: ui.bookingSummaryAddress, value: [selectedSpace?.address, selectedSpace?.city].filter(Boolean).join(', ') || '--' },
                    { label: ui.bookingSummaryRate, value: formatRate(bookingCleaner.hourlyRate) },
                    { label: ui.bookingSummaryHours, value: `${estimatedHours}h` },
                    { label: ui.bookingSummaryDate, value: selectedDate || '--' },
                    { label: ui.bookingSummaryTime, value: selectedTime || '--' }
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-2xl border border-[#EEF2F7] bg-[#F8FAFC] p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-[#1A1A2E]">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3.5 flex items-center justify-between rounded-2xl border border-[#A7F3D0] bg-[rgba(168,230,207,0.18)] px-4 py-3">
                  <span className="text-sm font-semibold text-[#065F46]">{ui.bookingApproxTotal}</span>
                  <span className="text-base font-bold text-[#065F46]">{approxTotal !== null ? `~${approxTotal}$` : '--'}</span>
                </div>
                <div className="mt-3 rounded-2xl border border-[#D1E7F7] bg-[#F8FCFF] px-4 py-3 text-xs leading-relaxed text-[#4B5563]">
                  <p>{ui.paymentDisclaimer1}</p>
                  <p className="mt-1">{ui.paymentDisclaimer2}</p>
                </div>
                {bookingError ? <p className="mt-4 text-sm font-semibold text-[#B91C1C]">{bookingError}</p> : null}
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setBookingStep(1)}
                    className="flex-1 rounded-2xl border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#6B7280] transition-colors hover:border-[#9CA3AF]"
                  >
                    {ui.back}
                  </button>
                  <button
                    type="button"
                    onClick={() => void reserveNow()}
                    disabled={reserving || spaces.length === 0 || !selectedDate || !selectedTime}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#4FC3F7] py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(79,195,247,0.35)] transition-all hover:bg-[#38B2E8] disabled:opacity-60"
                  >
                    {reserving ? <Loader2 size={14} className="animate-spin" /> : ui.finish}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}


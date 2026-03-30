import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bath, BedDouble, Briefcase, Building2, Camera, ChefHat, ChevronLeft, ChevronRight, Grid2x2 as Grid2X2, Home, Loader2, Lock, MapPin, Monitor, Pencil, Plus, Shirt, Sofa, Star, Trash2, Warehouse, WashingMachine, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getPathForRoute } from '../i18n/routes';
import { convertToWebP } from '../lib/imageUtils';
import supabase from '../lib/supabase';

type SpaceType = 'apartment' | 'house' | 'office' | 'other';
type FormatSystem = 'quebec' | 'international';
type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
type RoomKey =
  | 'bedroom'
  | 'living_room'
  | 'bathroom'
  | 'kitchen'
  | 'office'
  | 'basement'
  | 'walk_in_closet'
  | 'laundry_room';

type Rooms = Record<RoomKey, number>;
type RoomSummaryLabels = Record<RoomKey, string>;

type SpaceRecord = {
  id: string;
  client_id: string;
  name: string;
  type: SpaceType;
  format_system: FormatSystem;
  quebec_format: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  floor: string | null;
  access_code: string | null;
  photo_url: string | null;
  notes: string | null;
  is_favorite: boolean;
  is_active: boolean;
  rooms: Partial<Record<RoomKey, number>> | null;
  created_at: string;
  updated_at: string;
};

type BookingRecord = {
  id: string;
  client_id: string;
  space_id: string;
  status: BookingStatus;
  service_type: string | null;
  scheduled_at: string | null;
  created_at: string;
  spaces?: { name: string } | { name: string }[] | null;
};

type AddSpaceForm = {
  name: string;
  type: SpaceType | null;
  formatSystem: FormatSystem;
  quebecFormat: string;
  rooms: Rooms;
  address: string;
  city: string;
  postalCode: string;
  floor: string;
  accessCode: string;
  notes: string;
  isFavorite: boolean;
};

const emptyRooms: Rooms = {
  bedroom: 0,
  living_room: 0,
  bathroom: 0,
  kitchen: 0,
  office: 0,
  basement: 0,
  walk_in_closet: 0,
  laundry_room: 0
};

const formatRoomPresets: Record<string, Rooms> = {
  '2½': { ...emptyRooms, living_room: 1, kitchen: 1, bathroom: 1 },
  '3½': { ...emptyRooms, bedroom: 1, living_room: 1, kitchen: 1, bathroom: 1 },
  '4½': { ...emptyRooms, bedroom: 2, living_room: 1, kitchen: 1, bathroom: 1 },
  '5½': { ...emptyRooms, bedroom: 3, living_room: 1, kitchen: 1, bathroom: 1 },
  '6½': { ...emptyRooms, bedroom: 4, living_room: 1, kitchen: 1, bathroom: 1 },
  '7½': { ...emptyRooms, bedroom: 5, living_room: 1, kitchen: 1, bathroom: 1 },
  '8½+': { ...emptyRooms, bedroom: 6, living_room: 2, kitchen: 1, bathroom: 2 }
};

const roomOrder: RoomKey[] = [
  'bedroom',
  'living_room',
  'kitchen',
  'bathroom',
  'office',
  'basement',
  'walk_in_closet',
  'laundry_room'
];

const localeByLanguage = {
  fr: 'fr-CA',
  en: 'en-US',
  es: 'es-ES'
} as const;

const ADD_SPACE_DRAFT_STORAGE_KEY = 'nettoyo_add_space_draft';
const ADD_SPACE_DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const typeIcons: Record<SpaceType, ReactNode> = {
  apartment: <Building2 size={28} />,
  house: <Home size={28} />,
  office: <Briefcase size={28} />,
  other: <Grid2X2 size={28} />
};

function pageStyles() {
  return (
    <style>{`
      @keyframes room-count-up {
        0% { opacity: 0; transform: translateY(12px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes room-count-down {
        0% { opacity: 0; transform: translateY(-12px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes room-count-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      @keyframes step-slide-forward {
        0% { opacity: 0; transform: translateX(24px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @keyframes step-slide-backward {
        0% { opacity: 0; transform: translateX(-24px); }
        100% { opacity: 1; transform: translateX(0); }
      }
    `}</style>
  );
}

function getInitials(firstName?: string | null, lastName?: string | null, email?: string | null) {
  const first = firstName?.[0] ?? email?.[0] ?? 'N';
  const second = lastName?.[0] ?? email?.[1] ?? '';
  return `${first}${second}`.toUpperCase();
}

function formatDate(language: 'fr' | 'en' | 'es', value?: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(localeByLanguage[language], {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function normalizeRooms(rooms?: Partial<Record<RoomKey, number>> | null): Rooms {
  return {
    bedroom: Number(rooms?.bedroom ?? 0),
    living_room: Number(rooms?.living_room ?? 0),
    bathroom: Number(rooms?.bathroom ?? 0),
    kitchen: Number(rooms?.kitchen ?? 0),
    office: Number(rooms?.office ?? 0),
    basement: Number(rooms?.basement ?? 0),
    walk_in_closet: Number(rooms?.walk_in_closet ?? 0),
    laundry_room: Number(rooms?.laundry_room ?? 0)
  };
}

function getSpaceDisplayName(booking: BookingRecord) {
  if (Array.isArray(booking.spaces)) {
    return booking.spaces[0]?.name ?? '';
  }

  return booking.spaces?.name ?? '';
}

const contentByLanguage = {
  fr: {
    header: { greeting: 'Bonjour', badge: 'Client vérifié', editProfile: 'Modifier le profil' },
    stats: {
      spaces: 'Espaces enregistrés',
      bookings: 'Nettoyages effectués',
      rating: 'Note moyenne donnée'
    },
    spaces: {
      title: 'Mes espaces',
      add: '+ Ajouter un espace',
      noCleaning: 'Aucun nettoyage',
      lastCleaning: 'Dernier nettoyage',
      noSpaces: "Vous n'avez pas encore d'espace enregistré",
      deleteConfirm: 'Supprimer cet espace ?',
      deletedToast: 'Espace supprimé avec succès !'
    },
    history: {
      title: 'Historique des nettoyages',
      empty: "Aucun nettoyage pour l'instant",
      pending: 'En attente',
      confirmed: 'Confirmé',
      completed: 'Terminé',
      cancelled: 'Annulé',
      noService: 'Service à confirmer'
    },
    addSpace: {
      indicator: 'Étape {current} sur 4',
      back: 'Retour',
      next: 'Continuer',
      save: "Enregistrer l'espace",
      saving: 'Enregistrement...',
      photo: "Ajouter une photo de l'espace",
      favorite: 'Marquer comme espace principal',
      favoriteHint: 'Votre espace principal apparaîtra en premier',
      success: 'Espace enregistré avec succès !',
      photoSelected: 'Photo sélectionnée: {size}',
      photoOptimized: 'Photo optimisée: {size} (WebP) ✓',
      draftRestored: 'Brouillon restauré - continuez où vous vous étiez arrêté',
      errors: {
        stepOne: "Choisissez un type d'espace et ajoutez un nom.",
        stepTwo: 'Sélectionnez une taille ou ajustez les compteurs.',
        upload: "Impossible d'envoyer la photo pour le moment.",
        generic: "Impossible d'enregistrer cet espace pour le moment.",
        profileMissing: 'Impossible de sauvegarder sans profil client actif.'
      },
      stepTitles: [
        "Type d'espace",
        'Format et taille',
        'Détail des pièces',
        "Informations de l'espace"
      ],
      typeStep: {
        title: "Quel type d'espace souhaitez-vous ajouter ?",
        namePlaceholder: "Nom de l'espace (ex: Mon appartement)",
        cards: {
          apartment: { title: 'Appartement', description: 'En immeuble ou condo' },
          house: { title: 'Maison', description: 'Maison unifamiliale ou jumelée' },
          office: { title: 'Bureau', description: 'Local commercial ou professionnel' },
          other: { title: 'Autre', description: 'Chalet, garage, entrepôt...' }
        }
      },
      sizeStep: {
        quebec: 'Québec (X½)',
        international: 'International',
        title: 'Quelle est la taille de votre logement ?',
        subtitle: 'En Québec, un 4½ = 2 chambres + salon + cuisine + salle de bain',
        bedrooms: 'Chambres',
        bathrooms: 'Salles de bain',
        formats: [
          { value: '2½', label: 'Studio' },
          { value: '3½', label: '1 chambre' },
          { value: '4½', label: '2 chambres' },
          { value: '5½', label: '3 chambres' },
          { value: '6½', label: '4 chambres' },
          { value: '7½', label: '5 chambres' },
          { value: '8½+', label: 'Grande maison' }
        ]
      },
      roomsStep: {
        title: 'Détaillez vos pièces',
        subtitle: 'Cliquez pour ajuster le nombre de chaque pièce',
        total: 'Total : {count} pièces sélectionnées',
        labels: {
          bedroom: 'Chambre',
          living_room: 'Salon',
          kitchen: 'Cuisine',
          bathroom: 'Salle de bain',
          office: 'Bureau',
          basement: 'Sous-sol',
          walk_in_closet: 'Walk-in',
          laundry_room: 'Buanderie'
        }
      },
      detailsStep: {
        title: "Informations sur l'espace",
        address: 'Adresse',
        city: 'Ville',
        postalCode: 'Code postal',
        floor: 'Étage',
        accessCode: "Code d'accès",
        accessCodePlaceholder: 'Ex: #1234 ou sonnette 3B',
        notes: 'Notes pour le nettoyeur',
        notesPlaceholder: 'Instructions pour le nettoyeur (animaux, zones à éviter, produits préférés...)',
        removePhoto: 'Retirer la photo'
      }
    },
    typeLabels: {
      apartment: 'Appartement',
      house: 'Maison',
      office: 'Bureau',
      other: 'Autre'
    },
    roomSummaryLabels: {
      bedroom: 'chambres',
      living_room: 'salons',
      bathroom: 'salles de bain',
      kitchen: 'cuisines',
      office: 'bureaux',
      basement: 'sous-sols',
      walk_in_closet: 'walk-ins',
      laundry_room: 'buanderies'
    }
  },
  en: {
    header: { greeting: 'Hello', badge: 'Verified client', editProfile: 'Edit profile' },
    stats: {
      spaces: 'Registered spaces',
      bookings: 'Cleanings completed',
      rating: 'Average rating given'
    },
    spaces: {
      title: 'My spaces',
      add: '+ Add a space',
      noCleaning: 'No cleaning yet',
      lastCleaning: 'Last cleaning',
      noSpaces: "You haven't registered any space yet",
      deleteConfirm: 'Delete this space?',
      deletedToast: 'Space deleted successfully!'
    },
    history: {
      title: 'Cleaning history',
      empty: 'No cleanings yet',
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
      noService: 'Service to confirm'
    },
    addSpace: {
      indicator: 'Step {current} of 4',
      back: 'Back',
      next: 'Continue',
      save: 'Save space',
      saving: 'Saving...',
      photo: 'Add a photo of the space',
      favorite: 'Mark as main space',
      favoriteHint: 'Your main space will appear first',
      success: 'Space saved successfully!',
      photoSelected: 'Selected photo: {size}',
      photoOptimized: 'Optimized photo: {size} (WebP) ✓',
      draftRestored: 'Draft restored - continue where you left off',
      errors: {
        stepOne: 'Choose a space type and add a name.',
        stepTwo: 'Select a size or adjust the counters.',
        upload: 'Unable to upload the photo right now.',
        generic: 'Unable to save this space right now.',
        profileMissing: 'Unable to save without an active client profile.'
      },
      stepTitles: ['Space type', 'Format and size', 'Room details', 'Space information'],
      typeStep: {
        title: 'What type of space do you want to add?',
        namePlaceholder: 'Space name (e.g. My apartment)',
        cards: {
          apartment: { title: 'Apartment', description: 'In a building or condo' },
          house: { title: 'House', description: 'Single or semi-detached home' },
          office: { title: 'Office', description: 'Commercial or professional space' },
          other: { title: 'Other', description: 'Cottage, garage, storage...' }
        }
      },
      sizeStep: {
        quebec: 'Québec (X½)',
        international: 'International',
        title: 'What is the size of your home?',
        subtitle: 'In Quebec, a 4½ = 2 bedrooms + living room + kitchen + bathroom',
        bedrooms: 'Bedrooms',
        bathrooms: 'Bathrooms',
        formats: [
          { value: '2½', label: 'Studio' },
          { value: '3½', label: '1 bedroom' },
          { value: '4½', label: '2 bedrooms' },
          { value: '5½', label: '3 bedrooms' },
          { value: '6½', label: '4 bedrooms' },
          { value: '7½', label: '5 bedrooms' },
          { value: '8½+', label: 'Large home' }
        ]
      },
      roomsStep: {
        title: 'Detail your rooms',
        subtitle: 'Click to adjust the count of each room',
        total: 'Total: {count} rooms selected',
        labels: {
          bedroom: 'Bedroom',
          living_room: 'Living room',
          kitchen: 'Kitchen',
          bathroom: 'Bathroom',
          office: 'Office',
          basement: 'Basement',
          walk_in_closet: 'Walk-in closet',
          laundry_room: 'Laundry room'
        }
      },
      detailsStep: {
        title: 'Space information',
        address: 'Address',
        city: 'City',
        postalCode: 'Postal code',
        floor: 'Floor',
        accessCode: 'Access code',
        accessCodePlaceholder: 'E.g. #1234 or buzzer 3B',
        notes: 'Notes for the cleaner',
        notesPlaceholder: 'Instructions for the cleaner (pets, areas to avoid, preferred products...)',
        removePhoto: 'Remove photo'
      }
    },
    typeLabels: { apartment: 'Apartment', house: 'House', office: 'Office', other: 'Other' },
    roomSummaryLabels: {
      bedroom: 'bedrooms',
      living_room: 'living rooms',
      bathroom: 'bathrooms',
      kitchen: 'kitchens',
      office: 'offices',
      basement: 'basements',
      walk_in_closet: 'walk-ins',
      laundry_room: 'laundry rooms'
    }
  },
  es: {
    header: { greeting: 'Hola', badge: 'Cliente verificado', editProfile: 'Editar perfil' },
    stats: {
      spaces: 'Espacios registrados',
      bookings: 'Limpiezas realizadas',
      rating: 'Puntuación media dada'
    },
    spaces: {
      title: 'Mis espacios',
      add: '+ Agregar un espacio',
      noCleaning: 'Aún sin limpieza',
      lastCleaning: 'Última limpieza',
      noSpaces: 'Aún no tienes ningún espacio registrado',
      deleteConfirm: '¿Eliminar este espacio?',
      deletedToast: '¡Espacio eliminado con éxito!'
    },
    history: {
      title: 'Historial de limpiezas',
      empty: 'Aún no hay limpiezas',
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      completed: 'Completado',
      cancelled: 'Cancelado',
      noService: 'Servicio por confirmar'
    },
    addSpace: {
      indicator: 'Paso {current} de 4',
      back: 'Atrás',
      next: 'Continuar',
      save: 'Guardar espacio',
      saving: 'Guardando...',
      photo: 'Agregar una foto del espacio',
      favorite: 'Marcar como espacio principal',
      favoriteHint: 'Tu espacio principal aparecerá primero',
      success: '¡Espacio guardado con éxito!',
      photoSelected: 'Foto seleccionada: {size}',
      photoOptimized: 'Foto optimizada: {size} (WebP) ✓',
      draftRestored: 'Borrador restaurado - continúa donde lo dejaste',
      errors: {
        stepOne: 'Elige un tipo de espacio y añade un nombre.',
        stepTwo: 'Selecciona un tamaño o ajusta los contadores.',
        upload: 'No se pudo subir la foto en este momento.',
        generic: 'No se pudo guardar este espacio en este momento.',
        profileMissing: 'No se puede guardar sin un perfil de cliente activo.'
      },
      stepTitles: ['Tipo de espacio', 'Formato y tamaño', 'Detalle de habitaciones', 'Información del espacio'],
      typeStep: {
        title: '¿Qué tipo de espacio quieres agregar?',
        namePlaceholder: 'Nombre del espacio (ej: Mi apartamento)',
        cards: {
          apartment: { title: 'Apartamento', description: 'En edificio o condominio' },
          house: { title: 'Casa', description: 'Casa unifamiliar o adosada' },
          office: { title: 'Oficina', description: 'Local comercial o profesional' },
          other: { title: 'Otro', description: 'Cabaña, garaje, almacén...' }
        }
      },
      sizeStep: {
        quebec: 'Québec (X½)',
        international: 'International',
        title: '¿Cuál es el tamaño de tu vivienda?',
        subtitle: 'En Quebec, un 4½ = 2 habitaciones + sala + cocina + baño',
        bedrooms: 'Habitaciones',
        bathrooms: 'Baños',
        formats: [
          { value: '2½', label: 'Estudio' },
          { value: '3½', label: '1 habitación' },
          { value: '4½', label: '2 habitaciones' },
          { value: '5½', label: '3 habitaciones' },
          { value: '6½', label: '4 habitaciones' },
          { value: '7½', label: '5 habitaciones' },
          { value: '8½+', label: 'Casa grande' }
        ]
      },
      roomsStep: {
        title: 'Detalla tus habitaciones',
        subtitle: 'Haz clic para ajustar el número de cada habitación',
        total: 'Total: {count} habitaciones seleccionadas',
        labels: {
          bedroom: 'Habitación',
          living_room: 'Sala',
          kitchen: 'Cocina',
          bathroom: 'Baño',
          office: 'Oficina',
          basement: 'Sótano',
          walk_in_closet: 'Vestidor',
          laundry_room: 'Lavandería'
        }
      },
      detailsStep: {
        title: 'Información del espacio',
        address: 'Dirección',
        city: 'Ciudad',
        postalCode: 'Código postal',
        floor: 'Piso',
        accessCode: 'Código de acceso',
        accessCodePlaceholder: 'Ej: #1234 o timbre 3B',
        notes: 'Instrucciones para el limpiador',
        notesPlaceholder: 'Instrucciones para el limpiador (mascotas, zonas a evitar, productos preferidos...)',
        removePhoto: 'Quitar foto'
      }
    },
    typeLabels: { apartment: 'Apartamento', house: 'Casa', office: 'Oficina', other: 'Otro' },
    roomSummaryLabels: {
      bedroom: 'habitaciones',
      living_room: 'salas',
      bathroom: 'baños',
      kitchen: 'cocinas',
      office: 'oficinas',
      basement: 'sótanos',
      walk_in_closet: 'vestidores',
      laundry_room: 'lavanderías'
    }
  }
} as const;

function formatBadge(space: SpaceRecord, labels: RoomSummaryLabels) {
  if (space.format_system === 'quebec' && space.quebec_format) {
    return space.quebec_format;
  }

  const rooms = normalizeRooms(space.rooms);
  return `${rooms.bedroom} ${labels.bedroom} / ${rooms.bathroom} ${labels.bathroom}`;
}

function buildRoomSummary(space: SpaceRecord, labels: RoomSummaryLabels) {
  const rooms = normalizeRooms(space.rooms);

  return roomOrder
    .filter((roomKey) => rooms[roomKey] > 0)
    .slice(0, 3)
    .map((roomKey) => `${rooms[roomKey]} ${labels[roomKey]}`)
    .join(' · ');
}

function CounterButton({
  icon,
  disabled,
  onClick,
  tone = 'sky'
}: {
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'sky' | 'gray';
}) {
  const classes =
    tone === 'sky'
      ? 'border-[#4FC3F7] text-[#4FC3F7] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(79,195,247,0.16)]'
      : 'border-[#D1D5DB] text-[#6B7280] hover:-translate-y-0.5';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full border bg-white transition-all ${classes} disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {icon}
    </button>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label ? <span className="mb-2 block text-sm font-medium text-[#1A1A2E]">{label}</span> : null}
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  icon,
  type = 'text'
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon?: ReactNode;
  type?: string;
}) {
  return (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
          {icon}
        </span>
      ) : null}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-[#1A1A2E] outline-none transition-all placeholder:text-[#9CA3AF] focus:border-[#4FC3F7] focus:shadow-[0_0_0_4px_rgba(79,195,247,0.12)] ${icon ? 'pl-11' : ''}`}
      />
    </div>
  );
}

function NumberStepper({
  value,
  onChange,
  label
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-[0_10px_24px_rgba(17,24,39,0.04)]">
        <CounterButton
          icon={<span className="text-lg">−</span>}
          disabled={value === 0}
          tone="gray"
          onClick={() => onChange(Math.max(0, value - 1))}
        />
        <span className="text-2xl font-bold text-[#1A1A2E]">{value}</span>
        <CounterButton icon={<Plus size={16} />} onClick={() => onChange(value + 1)} />
      </div>
    </Field>
  );
}

export function ClientDashboardPage() {
  const { language, navigateTo } = useLanguage();
  const { profile } = useAuth();
  const content = contentByLanguage[language];
  const addSpacePath = getPathForRoute(language, 'clientAddSpace');
  const [spaces, setSpaces] = useState<SpaceRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setErrorMessage(null);

      const [spacesResponse, bookingsResponse, completedResponse] = await Promise.all([
        supabase
          .from('spaces')
          .select('*')
          .eq('client_id', profile.id)
          .eq('is_active', true)
          .order('is_favorite', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('id, client_id, space_id, status, service_type, scheduled_at, created_at, spaces(name)')
          .eq('client_id', profile.id)
          .order('scheduled_at', { ascending: false })
          .limit(5),
        supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', profile.id)
          .eq('status', 'completed')
      ]);

      if (!active) {
        return;
      }

      if (spacesResponse.error || bookingsResponse.error || completedResponse.error) {
        setErrorMessage('Unable to load the dashboard right now.');
        setLoading(false);
        return;
      }

      setSpaces((spacesResponse.data as SpaceRecord[] | null) ?? []);
      setBookings((bookingsResponse.data as BookingRecord[] | null) ?? []);
      setCompletedCount(completedResponse.count ?? 0);
      setLoading(false);
    };

    void loadDashboard();

    const message = window.sessionStorage.getItem('client-dashboard-toast');
    if (message) {
      setToast(message);
      window.sessionStorage.removeItem('client-dashboard-toast');
      window.setTimeout(() => setToast(null), 2400);
    }

    return () => {
      active = false;
    };
  }, [profile?.id]);

  const lastCleaningBySpace = useMemo(() => {
    const map = new Map<string, string>();

    bookings
      .filter((booking) => booking.status === 'completed' && booking.scheduled_at)
      .forEach((booking) => {
        if (!map.has(booking.space_id) && booking.scheduled_at) {
          map.set(booking.space_id, booking.scheduled_at);
        }
      });

    return map;
  }, [bookings]);

  const handleFavoriteToggle = async (space: SpaceRecord) => {
    if (!profile?.id) {
      return;
    }

    const nextFavorite = !space.is_favorite;

    if (nextFavorite) {
      await supabase.from('spaces').update({ is_favorite: false }).eq('client_id', profile.id);
    }

    const { error } = await supabase
      .from('spaces')
      .update({ is_favorite: nextFavorite, updated_at: new Date().toISOString() })
      .eq('id', space.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSpaces((currentSpaces) =>
      currentSpaces.map((currentSpace) =>
        nextFavorite
          ? { ...currentSpace, is_favorite: currentSpace.id === space.id }
          : currentSpace.id === space.id
            ? { ...currentSpace, is_favorite: false }
            : currentSpace
      )
    );
  };

  const handleDelete = async (space: SpaceRecord) => {
    if (!window.confirm(content.spaces.deleteConfirm)) {
      return;
    }

    const { error } = await supabase.from('spaces').delete().eq('id', space.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSpaces((currentSpaces) => currentSpaces.filter((currentSpace) => currentSpace.id !== space.id));
    setToast(content.spaces.deletedToast);
    window.setTimeout(() => setToast(null), 2400);
  };

  const displayName = profile?.first_name || profile?.email || 'Nettoyo';

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#F7F7F7] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {pageStyles()}
        {toast ? (
          <div className="fixed right-4 top-24 z-50 rounded-full bg-[#1A1A2E] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(17,24,39,0.2)]">
            {toast}
          </div>
        ) : null}

        <section className="rounded-[28px] bg-white px-6 py-8 shadow-[0_16px_36px_rgba(17,24,39,0.07)] sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-5">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-20 w-20 rounded-full object-cover shadow-[0_10px_30px_rgba(79,195,247,0.18)]"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#4FC3F7] text-2xl font-bold text-white shadow-[0_10px_30px_rgba(79,195,247,0.24)]">
                  {getInitials(profile?.first_name, profile?.last_name, profile?.email)}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4FC3F7]">
                  {content.header.greeting}, {profile?.first_name || displayName}
                </p>
                <h1 className="mt-2 text-3xl font-bold text-[#1A1A2E]">
                  {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || displayName}
                </h1>
                <p className="mt-2 text-[#6B7280]">{profile?.email}</p>
                <span className="mt-4 inline-flex rounded-full bg-[rgba(168,230,207,0.35)] px-3 py-1 text-sm font-semibold text-[#1A1A2E]">
                  {content.header.badge}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-5 py-3 font-semibold text-[#1A1A2E] shadow-[0_10px_20px_rgba(17,24,39,0.05)] transition-colors hover:bg-[#F7F7F7]"
            >
              {content.header.editProfile}
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { value: spaces.length, label: content.stats.spaces },
            { value: completedCount, label: content.stats.bookings },
            { value: '4.9 ★', label: content.stats.rating }
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)]"
            >
              <p className="text-4xl font-bold text-[#4FC3F7]">{stat.value}</p>
              <p className="mt-2 text-sm text-[#6B7280]">{stat.label}</p>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold text-[#1A1A2E]">{content.spaces.title}</h2>
            <a
              href={addSpacePath}
              onClick={(event) => {
                event.preventDefault();
                navigateTo('clientAddSpace');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#4FC3F7] px-5 py-3 font-semibold text-white shadow-[0_14px_28px_rgba(79,195,247,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#3FAAD4]"
            >
              <Plus size={18} />
              {content.spaces.add.replace('+ ', '')}
            </a>
          </div>

          {loading ? (
            <div className="rounded-[28px] bg-white p-10 text-center shadow-[0_14px_32px_rgba(17,24,39,0.06)]">
              <Loader2 className="mx-auto animate-spin text-[#4FC3F7]" size={28} />
            </div>
          ) : spaces.length === 0 ? (
            <div className="rounded-[28px] bg-white px-6 py-14 text-center shadow-[0_14px_32px_rgba(17,24,39,0.06)]">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(168,230,207,0.25)] text-[#60B99A]">
                <Home size={36} />
              </div>
              <p className="mt-6 text-lg font-semibold text-[#1A1A2E]">{content.spaces.noSpaces}</p>
              <a
                href={addSpacePath}
                onClick={(event) => {
                  event.preventDefault();
                  navigateTo('clientAddSpace');
                }}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-[#4FC3F7] px-6 py-3 font-semibold text-white shadow-[0_14px_28px_rgba(79,195,247,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#3FAAD4]"
              >
                {content.spaces.add}
              </a>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {spaces.map((space) => {
                const lastCleaning = lastCleaningBySpace.get(space.id);
                const editHref = `${addSpacePath}?edit=${space.id}`;

                return (
                  <article
                    key={space.id}
                    className="overflow-hidden rounded-[24px] bg-white shadow-[0_16px_34px_rgba(17,24,39,0.07)]"
                  >
                    <div className="relative h-52 overflow-hidden">
                      {space.photo_url ? (
                        <img src={space.photo_url} alt={space.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#4FC3F7] to-[#A8E6CF] text-white">
                          <Building2 size={52} />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleFavoriteToggle(space)}
                        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-[0_8px_18px_rgba(17,24,39,0.12)] transition-transform hover:scale-105"
                      >
                        <Star
                          size={18}
                          className={space.is_favorite ? 'fill-[#FBBF24] text-[#FBBF24]' : 'text-[#9CA3AF]'}
                        />
                      </button>
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-[#1A1A2E]">{space.name}</h3>
                      <span className="mt-2 inline-flex rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-[#6B7280]">
                        {content.typeLabels[space.type]}
                      </span>
                      <div className="mt-4 flex items-start gap-2 text-sm text-[#6B7280]">
                        <MapPin size={16} className="mt-0.5 shrink-0" />
                        <span>{[space.address, space.city].filter(Boolean).join(', ') || '—'}</span>
                      </div>
                      <span className="mt-4 inline-flex rounded-full bg-[rgba(168,230,207,0.35)] px-3 py-1 text-xs font-semibold text-[#1A1A2E]">
                        {formatBadge(space, content.roomSummaryLabels)}
                      </span>
                      <p className="mt-3 text-xs text-[#6B7280]">
                        {buildRoomSummary(space, content.roomSummaryLabels) || '—'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#E5E7EB] px-5 py-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9CA3AF]">
                          {content.spaces.lastCleaning}
                        </p>
                        <p className="mt-1 text-sm text-[#6B7280]">
                          {lastCleaning ? formatDate(language, lastCleaning) : content.spaces.noCleaning}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={editHref}
                          onClick={(event) => {
                            event.preventDefault();
                            window.history.pushState({}, '', editHref);
                            window.dispatchEvent(new PopStateEvent('popstate'));
                          }}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280] transition-all hover:-translate-y-0.5 hover:text-[#1A1A2E]"
                        >
                          <Pencil size={16} />
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleDelete(space)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280] transition-all hover:-translate-y-0.5 hover:text-[#DC2626]"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[28px] bg-white p-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)]">
          <h2 className="text-2xl font-bold text-[#1A1A2E]">{content.history.title}</h2>
          {errorMessage ? (
            <div className="mt-5 rounded-2xl bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[#B91C1C]">
              {errorMessage}
            </div>
          ) : null}
          {bookings.length === 0 ? (
            <p className="mt-5 text-sm text-[#6B7280]">{content.history.empty}</p>
          ) : (
            <div className="mt-6 space-y-3">
              {bookings.map((booking) => {
                const statusTone =
                  booking.status === 'completed'
                    ? 'bg-[rgba(168,230,207,0.38)] text-[#047857]'
                    : booking.status === 'confirmed'
                      ? 'bg-[rgba(79,195,247,0.18)] text-[#0284C7]'
                      : booking.status === 'cancelled'
                        ? 'bg-[rgba(239,68,68,0.14)] text-[#DC2626]'
                        : 'bg-[rgba(245,158,11,0.18)] text-[#B45309]';

                const statusLabel =
                  booking.status === 'completed'
                    ? content.history.completed
                    : booking.status === 'confirmed'
                      ? content.history.confirmed
                      : booking.status === 'cancelled'
                        ? content.history.cancelled
                        : content.history.pending;

                return (
                  <div
                    key={booking.id}
                    className="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone}`}>
                        {statusLabel}
                      </span>
                      <div>
                        <p className="font-semibold text-[#1A1A2E]">{getSpaceDisplayName(booking) || '—'}</p>
                        <p className="text-sm text-[#6B7280]">
                          {booking.service_type || content.history.noService} ·{' '}
                          {formatDate(language, booking.scheduled_at || booking.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-[#6B7280]">$--</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function ClientAddSpacePage() {
  const { language, navigateTo } = useLanguage();
  const { profile } = useAuth();
  const content = contentByLanguage[language];
  const editingId = useMemo(() => new URLSearchParams(window.location.search).get('edit'), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(1);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const [form, setForm] = useState<AddSpaceForm>({
    name: '',
    type: null,
    formatSystem: 'quebec',
    quebecFormat: '4½',
    rooms: formatRoomPresets['4½'],
    address: '',
    city: '',
    postalCode: '',
    floor: '',
    accessCode: '',
    notes: '',
    isFavorite: false
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [roomMotion, setRoomMotion] = useState<Record<RoomKey, { version: number; direction: 'up' | 'down' }>>({
    bedroom: { version: 0, direction: 'up' },
    living_room: { version: 0, direction: 'up' },
    bathroom: { version: 0, direction: 'up' },
    kitchen: { version: 0, direction: 'up' },
    office: { version: 0, direction: 'up' },
    basement: { version: 0, direction: 'up' },
    walk_in_closet: { version: 0, direction: 'up' },
    laundry_room: { version: 0, direction: 'up' }
  });
  const [hydrating, setHydrating] = useState(Boolean(editingId));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [photoOriginalSize, setPhotoOriginalSize] = useState<number | null>(null);
  const [photoOptimizedSize, setPhotoOptimizedSize] = useState<number | null>(null);
  const [showDraftToast, setShowDraftToast] = useState(false);
  const [fadeDraftToast, setFadeDraftToast] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (editingId) {
      return;
    }

    try {
      const savedDraft = window.sessionStorage.getItem(ADD_SPACE_DRAFT_STORAGE_KEY);
      if (!savedDraft) {
        return;
      }

      const draft = JSON.parse(savedDraft) as {
        currentStep?: number;
        selectedType?: SpaceType | null;
        selectedFormat?: string;
        formatSystem?: FormatSystem;
        roomCounts?: Partial<Record<RoomKey, number>>;
        spaceName?: string;
        formData?: Partial<Omit<AddSpaceForm, 'type' | 'formatSystem' | 'quebecFormat' | 'rooms' | 'name'>>;
        savedAt?: number;
      };

      if (!draft.savedAt || Date.now() - draft.savedAt >= ADD_SPACE_DRAFT_MAX_AGE_MS) {
        window.sessionStorage.removeItem(ADD_SPACE_DRAFT_STORAGE_KEY);
        return;
      }

      setStep(typeof draft.currentStep === 'number' ? Math.min(4, Math.max(1, draft.currentStep)) : 1);
      setForm((currentForm) => ({
        ...currentForm,
        type: draft.selectedType ?? currentForm.type,
        quebecFormat: draft.selectedFormat ?? currentForm.quebecFormat,
        formatSystem: draft.formatSystem ?? currentForm.formatSystem,
        rooms: draft.roomCounts ? normalizeRooms(draft.roomCounts) : currentForm.rooms,
        name: draft.spaceName ?? currentForm.name,
        address: draft.formData?.address ?? currentForm.address,
        city: draft.formData?.city ?? currentForm.city,
        postalCode: draft.formData?.postalCode ?? currentForm.postalCode,
        floor: draft.formData?.floor ?? currentForm.floor,
        accessCode: draft.formData?.accessCode ?? currentForm.accessCode,
        notes: draft.formData?.notes ?? currentForm.notes,
        isFavorite: typeof draft.formData?.isFavorite === 'boolean' ? draft.formData.isFavorite : currentForm.isFavorite
      }));

      setShowDraftToast(true);
      setFadeDraftToast(false);
      const fadeTimer = window.setTimeout(() => setFadeDraftToast(true), 2500);
      const hideTimer = window.setTimeout(() => setShowDraftToast(false), 3000);

      return () => {
        window.clearTimeout(fadeTimer);
        window.clearTimeout(hideTimer);
      };
    } catch (error) {
      console.error('Failed to restore draft:', error);
      window.sessionStorage.removeItem(ADD_SPACE_DRAFT_STORAGE_KEY);
    }
  }, [editingId]);

  useEffect(() => {
    if (!profile?.id || !editingId) {
      return;
    }

    let active = true;

    const loadSpace = async () => {
      const { data, error } = await supabase
        .from('spaces')
        .select('*')
        .eq('id', editingId)
        .eq('client_id', profile.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error || !data) {
        setHydrating(false);
        return;
      }

      const space = data as SpaceRecord;
      setForm({
        name: space.name,
        type: space.type,
        formatSystem: space.format_system,
        quebecFormat: space.quebec_format ?? '4½',
        rooms: normalizeRooms(space.rooms),
        address: space.address ?? '',
        city: space.city ?? '',
        postalCode: space.postal_code ?? '',
        floor: space.floor ?? '',
        accessCode: space.access_code ?? '',
        notes: space.notes ?? '',
        isFavorite: space.is_favorite
      });
      setExistingPhotoUrl(space.photo_url);
      setPhotoPreview(space.photo_url);
      setHydrating(false);
    };

    void loadSpace();

    return () => {
      active = false;
    };
  }, [editingId, profile?.id]);

  useEffect(() => {
    if (editingId) {
      return;
    }

    const draft = {
      currentStep: step,
      selectedType: form.type,
      selectedFormat: form.quebecFormat,
      formatSystem: form.formatSystem,
      roomCounts: form.rooms,
      spaceName: form.name,
      formData: {
        address: form.address,
        city: form.city,
        postalCode: form.postalCode,
        floor: form.floor,
        accessCode: form.accessCode,
        notes: form.notes,
        isFavorite: form.isFavorite
      },
      savedAt: Date.now()
    };

    window.sessionStorage.setItem(ADD_SPACE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [editingId, form, step]);

  const totalRooms = useMemo(
    () => Object.values(form.rooms).reduce((sum, value) => sum + value, 0),
    [form.rooms]
  );

  const setBedroomsBathrooms = (bedrooms: number, bathrooms: number) => {
    setForm((currentForm) => ({
      ...currentForm,
      rooms: {
        ...currentForm.rooms,
        bedroom: bedrooms,
        bathroom: bathrooms
      }
    }));
  };

  const handleFormatSelect = (value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      formatSystem: 'quebec',
      quebecFormat: value,
      rooms: { ...formatRoomPresets[value] }
    }));
  };

  const handleRoomChange = (roomKey: RoomKey, delta: number) => {
    setForm((currentForm) => {
      const nextValue = Math.max(0, currentForm.rooms[roomKey] + delta);
      return {
        ...currentForm,
        rooms: {
          ...currentForm.rooms,
          [roomKey]: nextValue
        }
      };
    });
    setRoomMotion((currentMotion) => ({
      ...currentMotion,
      [roomKey]: {
        version: currentMotion[roomKey].version + 1,
        direction: delta > 0 ? 'up' : 'down'
      }
    }));
  };

  const goToStep = (nextStep: number, direction: 'forward' | 'backward') => {
    setStepDirection(direction);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = () => {
    setErrorMessage(null);

    if (step === 1 && (!form.type || !form.name.trim())) {
      setErrorMessage(content.addSpace.errors.stepOne);
      return;
    }

    if (
      step === 2 &&
      ((form.formatSystem === 'quebec' && !form.quebecFormat) ||
        (form.formatSystem === 'international' && form.rooms.bedroom === 0 && form.rooms.bathroom === 0))
    ) {
      setErrorMessage(content.addSpace.errors.stepTwo);
      return;
    }

    goToStep(step + 1, 'forward');
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    let fileToUse = file;
    setPhotoOriginalSize(file.size);
    setPhotoOptimizedSize(null);

    if (file.type !== 'image/webp') {
      try {
        fileToUse = await convertToWebP(file);
      } catch (error) {
        console.error('WebP conversion failed, using original:', error);
        fileToUse = file;
      }
    }

    setPhotoOptimizedSize(fileToUse.size);
    setPhotoFile(fileToUse);
    setExistingPhotoUrl(null);
    setPhotoPreview(URL.createObjectURL(fileToUse));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setExistingPhotoUrl(null);
    setPhotoPreview(null);
    setPhotoOriginalSize(null);
    setPhotoOptimizedSize(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExitToDashboard = () => {
    window.sessionStorage.removeItem(ADD_SPACE_DRAFT_STORAGE_KEY);
    navigateTo('clientDashboard');
  };

  const handleSubmit = async () => {
    if (!profile?.id) {
      setErrorMessage(content.addSpace.errors.profileMissing);
      return;
    }

    if (!form.type) {
      setErrorMessage(content.addSpace.errors.stepOne);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      let photoUrl = existingPhotoUrl;

      if (photoFile) {
        const isWebP = photoFile.type === 'image/webp';
        const fileExtension = isWebP ? 'webp' : (photoFile.name.split('.').pop() ?? 'jpg');
        const filePath = `${profile.id}/${Date.now()}.${fileExtension}`;
        const uploadResponse = await supabase.storage
          .from('space-photos')
          .upload(filePath, photoFile, {
            upsert: false,
            contentType: isWebP ? 'image/webp' : photoFile.type
          });

        if (uploadResponse.error) {
          throw new Error(content.addSpace.errors.upload);
        }

        photoUrl = supabase.storage.from('space-photos').getPublicUrl(filePath).data.publicUrl;
      }

      if (form.isFavorite) {
        const favoriteResetQuery = supabase.from('spaces').update({ is_favorite: false }).eq('client_id', profile.id);
        if (editingId) {
          await favoriteResetQuery.neq('id', editingId);
        } else {
          await favoriteResetQuery;
        }
      }

      const payload = {
        client_id: profile.id,
        name: form.name.trim(),
        type: form.type,
        format_system: form.formatSystem,
        quebec_format: form.formatSystem === 'quebec' ? form.quebecFormat : null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        postal_code: form.postalCode.trim() || null,
        floor: form.floor.trim() || null,
        access_code: form.accessCode.trim() || null,
        photo_url: photoUrl,
        notes: form.notes.trim() || null,
        is_favorite: form.isFavorite,
        rooms: form.rooms,
        updated_at: new Date().toISOString()
      };

      if (editingId) {
        const { error } = await supabase.from('spaces').update(payload).eq('id', editingId);
        if (error) {
          if (error.code === '42P01') {
            setErrorMessage(
              'La table spaces n\'existe pas encore. ' +
              'Veuillez exécuter le SQL dans Supabase. / ' +
              'The spaces table does not exist yet. ' +
              'Please run the SQL in Supabase.'
            );
          } else {
            setErrorMessage(error.message);
          }
          return;
        }
      } else {
        const { error } = await supabase
          .from('spaces')
          .insert([payload])
          .select();

        if (error) {
          if (error.code === '42P01') {
            setErrorMessage(
              'La table spaces n\'existe pas encore. ' +
              'Veuillez exécuter le SQL dans Supabase. / ' +
              'The spaces table does not exist yet. ' +
              'Please run the SQL in Supabase.'
            );
          } else {
            setErrorMessage(error.message);
          }
          return;
        }
      }

      window.sessionStorage.setItem('client-dashboard-toast', content.addSpace.success);
      window.sessionStorage.removeItem(ADD_SPACE_DRAFT_STORAGE_KEY);
      navigateTo('clientDashboard');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : content.addSpace.errors.generic);
    } finally {
      setSubmitting(false);
    }
  };

  const indicatorText = content.addSpace.indicator.replace('{current}', String(step));
  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#F7F7F7]">
      <div className="mx-auto max-w-4xl">
        {pageStyles()}
        {showDraftToast ? (
          <div
            className={`mx-4 mt-4 rounded-full bg-[rgba(168,230,207,0.35)] px-4 py-2 text-center text-xs font-medium text-[#047857] transition-opacity duration-500 sm:mx-6 ${fadeDraftToast ? 'opacity-0' : 'opacity-100'}`}
          >
            {content.addSpace.draftRestored}
          </div>
        ) : null}

        {/* Compact Header */}
        <div className="sticky top-20 z-40 bg-white/95 backdrop-blur-sm border-b border-[#E5E7EB] px-4 py-3 sm:px-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => step > 1 ? goToStep(step - 1, 'backward') : handleExitToDashboard()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280] transition-colors hover:bg-[#F7F7F7]"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#4FC3F7]">{indicatorText}</p>
                  <h1 className="truncate text-lg font-bold text-[#1A1A2E] sm:text-xl">{content.addSpace.stepTitles[step - 1]}</h1>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {[1, 2, 3, 4].map((value) => (
                <span
                  key={value}
                  className={`h-2 rounded-full transition-all ${value === step ? 'w-8 bg-[#4FC3F7]' : value < step ? 'w-5 bg-[#A8E6CF]' : 'w-5 bg-[#E5E7EB]'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="px-4 py-4 sm:px-6 pb-24">
          {hydrating ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <Loader2 className="animate-spin text-[#4FC3F7]" size={30} />
            </div>
          ) : (
            <div
              key={step}
              className="pb-4"
              style={{
                animation: stepDirection === 'forward' ? 'step-slide-forward 300ms ease both' : 'step-slide-backward 300ms ease both'
              }}
            >
              {step === 1 ? (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E5E7EB]">
                    <h2 className="text-xl font-bold text-[#1A1A2E] sm:text-2xl">{content.addSpace.typeStep.title}</h2>
                    <div className="mt-4 grid gap-3 grid-cols-2 sm:gap-4">
                      {(Object.keys(content.addSpace.typeStep.cards) as SpaceType[]).map((spaceType) => {
                        const card = content.addSpace.typeStep.cards[spaceType];
                        const selected = form.type === spaceType;
                        const tone = spaceType === 'house' ? 'bg-[rgba(168,230,207,0.18)] text-[#60B99A]' : spaceType === 'office' ? 'bg-[rgba(245,158,11,0.18)] text-[#D97706]' : spaceType === 'other' ? 'bg-[rgba(127,119,221,0.16)] text-[#7F77DD]' : 'bg-[rgba(79,195,247,0.18)] text-[#4FC3F7]';

                        return (
                          <button
                            key={spaceType}
                            type="button"
                            onClick={() => setForm((currentForm) => ({ ...currentForm, type: spaceType }))}
                            className={`rounded-xl border p-4 text-left transition-all duration-200 ${selected ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.05)] shadow-[0_0_0_3px_rgba(79,195,247,0.12)]' : 'border-[#E5E7EB] bg-white hover:border-[#BFE9FB]'}`}
                          >
                            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${tone}`}>{typeIcons[spaceType]}</div>
                            <h3 className="mt-3 text-base font-bold text-[#1A1A2E]">{card.title}</h3>
                            <p className="mt-1 text-xs leading-5 text-[#6B7280]">{card.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E5E7EB]">
                    <Field label={content.addSpace.typeStep.namePlaceholder}>
                      <TextInput
                        value={form.name}
                        onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                        placeholder={content.addSpace.typeStep.namePlaceholder}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E5E7EB]">
                    <div className="flex rounded-full bg-[#F3F4F6] p-1">
                      {(['quebec', 'international'] as FormatSystem[]).map((system) => {
                        const active = form.formatSystem === system;
                        return (
                          <button
                            key={system}
                            type="button"
                            onClick={() => setForm((currentForm) => ({ ...currentForm, formatSystem: system }))}
                            className={`flex-1 rounded-full px-3 py-2.5 text-sm font-semibold transition-all ${active ? 'bg-[#4FC3F7] text-white shadow-md' : 'text-[#6B7280]'}`}
                          >
                            {system === 'quebec' ? content.addSpace.sizeStep.quebec : content.addSpace.sizeStep.international}
                          </button>
                        );
                      })}
                    </div>

                    {form.formatSystem === 'quebec' ? (
                      <div className="mt-5">
                        <h2 className="text-lg font-bold text-[#1A1A2E]">{content.addSpace.sizeStep.title}</h2>
                        <p className="mt-2 text-sm text-[#6B7280]">{content.addSpace.sizeStep.subtitle}</p>
                        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                          {content.addSpace.sizeStep.formats.map((item) => {
                            const active = form.quebecFormat === item.value;
                            return (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() => handleFormatSelect(item.value)}
                                className={`rounded-xl border px-3 py-4 text-center transition-all ${active ? 'border-[#4FC3F7] bg-[rgba(79,195,247,0.05)] shadow-[0_0_0_3px_rgba(79,195,247,0.12)]' : 'border-[#E5E7EB] bg-white hover:border-[#BFE9FB]'}`}
                              >
                                <p className="text-2xl font-bold text-[#1A1A2E]">{item.value}</p>
                                <p className="mt-1.5 text-xs text-[#6B7280]">{item.label}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <NumberStepper label={content.addSpace.sizeStep.bedrooms} value={form.rooms.bedroom} onChange={(value) => setBedroomsBathrooms(value, form.rooms.bathroom)} />
                        <NumberStepper label={content.addSpace.sizeStep.bathrooms} value={form.rooms.bathroom} onChange={(value) => setBedroomsBathrooms(form.rooms.bedroom, value)} />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E5E7EB]">
                    <h2 className="text-lg font-bold text-[#1A1A2E]">{content.addSpace.roomsStep.title}</h2>
                    <p className="mt-2 text-sm text-[#6B7280]">{content.addSpace.roomsStep.subtitle}</p>
                    <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
                      {roomOrder.map((roomKey, index) => {
                        const count = form.rooms[roomKey];
                        const motion = roomMotion[roomKey];
                        const highlighted = count > 0;
                        const motionName = motion.direction === 'up' ? 'room-count-up' : 'room-count-down';

                        return (
                          <div key={roomKey} className={`rounded-xl border p-3 transition-all ${highlighted ? 'border-[#BFE9FB] bg-[rgba(79,195,247,0.06)]' : 'border-[#E5E7EB] bg-white'}`}>
                            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${index % 2 === 0 ? 'bg-[rgba(79,195,247,0.16)] text-[#4FC3F7]' : 'bg-[rgba(168,230,207,0.22)] text-[#60B99A]'}`}>
                              {(() => {
                                const iconSize = 20;
                                if (roomKey === 'bedroom') return <BedDouble size={iconSize} />;
                                if (roomKey === 'living_room') return <Sofa size={iconSize} />;
                                if (roomKey === 'kitchen') return <ChefHat size={iconSize} />;
                                if (roomKey === 'bathroom') return <Bath size={iconSize} />;
                                if (roomKey === 'office') return <Monitor size={iconSize} />;
                                if (roomKey === 'basement') return <Warehouse size={iconSize} />;
                                if (roomKey === 'walk_in_closet') return <Shirt size={iconSize} />;
                                return <WashingMachine size={iconSize} />;
                              })()}
                            </div>
                            <p className={`mt-2 text-xs font-semibold ${highlighted ? 'text-[#4FC3F7]' : 'text-[#1A1A2E]'}`}>{content.addSpace.roomsStep.labels[roomKey]}</p>
                            <div className="mt-2 flex h-10 items-center justify-center overflow-hidden">
                              <span
                                key={`${roomKey}-${motion.version}-${count}`}
                                className="text-3xl font-bold text-[#4FC3F7]"
                                style={{ animation: `${motionName} 250ms ease, ${highlighted ? 'room-count-pulse 200ms ease' : 'none'}` }}
                              >
                                {count}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-center gap-2">
                              <CounterButton icon={<span className="text-base">−</span>} disabled={count === 0} tone="gray" onClick={() => handleRoomChange(roomKey, -1)} />
                              <CounterButton icon={<Plus size={14} />} onClick={() => handleRoomChange(roomKey, 1)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                      <p className="text-sm font-semibold text-[#6B7280] text-center">{content.addSpace.roomsStep.total.replace('{count}', String(totalRooms))}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  {/* Photo Upload */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5E7EB]">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D7E9F5] bg-[#FBFDFF] px-4 py-6 text-center transition-colors hover:border-[#4FC3F7]"
                    >
                      {photoPreview ? (
                        <img src={photoPreview} alt={form.name || 'Space preview'} className="h-40 w-full rounded-lg object-cover sm:h-48" />
                      ) : (
                        <>
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(79,195,247,0.14)] text-[#4FC3F7]"><Camera size={22} /></div>
                          <p className="mt-3 text-sm font-semibold text-[#1A1A2E]">{content.addSpace.photo}</p>
                        </>
                      )}
                    </button>
                    {photoPreview ? (
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#6B7280] transition-colors hover:bg-[#F7F7F7]"
                      >
                        <X size={14} />
                        {content.addSpace.detailsStep.removePhoto}
                      </button>
                    ) : null}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                    {photoOriginalSize ? (
                      <p className="mt-3 text-xs text-[#6B7280]">
                        {content.addSpace.photoSelected.replace('{size}', formatFileSize(photoOriginalSize))}
                      </p>
                    ) : null}
                    {photoOptimizedSize ? (
                      <p className="mt-1 text-xs text-[#6B7280]">
                        {content.addSpace.photoOptimized.replace('{size}', formatFileSize(photoOptimizedSize))}
                      </p>
                    ) : null}
                  </div>

                  {/* Location Section */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5E7EB]">
                    <h3 className="text-sm font-bold text-[#1A1A2E] mb-3 flex items-center gap-2">
                      <MapPin size={16} className="text-[#4FC3F7]" />
                      Location
                    </h3>
                    <div className="space-y-3">
                      <Field label={content.addSpace.detailsStep.address}><TextInput value={form.address} onChange={(event) => setForm((currentForm) => ({ ...currentForm, address: event.target.value }))} /></Field>
                      <div className="grid gap-3 grid-cols-2">
                        <Field label={content.addSpace.detailsStep.city}><TextInput value={form.city} onChange={(event) => setForm((currentForm) => ({ ...currentForm, city: event.target.value }))} /></Field>
                        <Field label={content.addSpace.detailsStep.postalCode}><TextInput value={form.postalCode} onChange={(event) => setForm((currentForm) => ({ ...currentForm, postalCode: event.target.value }))} /></Field>
                      </div>
                    </div>
                  </div>

                  {/* Access Section */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5E7EB]">
                    <h3 className="text-sm font-bold text-[#1A1A2E] mb-3 flex items-center gap-2">
                      <Lock size={16} className="text-[#4FC3F7]" />
                      Access
                    </h3>
                    <div className="grid gap-3 grid-cols-[100px,1fr] sm:grid-cols-[120px,1fr]">
                      <Field label={content.addSpace.detailsStep.floor}><TextInput value={form.floor} onChange={(event) => setForm((currentForm) => ({ ...currentForm, floor: event.target.value }))} /></Field>
                      <Field label={content.addSpace.detailsStep.accessCode}><TextInput value={form.accessCode} onChange={(event) => setForm((currentForm) => ({ ...currentForm, accessCode: event.target.value }))} placeholder={content.addSpace.detailsStep.accessCodePlaceholder} /></Field>
                    </div>
                  </div>

                  {/* Additional Details - Collapsible on mobile */}
                  <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
                    <button
                      type="button"
                      onClick={() => setDetailsExpanded(!detailsExpanded)}
                      className="flex w-full items-center justify-between p-4 text-left"
                    >
                      <h3 className="text-sm font-bold text-[#1A1A2E]">Additional notes (optional)</h3>
                      <ChevronRight size={18} className={`text-[#6B7280] transition-transform ${detailsExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    <div className={`grid transition-all duration-300 ${detailsExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4">
                          <Field label="">
                            <textarea
                              value={form.notes}
                              onChange={(event) => setForm((currentForm) => ({ ...currentForm, notes: event.target.value }))}
                              rows={3}
                              placeholder={content.addSpace.detailsStep.notesPlaceholder}
                              className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-sm text-[#1A1A2E] outline-none transition-all placeholder:text-[#9CA3AF] focus:border-[#4FC3F7] focus:shadow-[0_0_0_3px_rgba(79,195,247,0.12)]"
                            />
                          </Field>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Favorite Toggle */}
                  <div className="bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-[#E5E7EB]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(168,230,207,0.24)] text-[#60B99A]"><Star size={16} /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1A1A2E]">{content.addSpace.favorite}</p>
                          <p className="text-xs text-[#6B7280] truncate">{content.addSpace.favoriteHint}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setForm((currentForm) => ({ ...currentForm, isFavorite: !currentForm.isFavorite }))} className={`shrink-0 relative h-7 w-12 rounded-full transition-colors ${form.isFavorite ? 'bg-[#4FC3F7]' : 'bg-[#E5E7EB]'}`}>
                        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${form.isFavorite ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {errorMessage ? (
            <div className="mt-4 rounded-xl bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[#B91C1C]">{errorMessage}</div>
          ) : null}
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E5E7EB] bg-white/95 backdrop-blur-sm px-4 py-3 shadow-[0_-4px_12px_rgba(17,24,39,0.08)] sm:px-6">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#4FC3F7] px-6 py-3.5 font-bold text-white shadow-lg transition-all active:scale-95 sm:flex-none sm:min-w-[180px]"
              >
                {content.addSpace.next}
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#4FC3F7] px-6 py-3.5 font-bold text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none sm:min-w-[180px]"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
                {submitting ? content.addSpace.saving : content.addSpace.save}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import type { ChangeEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bath, BedDouble, Briefcase, Building2, Camera, ChefHat, ChevronLeft, ChevronRight, Grid2x2 as Grid2X2, Home, Loader2, Lock, MapPin, Monitor, Pencil, Plus, Search, Shirt, Sofa, Star, Trash2, Warehouse, WashingMachine, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useLanguage } from '../i18n/LanguageContext';
import { getPathForRoute } from '../i18n/routes';
import { PaginationControls } from '../components/PaginationControls';
import { ToastError } from '../components/ToastError';
import { requestAccountDeletion } from '../lib/accountDeletion';
import { convertToWebP } from '../lib/imageUtils';
import { fetchGeoapifyAddressSuggestions } from '../lib/geoapify';
import type { AddressSuggestion } from '../lib/geoapify';
import { getMontrealToday, isPastInMontreal } from '../lib/montrealDate';
import { normalizeNorthAmericanPhone } from '../lib/phone';
import { deriveZoneFromCityName } from '../lib/zoneMapping';
import supabase from '../lib/supabase';

type SpaceType = 'apartment' | 'house' | 'office' | 'other';
type FormatSystem = 'quebec' | 'international';
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
  province: string | null;
  postal_code: string | null;
  derived_zone: string | null;
  latitude: number | null;
  longitude: number | null;
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

type CleanerClientReviewRecord = {
  rating: number;
};

type DashboardCompletedBookingRecord = {
  id: string;
  scheduled_at: string | null;
};

type AddSpaceForm = {
  name: string;
  type: SpaceType | null;
  formatSystem: FormatSystem;
  quebecFormat: string;
  rooms: Rooms;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  derivedZone: string;
  latitude: string;
  longitude: string;
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
const SUPABASE_BASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

const resolveSpacePhotoUrl = (photoUrl: string | null) => {
  const normalizedPhotoUrl = photoUrl?.trim();
  if (!normalizedPhotoUrl) {
    return null;
  }
  if (/^https?:\/\//i.test(normalizedPhotoUrl)) {
    return normalizedPhotoUrl;
  }
  if (!SUPABASE_BASE_URL) {
    return normalizedPhotoUrl;
  }
  if (normalizedPhotoUrl.startsWith('/storage/') || normalizedPhotoUrl.startsWith('storage/')) {
    return `${SUPABASE_BASE_URL}/${normalizedPhotoUrl.replace(/^\/+/, '')}`;
  }

  const normalizedPath = normalizedPhotoUrl.replace(/^\/+/, '');
  if (normalizedPath.startsWith('space-photos/')) {
    return `${SUPABASE_BASE_URL}/storage/v1/object/public/${normalizedPath}`;
  }

  return `${SUPABASE_BASE_URL}/storage/v1/object/public/space-photos/${normalizedPath}`;
};

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
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName[0].toUpperCase();
  }
  return email?.[0]?.toUpperCase() || '?';
}

function getEditSpacePath(language: 'fr' | 'en' | 'es', spaceId: string) {
  if (language === 'fr') {
    return `/fr/dashboard/client/modifier-espace/${spaceId}`;
  }
  if (language === 'es') {
    return `/es/dashboard/client/editar-espacio/${spaceId}`;
  }
  return `/en/dashboard/client/edit-space/${spaceId}`;
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

const contentByLanguage = {
  fr: {
    header: { greeting: 'Bonjour', badge: 'Client vérifié', editProfile: 'Modifier le profil' },
    phone: {
      title: 'Numero de telephone',
      subtitle: "Obligatoire avant d'ajouter votre premier espace.",
      edit: 'Modifier',
      placeholder: '+1 514 555 1234',
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      invalid: 'Format requis: +1 suivi de 10 chiffres.',
      requiredForFirstSpace: "Ajoutez un numero valide pour continuer vers votre premier espace.",
      saved: 'Numero enregistre.'
    },
    account: {
      deleteButton: 'Supprimer mon compte',
      deleteTitle: 'Supprimer mon compte ?',
      deleteMessage: "Toutes vos donnees seront supprimees definitivement de l'application.",
      deleteCancel: 'Annuler',
      deleteConfirm: 'Supprimer definitivement',
      deleteError: 'Impossible de supprimer votre compte pour le moment.'
    },
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
      deleteMessage: 'Cette action est irréversible. Toutes les données de cet espace seront supprimées.',
      cancelDelete: 'Annuler',
      confirmDelete: 'Supprimer',
      edit: 'Modifier',
      delete: 'Supprimer',
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
        stepOneType: "Veuillez choisir un type d'espace",
        stepOneName: "Veuillez donner un nom à cet espace",
        stepTwoFormat: 'Veuillez choisir le format de votre logement',
        stepThreeRooms: 'Veuillez sélectionner au moins une pièce',
        toastRequiredFields: 'Veuillez remplir les champs obligatoires',
        addressRequired: "L'adresse est obligatoire",
        cityRequired: 'La ville est obligatoire',
        addressSelectRequired: 'Veuillez selectionner une adresse proposee ou passer en mode manuel.',
        upload: "Impossible d'envoyer la photo pour le moment.",
        generic: "Impossible d'enregistrer cet espace pour le moment.",
        profileMissing: 'Impossible de sauvegarder sans profil client actif.',
        phoneRequiredFirstSpace: 'Ajoutez un numero de telephone valide dans le tableau de bord avant de creer votre premier espace.'
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
        province: 'Province',
        postalCode: 'Code postal',
        derivedZone: 'Zone derivee',
        unknownZone: 'Zone inconnue',
        useManual: 'Entrer manuellement',
        useAutocomplete: 'Utiliser autocomplete',
        autocompleteHint: 'Recherchez votre adresse au Canada puis selectionnez une suggestion.',
        manualHint: 'Saisissez votre adresse manuellement.',
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
    phone: {
      title: 'Phone number',
      subtitle: 'Required before adding your first space.',
      edit: 'Edit',
      placeholder: '+1 514 555 1234',
      save: 'Save',
      saving: 'Saving...',
      invalid: 'Required format: +1 followed by 10 digits.',
      requiredForFirstSpace: 'Add a valid phone number before continuing to your first space.',
      saved: 'Phone number saved.'
    },
    account: {
      deleteButton: 'Delete my account',
      deleteTitle: 'Delete my account?',
      deleteMessage: 'All your data will be permanently removed from the app.',
      deleteCancel: 'Cancel',
      deleteConfirm: 'Delete permanently',
      deleteError: 'Unable to delete your account right now.'
    },
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
      deleteMessage: 'This action cannot be undone. All data for this space will be deleted.',
      cancelDelete: 'Cancel',
      confirmDelete: 'Delete',
      edit: 'Edit',
      delete: 'Delete',
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
        stepOneType: 'Please choose a space type',
        stepOneName: 'Please give this space a name',
        stepTwoFormat: 'Please choose your home format',
        stepThreeRooms: 'Please select at least one room',
        toastRequiredFields: 'Please fill in the required fields',
        addressRequired: 'Address is required',
        cityRequired: 'City is required',
        addressSelectRequired: 'Please select one suggested address or switch to manual mode.',
        upload: 'Unable to upload the photo right now.',
        generic: 'Unable to save this space right now.',
        profileMissing: 'Unable to save without an active client profile.',
        phoneRequiredFirstSpace: 'Add a valid phone number in your dashboard before creating your first space.'
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
        province: 'Province / State',
        postalCode: 'Postal code',
        derivedZone: 'Derived zone',
        unknownZone: 'Unknown zone',
        useManual: 'Enter manually',
        useAutocomplete: 'Use autocomplete',
        autocompleteHint: 'Search your address in Canada and pick a suggestion.',
        manualHint: 'Fill in your address manually.',
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
    phone: {
      title: 'Numero de telefono',
      subtitle: 'Obligatorio antes de agregar tu primer espacio.',
      edit: 'Editar',
      placeholder: '+1 514 555 1234',
      save: 'Guardar',
      saving: 'Guardando...',
      invalid: 'Formato requerido: +1 seguido de 10 digitos.',
      requiredForFirstSpace: 'Agrega un numero valido antes de continuar con tu primer espacio.',
      saved: 'Telefono guardado.'
    },
    account: {
      deleteButton: 'Eliminar mi cuenta',
      deleteTitle: '¿Eliminar mi cuenta?',
      deleteMessage: 'Todos tus datos se eliminaran definitivamente de la aplicacion.',
      deleteCancel: 'Cancelar',
      deleteConfirm: 'Eliminar definitivamente',
      deleteError: 'No se puede eliminar tu cuenta en este momento.'
    },
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
      deleteMessage: 'Esta acción no se puede deshacer. Todos los datos de este espacio serán eliminados.',
      cancelDelete: 'Cancelar',
      confirmDelete: 'Eliminar',
      edit: 'Editar',
      delete: 'Eliminar',
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
        stepOneType: 'Por favor elige un tipo de espacio',
        stepOneName: 'Por favor dale un nombre a este espacio',
        stepTwoFormat: 'Por favor elige el formato de tu vivienda',
        stepThreeRooms: 'Por favor selecciona al menos una habitación',
        toastRequiredFields: 'Por favor completa los campos obligatorios',
        addressRequired: 'La dirección es obligatoria',
        cityRequired: 'La ciudad es obligatoria',
        addressSelectRequired: 'Selecciona una direccion sugerida o cambia al modo manual.',
        upload: 'No se pudo subir la foto en este momento.',
        generic: 'No se pudo guardar este espacio en este momento.',
        profileMissing: 'No se puede guardar sin un perfil de cliente activo.',
        phoneRequiredFirstSpace: 'Agrega un telefono valido en tu panel antes de crear tu primer espacio.'
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
        province: 'Provincia / Estado',
        postalCode: 'Código postal',
        derivedZone: 'Zona derivada',
        unknownZone: 'Zona desconocida',
        useManual: 'Entrar manualmente',
        useAutocomplete: 'Usar autocompletar',
        autocompleteHint: 'Busca tu direccion en Canada y elige una sugerencia.',
        manualHint: 'Completa tu direccion manualmente.',
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
  type = 'text',
  inputRef,
  className,
  readOnly = false
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon?: ReactNode;
  type?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
          {icon}
        </span>
      ) : null}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-[#1A1A2E] outline-none transition-all placeholder:text-[#9CA3AF] focus:border-[#4FC3F7] focus:shadow-[0_0_0_4px_rgba(79,195,247,0.12)] ${icon ? 'pl-11' : ''} ${className ?? ''}`}
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
  const SPACES_PER_PAGE = 3;
  const { language, navigateTo } = useLanguage();
  const { profile, user, session, loading: authLoading, updateProfile, signOut } = useAuth();
  const content = contentByLanguage[language];
  const addSpacePath = getPathForRoute(language, 'clientAddSpace');
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const [spaces, setSpaces] = useState<SpaceRecord[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [averageRating, setAverageRating] = useState<string>('--');
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [spacesPage, setSpacesPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<SpaceRecord | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});
  const [phoneValue, setPhoneValue] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  useBodyScrollLock(Boolean(deleteAccountOpen || deleteCandidate));

  const paginationLabels = useMemo(
    () =>
      language === 'fr'
        ? { previous: 'Precedent', next: 'Suivant', page: 'Page' }
        : language === 'es'
          ? { previous: 'Anterior', next: 'Siguiente', page: 'Pagina' }
          : { previous: 'Previous', next: 'Next', page: 'Page' },
    [language]
  );
  const spaceTotalPages = Math.max(1, Math.ceil(spaces.length / SPACES_PER_PAGE));
  const paginatedSpaces = useMemo(() => {
    const start = (spacesPage - 1) * SPACES_PER_PAGE;
    return spaces.slice(start, start + SPACES_PER_PAGE);
  }, [spaces, spacesPage, SPACES_PER_PAGE]);

  useEffect(() => {
    setPhoneValue(profile?.phone ?? '');
    setPhoneEditing(false);
  }, [profile?.phone]);

  useEffect(() => {
    setSpacesPage(1);
  }, [spaces.length]);

  useEffect(() => {
    if (spacesPage > spaceTotalPages) {
      setSpacesPage(spaceTotalPages);
    }
  }, [spaceTotalPages, spacesPage]);

  const fetchSpaces = async () => {
    if (!user?.id) {
      console.warn('fetchSpaces: no user.id available');
      return;
    }

    console.log('=== SPACES FETCH DEBUG ===');
    console.log('user object:', user);
    console.log('user.id used in query:', user?.id);
    console.log('expected client_id:', '0e2e1b14-feff-4912-a142-93e93de162c4');
    console.log('IDs match:', user?.id === '0e2e1b14-feff-4912-a142-93e93de162c4');
    console.log('Starting spaces fetch...');
    console.log('Fetching spaces for user:', user.id);

    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('client_id', user.id)
      .eq('is_active', true)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false });

    console.log('Query complete');
    console.log('data:', data);
    console.log('data length:', data?.length);
    console.log('error:', error);

    if (error) {
      console.error('fetchSpaces error:', error);
      return;
    }

    console.log('Spaces fetched successfully:', data?.length);
    setSpaces(data || []);
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user?.id) {
      return;
    }

    let active = true;

    const loadDashboard = async () => {
      setDashboardLoading(true);
      setErrorMessage(null);

      await fetchSpaces();

      const [completedResponse, cleanerReviewsResponse] = await Promise.all([
        supabase
          .from('bookings')
          .select('id,scheduled_at')
          .eq('client_id', user.id)
          .in('status', ['completed', 'confirmed', 'accepted']),
        supabase
          .from('cleaner_client_reviews')
          .select('rating')
          .eq('client_id', user.id)
      ]);

      if (!active) {
        return;
      }

      if (completedResponse.error || cleanerReviewsResponse.error) {
        if (completedResponse.error) {
          console.error('Completed count fetch error:', completedResponse.error);
        }
        if (cleanerReviewsResponse.error) {
          console.error('Cleaner -> client reviews fetch error:', cleanerReviewsResponse.error);
        }
        setErrorMessage('Unable to load the dashboard right now.');
        setDashboardLoading(false);
        return;
      }

      const montrealToday = getMontrealToday();
      const completedRows = ((completedResponse.data as DashboardCompletedBookingRecord[] | null) ?? [])
        .filter((row) => row.scheduled_at && isPastInMontreal(row.scheduled_at, montrealToday));
      setCompletedCount(completedRows.length);
      const ratings = ((cleanerReviewsResponse.data as CleanerClientReviewRecord[] | null) ?? [])
        .map((review) => Number(review.rating))
        .filter((value) => Number.isFinite(value) && value > 0);
      if (ratings.length === 0) {
        setAverageRating('--');
      } else {
        const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
        setAverageRating(`${average.toFixed(1)} ★`);
      }
      setDashboardLoading(false);
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
  }, [authLoading, user?.id]);

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

  const handleDelete = async (spaceId: string) => {
    if (!user?.id) {
      console.warn('No user ID available for delete');
      return;
    }

    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', spaceId)
      .eq('client_id', user.id);

    if (error) {
      console.error('Delete error:', error);
      setErrorMessage(error.message);
      return;
    }

    setSpaces((currentSpaces) => currentSpaces.filter((currentSpace) => currentSpace.id !== spaceId));
    setDeleteCandidate(null);
    setToast(content.spaces.deletedToast);
    window.setTimeout(() => setToast(null), 2400);
  };

  const fullName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.first_name
      ? profile.first_name
      : user?.email?.split('@')[0] || 'Nettoyo';
  const firstName = profile?.first_name || user?.email?.split('@')[0] || 'there';
  const accountEmail = user?.email || profile?.email || '';
  const normalizedPhone = normalizeNorthAmericanPhone(phoneValue);
  const hasValidPhone = Boolean(normalizedPhone);
  const requiresPhoneBeforeFirstSpace = spaces.length === 0;
  console.log('Rendering spaces:', spaces);

  const savePhone = async () => {
    if (!user?.id) return;
    const normalized = normalizeNorthAmericanPhone(phoneValue);
    if (!normalized) {
      setPhoneError(content.phone.invalid);
      return;
    }
    setPhoneSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ phone: normalized })
      .eq('id', user.id);
    setPhoneSaving(false);
    if (error) {
      setPhoneError(error.message);
      return;
    }
    setPhoneError(null);
    setPhoneValue(normalized);
    setPhoneEditing(false);
    updateProfile({ phone: normalized });
    setToast(content.phone.saved);
    window.setTimeout(() => setToast(null), 2200);
  };

  const goToAddSpace = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (requiresPhoneBeforeFirstSpace && !hasValidPhone) {
      setPhoneEditing(true);
      setPhoneError(content.phone.requiredForFirstSpace);
      phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      phoneInputRef.current?.focus();
      return;
    }
    navigateTo('clientAddSpace');
  };

  const handleDeleteAccount = async () => {
    if (!session?.access_token) {
      setErrorMessage(content.account.deleteError);
      return;
    }
    setDeleteAccountLoading(true);
    try {
      await requestAccountDeletion(session.access_token);
      await signOut();
      window.location.assign(getPathForRoute(language, 'home'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : content.account.deleteError);
      setDeleteAccountLoading(false);
      return;
    }
    setDeleteAccountLoading(false);
  };

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
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-5">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={fullName}
                  className="h-20 w-20 rounded-full object-cover shadow-[0_10px_30px_rgba(79,195,247,0.18)]"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#4FC3F7] text-2xl font-bold text-white shadow-[0_10px_30px_rgba(79,195,247,0.24)]">
                  {getInitials(profile?.first_name, profile?.last_name, user?.email || profile?.email)}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4FC3F7]">
                  {content.header.greeting}, {firstName}
                </p>
                <h1 className="mt-2 text-3xl font-bold text-[#1A1A2E]">
                  {fullName}
                </h1>
                <p className="mt-2 text-sm text-[#6B7280]">{accountEmail}</p>
                <span className="mt-4 inline-flex rounded-full bg-[rgba(168,230,207,0.35)] px-3 py-1 text-sm font-semibold text-[#1A1A2E]">
                  {content.header.badge}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] bg-white px-6 py-6 shadow-[0_14px_32px_rgba(17,24,39,0.06)] sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#1A1A2E]">{content.phone.title}</h2>
              <p className="mt-1 text-sm text-[#6B7280]">{content.phone.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPhoneEditing(true);
                window.setTimeout(() => phoneInputRef.current?.focus(), 0);
              }}
              className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#1A1A2E] transition-colors hover:bg-[#F7F7F7]"
            >
              {content.phone.edit}
            </button>
            {requiresPhoneBeforeFirstSpace && !hasValidPhone ? (
              <p className="text-xs font-semibold text-[#B45309]">{content.phone.requiredForFirstSpace}</p>
            ) : null}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              ref={phoneInputRef}
              type="tel"
              value={phoneValue}
              onChange={(event) => {
                setPhoneValue(event.target.value);
                if (phoneError) setPhoneError(null);
              }}
              disabled={!phoneEditing}
              placeholder={content.phone.placeholder}
              className={`w-full rounded-xl border px-4 py-3 text-sm text-[#1A1A2E] outline-none ${
                phoneError ? 'border-[#E24B4A] bg-[#FCEBEB]' : 'border-[#E5E7EB] focus:border-[#4FC3F7]'
              }`}
            />
            <button
              type="button"
              disabled={phoneSaving || !phoneEditing}
              onClick={() => void savePhone()}
              className="inline-flex min-w-[130px] items-center justify-center rounded-full bg-[#4FC3F7] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {phoneSaving ? content.phone.saving : content.phone.save}
            </button>
          </div>
          {phoneError ? <p className="mt-2 text-xs font-semibold text-[#B91C1C]">{phoneError}</p> : null}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { value: spaces.length, label: content.stats.spaces },
            { value: completedCount, label: content.stats.bookings },
            { value: averageRating, label: content.stats.rating }
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
              onClick={goToAddSpace}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#4FC3F7] px-5 py-3 font-semibold text-white shadow-[0_14px_28px_rgba(79,195,247,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#3FAAD4]"
            >
              <Plus size={18} />
              {content.spaces.add.replace('+ ', '')}
            </a>
          </div>

          {dashboardLoading ? (
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
                onClick={goToAddSpace}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-[#4FC3F7] px-6 py-3 font-semibold text-white shadow-[0_14px_28px_rgba(79,195,247,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#3FAAD4]"
              >
                {content.spaces.add}
              </a>
            </div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {paginatedSpaces.map((space) => {
                console.log('Rendering space:', space.id, space.name);
                console.log('space.photo_url:', space.photo_url);
                const editHref = getEditSpacePath(language, space.id);
                const resolvedPhotoUrl = resolveSpacePhotoUrl(space.photo_url);
                const showPhoto = Boolean(resolvedPhotoUrl) && !imageLoadErrors[space.id];

                return (
                  <article
                    key={space.id}
                    className="overflow-hidden rounded-[24px] bg-white shadow-[0_16px_34px_rgba(17,24,39,0.07)]"
                  >
                    <div className="relative h-52 overflow-hidden">
                      {showPhoto ? (
                        <img
                          src={resolvedPhotoUrl ?? ''}
                          alt={space.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center',
                            display: 'block'
                          }}
                          onError={() => {
                            setImageLoadErrors((currentErrors) => ({ ...currentErrors, [space.id]: true }));
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#4FC3F7] to-[#A8E6CF] text-white">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                          </svg>
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
                      <div className="flex items-center gap-2">
                        <a
                          href={editHref}
                          onClick={(event) => {
                            event.preventDefault();
                            window.history.pushState({}, '', editHref);
                            window.dispatchEvent(new PopStateEvent('popstate'));
                          }}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-[#E5E7EB] px-3 text-xs font-medium text-[#6B7280] transition-all hover:-translate-y-0.5 hover:border-[#4FC3F7] hover:text-[#4FC3F7]"
                        >
                          <Pencil size={14} />
                          <span>{content.spaces.edit}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(space)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-[#E5E7EB] px-3 text-xs font-medium text-[#6B7280] transition-all hover:-translate-y-0.5 hover:border-[#DC2626] hover:text-[#DC2626]"
                        >
                          <Trash2 size={14} />
                          <span>{content.spaces.delete}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
                })}
              </div>
              <PaginationControls
                page={spacesPage}
                totalPages={spaceTotalPages}
                onPageChange={setSpacesPage}
                labels={paginationLabels}
              />
            </>
          )}
        </section>
        <section className="mt-6 rounded-[24px] border border-[rgba(220,38,38,0.25)] bg-white px-6 py-5 shadow-[0_10px_24px_rgba(17,24,39,0.05)] sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#6B7280]">{content.account.deleteMessage}</p>
            <button
              type="button"
              onClick={() => setDeleteAccountOpen(true)}
              className="inline-flex items-center justify-center rounded-full bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#B91C1C]"
            >
              {content.account.deleteButton}
            </button>
          </div>
        </section>
        {deleteAccountOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/45 px-4 py-4">
            <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-[0_18px_40px_rgba(17,24,39,0.22)]">
              <h3 className="text-xl font-bold text-[#1A1A2E]">{content.account.deleteTitle}</h3>
              <p className="mt-3 text-sm leading-6 text-[#6B7280]">{content.account.deleteMessage}</p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={deleteAccountLoading}
                  onClick={() => setDeleteAccountOpen(false)}
                  className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#6B7280] transition-colors hover:bg-[#F7F7F7] disabled:opacity-60"
                >
                  {content.account.deleteCancel}
                </button>
                <button
                  type="button"
                  disabled={deleteAccountLoading}
                  onClick={() => void handleDeleteAccount()}
                  className="inline-flex min-w-[170px] items-center justify-center rounded-full bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-60"
                >
                  {deleteAccountLoading ? <Loader2 size={14} className="animate-spin" /> : content.account.deleteConfirm}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {deleteCandidate ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/40 px-4 py-4">
            <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-[0_18px_40px_rgba(17,24,39,0.22)]">
              <h3 className="text-xl font-bold text-[#1A1A2E]">{content.spaces.deleteConfirm}</h3>
              <p className="mt-3 text-sm leading-6 text-[#6B7280]">{content.spaces.deleteMessage}</p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteCandidate(null)}
                  className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#6B7280] transition-colors hover:bg-[#F7F7F7]"
                >
                  {content.spaces.cancelDelete}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(deleteCandidate.id)}
                  className="rounded-full bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#B91C1C]"
                >
                  {content.spaces.confirmDelete}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/*
 * IMPORTANT - For photo upload to work:
 * 1. Go to Supabase Dashboard -> SQL Editor
 * 2. Run: src/lib/create-storage-bucket.sql
 * OR manually:
 * Supabase Dashboard -> Storage -> New bucket
 * Name: space-photos
 * Public bucket: ON
 * Then add RLS policies as in the SQL file
 */
export function ClientAddSpacePage() {
  const { language, navigateTo } = useLanguage();
  const { profile } = useAuth();
  const content = contentByLanguage[language];
  const editingId = useMemo(() => new URLSearchParams(window.location.search).get('edit'), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const spaceNameRef = useRef<HTMLInputElement | null>(null);
  const addressRef = useRef<HTMLInputElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const addressSectionRef = useRef<HTMLDivElement | null>(null);
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const [step, setStep] = useState(1);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const [addressMode, setAddressMode] = useState<'autocomplete' | 'manual'>('autocomplete');
  const [addressQuery, setAddressQuery] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<AddressSuggestion | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [form, setForm] = useState<AddSpaceForm>({
    name: '',
    type: null,
    formatSystem: 'quebec',
    quebecFormat: '4½',
    rooms: formatRoomPresets['4½'],
    address: '',
    city: '',
    province: '',
    postalCode: '',
    derivedZone: '',
    latitude: '',
    longitude: '',
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [photoOriginalSize, setPhotoOriginalSize] = useState<number | null>(null);
  const [photoOptimizedSize, setPhotoOptimizedSize] = useState<number | null>(null);
  const [showDraftToast, setShowDraftToast] = useState(false);
  const [fadeDraftToast, setFadeDraftToast] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ address: boolean; city: boolean }>({ address: false, city: false });
  const [hasExistingSpaces, setHasExistingSpaces] = useState(false);
  const geoapifyApiKey = (import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined)?.trim() ?? '';
  const phoneReady = Boolean(normalizeNorthAmericanPhone(profile?.phone ?? ''));
  const phoneGateBlocked = !editingId && !hasExistingSpaces && !phoneReady;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!profile?.id || editingId) {
      setHasExistingSpaces(false);
      return;
    }
    let active = true;
    const loadSpaceCount = async () => {
      const { count, error } = await supabase
        .from('spaces')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', profile.id)
        .eq('is_active', true);
      if (!active) return;
      if (error) {
        console.error('Client add-space count lookup error:', error);
        setHasExistingSpaces(false);
        return;
      }
      setHasExistingSpaces((count ?? 0) > 0);
    };
    void loadSpaceCount();
    return () => {
      active = false;
    };
  }, [editingId, profile?.id]);

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
        province: draft.formData?.province ?? currentForm.province,
        postalCode: draft.formData?.postalCode ?? currentForm.postalCode,
        derivedZone: draft.formData?.derivedZone ?? currentForm.derivedZone,
        latitude: draft.formData?.latitude ?? currentForm.latitude,
        longitude: draft.formData?.longitude ?? currentForm.longitude,
        floor: draft.formData?.floor ?? currentForm.floor,
        accessCode: draft.formData?.accessCode ?? currentForm.accessCode,
        notes: draft.formData?.notes ?? currentForm.notes,
        isFavorite: typeof draft.formData?.isFavorite === 'boolean' ? draft.formData.isFavorite : currentForm.isFavorite
      }));
      setAddressMode((draft.formData as { addressMode?: 'autocomplete' | 'manual' } | undefined)?.addressMode ?? 'autocomplete');
      setAddressQuery(draft.formData?.address ?? '');
      const draftLat = Number((draft.formData as { latitude?: string } | undefined)?.latitude ?? '');
      const draftLng = Number((draft.formData as { longitude?: string } | undefined)?.longitude ?? '');
      if (Number.isFinite(draftLat) && Number.isFinite(draftLng) && draft.formData?.address) {
        setSelectedSuggestion({
          id: `draft-${draftLat}-${draftLng}`,
          primary: draft.formData.address,
          secondary: [draft.formData.city, draft.formData.province].filter(Boolean).join(', '),
          address: {
            formatted: draft.formData.address,
            lat: draftLat,
            lng: draftLng,
            city: draft.formData.city ?? null,
            state: (draft.formData as { province?: string } | undefined)?.province ?? null,
            postal_code: draft.formData.postalCode ?? null,
            country: 'Canada',
            country_code: 'CA',
            street: null,
            street_number: null
          }
        });
      }

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
        province: space.province ?? '',
        postalCode: space.postal_code ?? '',
        derivedZone: space.derived_zone ?? deriveZoneFromCityName(space.city) ?? '',
        latitude: typeof space.latitude === 'number' ? String(space.latitude) : '',
        longitude: typeof space.longitude === 'number' ? String(space.longitude) : '',
        floor: space.floor ?? '',
        accessCode: space.access_code ?? '',
        notes: space.notes ?? '',
        isFavorite: space.is_favorite
      });
      setAddressQuery(space.address ?? '');
      setAddressMode(space.latitude !== null && space.longitude !== null ? 'autocomplete' : 'manual');
      if (typeof space.latitude === 'number' && typeof space.longitude === 'number' && space.address) {
        setSelectedSuggestion({
          id: `loaded-${space.latitude}-${space.longitude}`,
          primary: space.address,
          secondary: [space.city, space.province].filter(Boolean).join(', '),
          address: {
            formatted: space.address,
            lat: space.latitude,
            lng: space.longitude,
            city: space.city,
            state: space.province,
            postal_code: space.postal_code,
            country: 'Canada',
            country_code: 'CA',
            street: null,
            street_number: null
          }
        });
      }
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
        addressMode,
        address: form.address,
        city: form.city,
        province: form.province,
        postalCode: form.postalCode,
        derivedZone: form.derivedZone,
        latitude: form.latitude,
        longitude: form.longitude,
        floor: form.floor,
        accessCode: form.accessCode,
        notes: form.notes,
        isFavorite: form.isFavorite
      },
      savedAt: Date.now()
    };

    window.sessionStorage.setItem(ADD_SPACE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [addressMode, editingId, form, step]);

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

  const handleTypeSelect = (spaceType: SpaceType) => {
    setForm((currentForm) => ({ ...currentForm, type: spaceType }));
    setErrorMessage(null);
    window.setTimeout(() => {
      spaceNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      spaceNameRef.current?.focus();
    }, 150);
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

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!addressSectionRef.current?.contains(event.target as Node)) {
        setIsAddressDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, []);

  useEffect(() => {
    if (addressMode !== 'autocomplete') {
      autocompleteAbortRef.current?.abort();
      setAddressSuggestions([]);
      setIsAddressLoading(false);
      return;
    }

    const query = addressQuery.trim();
    if (!geoapifyApiKey || query.length < 3 || (selectedSuggestion?.address.formatted ?? '') === query) {
      autocompleteAbortRef.current?.abort();
      setAddressSuggestions([]);
      setIsAddressLoading(false);
      return;
    }

    const abortController = new AbortController();
    autocompleteAbortRef.current?.abort();
    autocompleteAbortRef.current = abortController;

    const timer = window.setTimeout(() => {
      setIsAddressLoading(true);
      fetchGeoapifyAddressSuggestions(query, geoapifyApiKey, language, abortController.signal)
        .then((results) => setAddressSuggestions(results))
        .catch((error) => {
          if ((error as { name?: string }).name !== 'AbortError') {
            console.error('client geoapify autocomplete error:', error);
            setAddressSuggestions([]);
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setIsAddressLoading(false);
          }
        });
    }, 280);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [addressMode, addressQuery, geoapifyApiKey, language, selectedSuggestion?.address.formatted]);

  const updateDerivedZoneFromCity = (cityValue: string) => {
    const nextZone = deriveZoneFromCityName(cityValue);
    setForm((currentForm) => ({ ...currentForm, city: cityValue, derivedZone: nextZone ?? '' }));
    if (cityValue.trim() && fieldErrors.city) {
      setFieldErrors((currentErrors) => ({ ...currentErrors, city: false }));
    }
  };

  const handleAddressQueryChange = (value: string) => {
    setAddressQuery(value);
    setIsAddressDropdownOpen(true);
    setSelectedSuggestion(null);
    setForm((currentForm) => ({
      ...currentForm,
      address: value,
      city: '',
      province: '',
      postalCode: '',
      derivedZone: '',
      latitude: '',
      longitude: ''
    }));
    if (value.trim() && fieldErrors.address) {
      setFieldErrors((currentErrors) => ({ ...currentErrors, address: false }));
    }
  };

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const zone = deriveZoneFromCityName(suggestion.address.city);
    setSelectedSuggestion(suggestion);
    setAddressQuery(suggestion.address.formatted);
    setAddressSuggestions([]);
    setIsAddressDropdownOpen(false);
    setForm((currentForm) => ({
      ...currentForm,
      address: suggestion.address.formatted,
      city: suggestion.address.city ?? '',
      province: suggestion.address.state ?? '',
      postalCode: suggestion.address.postal_code ?? '',
      derivedZone: zone ?? '',
      latitude: String(suggestion.address.lat),
      longitude: String(suggestion.address.lng)
    }));
    setFieldErrors({ address: false, city: false });
  };

  const switchToManualMode = () => {
    setAddressMode('manual');
    setAddressSuggestions([]);
    setIsAddressDropdownOpen(false);
    setSelectedSuggestion(null);
    setForm((currentForm) => ({ ...currentForm, latitude: '', longitude: '' }));
  };

  const switchToAutocompleteMode = () => {
    setAddressMode('autocomplete');
    setAddressQuery(form.address);
    setIsAddressDropdownOpen(false);
    setSelectedSuggestion(null);
  };

  const handleNext = () => {
    setErrorMessage(null);
    if (phoneGateBlocked) {
      setErrorMessage(content.addSpace.errors.phoneRequiredFirstSpace);
      return;
    }

    if (step === 1 && !form.type) {
      setErrorMessage(content.addSpace.errors.stepOneType);
      return;
    }

    if (step === 1 && !form.name.trim()) {
      setErrorMessage(content.addSpace.errors.stepOneName);
      spaceNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      spaceNameRef.current?.focus();
      return;
    }

    if (
      step === 2 &&
      ((form.formatSystem === 'quebec' && !form.quebecFormat) ||
        (form.formatSystem === 'international' && form.rooms.bedroom === 0 && form.rooms.bathroom === 0))
    ) {
      setErrorMessage(content.addSpace.errors.stepTwoFormat);
      return;
    }

    if (step === 3 && totalRooms <= 0) {
      setErrorMessage(content.addSpace.errors.stepThreeRooms);
      return;
    }

    goToStep(step + 1, 'forward');
  };

  const validateStep4 = () => {
    const nextErrors = {
      address: !form.address.trim(),
      city: !form.city.trim()
    };

    setFieldErrors(nextErrors);

    if (nextErrors.address) {
      setErrorMessage(content.addSpace.errors.toastRequiredFields);
      addressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      addressRef.current?.focus();
      return false;
    }

    if (nextErrors.city) {
      setErrorMessage(content.addSpace.errors.toastRequiredFields);
      cityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cityRef.current?.focus();
      return false;
    }

    if (addressMode === 'autocomplete' && !selectedSuggestion) {
      setErrorMessage(content.addSpace.errors.addressSelectRequired);
      addressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      addressRef.current?.focus();
      return false;
    }

    return true;
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

  const uploadPhoto = async (file: File, userId: string): Promise<string | null> => {
    try {
      let fileToUpload = file;
      if (file.type !== 'image/webp') {
        try {
          fileToUpload = await convertToWebP(file);
        } catch {
          fileToUpload = file;
        }
      }

      const fileName = `${userId}/${Date.now()}.webp`;
      const { error: uploadError } = await supabase
        .storage
        .from('space-photos')
        .upload(fileName, fileToUpload, {
          contentType: 'image/webp',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data } = supabase
        .storage
        .from('space-photos')
        .getPublicUrl(fileName);

      console.log('Saving photo_url:', data.publicUrl);
      return data.publicUrl;
    } catch (error) {
      console.error('Photo upload failed:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (phoneGateBlocked) {
      setErrorMessage(content.addSpace.errors.phoneRequiredFirstSpace);
      return;
    }

    if (!profile?.id) {
      setErrorMessage(content.addSpace.errors.profileMissing);
      return;
    }

    if (!form.type) {
      setErrorMessage(content.addSpace.errors.stepOneType);
      return;
    }

    if (!validateStep4()) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      let photoUrl = existingPhotoUrl;

      if (photoFile) {
        const uploadedPhotoUrl = await uploadPhoto(photoFile, profile.id);
        if (uploadedPhotoUrl) {
          photoUrl = uploadedPhotoUrl;
        } else {
          console.warn('Photo upload failed - saving space without photo');
        }
      }

      if (form.isFavorite) {
        const favoriteResetQuery = supabase.from('spaces').update({ is_favorite: false }).eq('client_id', profile.id);
        if (editingId) {
          await favoriteResetQuery.neq('id', editingId);
        } else {
          await favoriteResetQuery;
        }
      }

      const payloadBase = {
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
      const payloadExtended = {
        ...payloadBase,
        province: form.province.trim() || null,
        derived_zone: form.derivedZone.trim() || deriveZoneFromCityName(form.city) || null,
        latitude: form.latitude.trim() && Number.isFinite(Number(form.latitude)) ? Number(form.latitude) : null,
        longitude: form.longitude.trim() && Number.isFinite(Number(form.longitude)) ? Number(form.longitude) : null
      };

      if (editingId) {
        let { error } = await supabase.from('spaces').update(payloadExtended).eq('id', editingId);
        if (
          error &&
          (error.code === '42703' ||
            error.message?.toLowerCase().includes('province') ||
            error.message?.toLowerCase().includes('derived_zone') ||
            error.message?.toLowerCase().includes('latitude') ||
            error.message?.toLowerCase().includes('longitude'))
        ) {
          const retry = await supabase.from('spaces').update(payloadBase).eq('id', editingId);
          error = retry.error;
        }
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
        let { data, error } = await supabase
          .from('spaces')
          .insert([payloadExtended])
          .select();
        if (
          error &&
          (error.code === '42703' ||
            error.message?.toLowerCase().includes('province') ||
            error.message?.toLowerCase().includes('derived_zone') ||
            error.message?.toLowerCase().includes('latitude') ||
            error.message?.toLowerCase().includes('longitude'))
        ) {
          const retry = await supabase.from('spaces').insert([payloadBase]).select();
          data = retry.data;
          error = retry.error;
        }

        console.log('Spaces insert result:', data);

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

      window.sessionStorage.removeItem(ADD_SPACE_DRAFT_STORAGE_KEY);
      window.sessionStorage.setItem('client-dashboard-toast', content.addSpace.success);
      setShowSuccess(true);
      window.setTimeout(() => {
        navigateTo('clientDashboard');
      }, 1500);
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
        {showSuccess ? (
          <div
            style={{
              position: 'fixed',
              top: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#A8E6CF',
              color: '#085041',
              padding: '12px 24px',
              borderRadius: '9999px',
              fontWeight: '500',
              fontSize: '14px',
              zIndex: 9999,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {content.addSpace.success}
          </div>
        ) : null}
        {showDraftToast ? (
          <div
            className={`mx-4 mt-4 rounded-full bg-[rgba(168,230,207,0.35)] px-4 py-2 text-center text-xs font-medium text-[#047857] transition-opacity duration-500 sm:mx-6 ${fadeDraftToast ? 'opacity-0' : 'opacity-100'}`}
          >
            {content.addSpace.draftRestored}
          </div>
        ) : null}
        {phoneGateBlocked ? (
          <div className="mx-4 mt-4 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm font-medium text-[#92400E] sm:mx-6">
            {content.addSpace.errors.phoneRequiredFirstSpace}
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
                            onClick={() => handleTypeSelect(spaceType)}
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
                        inputRef={spaceNameRef}
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
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5E7EB]" ref={addressSectionRef}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-2">
                        <MapPin size={16} className="text-[#4FC3F7]" />
                        {content.addSpace.detailsStep.title}
                      </h3>
                      <button
                        type="button"
                        onClick={addressMode === 'autocomplete' ? switchToManualMode : switchToAutocompleteMode}
                        className="inline-flex h-9 shrink-0 items-center rounded-full border border-[#E5E7EB] px-3 text-xs font-semibold text-[#1A1A2E] transition-all hover:border-[#BFE9FB] hover:bg-[#F8FCFF]"
                      >
                        {addressMode === 'autocomplete'
                          ? content.addSpace.detailsStep.useManual
                          : content.addSpace.detailsStep.useAutocomplete}
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-[#6B7280]">
                      {addressMode === 'autocomplete'
                        ? content.addSpace.detailsStep.autocompleteHint
                        : content.addSpace.detailsStep.manualHint}
                    </p>
                    <div className="space-y-3">
                      {addressMode === 'autocomplete' ? (
                        <>
                          <Field label={content.addSpace.detailsStep.address}>
                            <div className="relative">
                              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                              <input
                                ref={addressRef}
                                type="text"
                                value={addressQuery}
                                onChange={(event) => handleAddressQueryChange(event.target.value)}
                                onFocus={() => setIsAddressDropdownOpen(true)}
                                className={`w-full rounded-xl border bg-white px-10 py-3 pr-12 text-sm text-[#1A1A2E] outline-none transition-all ${
                                  fieldErrors.address
                                    ? 'border-[#E24B4A] bg-[#FCEBEB]'
                                    : 'border-[#E5E7EB] focus:border-[#4FC3F7] focus:shadow-[0_0_0_4px_rgba(79,195,247,0.12)]'
                                }`}
                              />
                              {addressQuery ? (
                                <button
                                  type="button"
                                  onClick={() => handleAddressQueryChange('')}
                                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280]"
                                >
                                  <X size={14} />
                                </button>
                              ) : null}
                              {isAddressDropdownOpen && geoapifyApiKey && addressQuery.trim().length >= 3 ? (
                                <div className="absolute z-40 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#D1E7F7] bg-white shadow-[0_12px_32px_rgba(17,24,39,0.16)]">
                                  {isAddressLoading ? (
                                    <p className="px-4 py-3 text-sm text-[#6B7280]">Searching...</p>
                                  ) : addressSuggestions.length > 0 ? (
                                    addressSuggestions.map((suggestion) => (
                                      <button
                                        key={suggestion.id}
                                        type="button"
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                        className="w-full border-b border-[#F1F5F9] px-4 py-3 text-left transition-all last:border-b-0 hover:bg-[#F8FCFF]"
                                      >
                                        <p className="text-sm font-semibold text-[#1A1A2E]">{suggestion.primary}</p>
                                        {suggestion.secondary ? <p className="mt-0.5 text-xs text-[#6B7280]">{suggestion.secondary}</p> : null}
                                      </button>
                                    ))
                                  ) : (
                                    <p className="px-4 py-3 text-sm text-[#6B7280]">No result</p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                            {fieldErrors.address ? (
                              <span style={{ color: '#A32D2D', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                {content.addSpace.errors.addressRequired}
                              </span>
                            ) : null}
                          </Field>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Field label={content.addSpace.detailsStep.city}>
                              <TextInput inputRef={cityRef} value={form.city} onChange={(event) => updateDerivedZoneFromCity(event.target.value)} readOnly className={fieldErrors.city ? 'border-[#E24B4A] bg-[#FCEBEB]' : 'border-[#E5E7EB]'} />
                              {fieldErrors.city ? (
                                <span style={{ color: '#A32D2D', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                  {content.addSpace.errors.cityRequired}
                                </span>
                              ) : null}
                            </Field>
                            <Field label={content.addSpace.detailsStep.province}>
                              <TextInput value={form.province} onChange={(event) => setForm((currentForm) => ({ ...currentForm, province: event.target.value }))} readOnly />
                            </Field>
                            <Field label={content.addSpace.detailsStep.postalCode}>
                              <TextInput value={form.postalCode} onChange={(event) => setForm((currentForm) => ({ ...currentForm, postalCode: event.target.value }))} readOnly />
                            </Field>
                          </div>
                        </>
                      ) : (
                        <>
                          <Field label={content.addSpace.detailsStep.address}>
                            <TextInput
                              inputRef={addressRef}
                              value={form.address}
                              onChange={(event) => {
                                const nextAddress = event.target.value;
                                setForm((currentForm) => ({ ...currentForm, address: nextAddress }));
                                setAddressQuery(nextAddress);
                                if (nextAddress.trim() && fieldErrors.address) {
                                  setFieldErrors((currentErrors) => ({ ...currentErrors, address: false }));
                                }
                              }}
                              className={fieldErrors.address ? 'border-[#E24B4A] bg-[#FCEBEB]' : 'border-[#E5E7EB]'}
                            />
                            {fieldErrors.address ? (
                              <span style={{ color: '#A32D2D', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                {content.addSpace.errors.addressRequired}
                              </span>
                            ) : null}
                          </Field>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Field label={content.addSpace.detailsStep.city}>
                              <TextInput
                                inputRef={cityRef}
                                value={form.city}
                                onChange={(event) => updateDerivedZoneFromCity(event.target.value)}
                                className={fieldErrors.city ? 'border-[#E24B4A] bg-[#FCEBEB]' : 'border-[#E5E7EB]'}
                              />
                              {fieldErrors.city ? (
                                <span style={{ color: '#A32D2D', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                  {content.addSpace.errors.cityRequired}
                                </span>
                              ) : null}
                            </Field>
                            <Field label={content.addSpace.detailsStep.province}>
                              <TextInput value={form.province} onChange={(event) => setForm((currentForm) => ({ ...currentForm, province: event.target.value }))} />
                            </Field>
                            <Field label={content.addSpace.detailsStep.postalCode}>
                              <TextInput value={form.postalCode} onChange={(event) => setForm((currentForm) => ({ ...currentForm, postalCode: event.target.value }))} />
                            </Field>
                          </div>
                        </>
                      )}
                      <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-3 py-2">
                        <p className="text-xs font-semibold text-[#6B7280]">{content.addSpace.detailsStep.derivedZone}</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#1A1A2E]">
                          {form.derivedZone || content.addSpace.detailsStep.unknownZone}
                        </p>
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

          {errorMessage ? <ToastError message={errorMessage} onDismiss={() => setErrorMessage(null)} /> : null}
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E5E7EB] bg-white/95 backdrop-blur-sm px-4 py-3 shadow-[0_-4px_12px_rgba(17,24,39,0.08)] sm:px-6">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            {step < 4 ? (
              <button
                type="button"
                disabled={phoneGateBlocked}
                onClick={handleNext}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#4FC3F7] px-6 py-3.5 font-bold text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:min-w-[180px]"
              >
                {content.addSpace.next}
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting || phoneGateBlocked}
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


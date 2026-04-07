import { useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Check,
  Flame,
  Home,
  KeyRound,
  Leaf,
  Minus,
  Paintbrush,
  Plus,
  PlusCircle,
  Ruler,
  Search,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Trees,
  Truck
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { getPathForRoute } from '../i18n/routes';

type ServiceCategory = 'all' | 'home' | 'deep' | 'office' | 'move' | 'renovation' | 'airbnb';
type BadgeTone = 'sky' | 'mint' | 'coral';

type ServiceCardContent = {
  name: string;
  description: string;
  includedLabel: string;
  included: string[];
  price: string;
  duration: string;
  badge?: { label: string; tone: BadgeTone };
};

type AddOnItem = {
  id: string;
  price: number;
  label: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

type ServicePageContent = {
  hero: {
    title: string;
    tagline: string;
    servicePlaceholder: string;
    cityPlaceholder: string;
    search: string;
  };
  filters: Record<ServiceCategory, string>;
  services: Record<Exclude<ServiceCategory, 'all'>, ServiceCardContent>;
  book: string;
  pricing: {
    title: string;
    blocks: Array<{ title: string; description: string }>;
  };
  addOns: {
    title: string;
    items: AddOnItem[];
    totalLabel: (total: number) => string;
  };
  business: {
    title: string;
    subtitle: string;
    bullets: string[];
    cta: string;
  };
  eco: {
    title: string;
    subtitle: string;
    cards: Array<{ title: string; description: string }>;
  };
  faq: {
    title: string;
    items: FAQItem[];
  };
  finalCta: {
    title: string;
    subtitle: string;
    primary: string;
    secondary: string;
  };
};

const badgeClassNames: Record<BadgeTone, string> = {
  sky: 'bg-[#4FC3F7] text-white',
  mint: 'bg-[#A8E6CF] text-[#1A1A2E]',
  coral: 'bg-[#FFE1D6] text-[#C85A36]'
};

const coverClassNames: Record<Exclude<ServiceCategory, 'all'>, string> = {
  home: 'from-[#4FC3F7] via-[#A8E6CF] to-[#F7F7F7]',
  deep: 'from-[#A8E6CF] via-[#DFF5EA] to-[#FFFFFF]',
  office: 'from-[#E8F7FE] via-[#CFEFFC] to-[#FFFFFF]',
  move: 'from-[#F7F7F7] via-[#E8F7FE] to-[#A8E6CF]',
  renovation: 'from-[#FFE7DE] via-[#F7F7F7] to-[#E8F7FE]',
  airbnb: 'from-[#DFF5EA] via-[#F7F7F7] to-[#E8F7FE]'
};

const serviceIcons = {
  home: Home,
  deep: Sparkles,
  office: Briefcase,
  move: Truck,
  renovation: Paintbrush,
  airbnb: KeyRound
};

const addOnIcons = {
  fridge: Snowflake,
  oven: Flame,
  windows: Building2,
  laundry: Shirt,
  eco: Leaf,
  balcony: Trees
};

const pricingIcons = [Ruler, SlidersHorizontal, PlusCircle];
const businessIcons = [ShieldCheck, Briefcase, Sparkles];

const pageContent: Record<Language, ServicePageContent> = {
  fr: {
    hero: {
      title: 'Services de nettoyage disponibles sur Nettoyó',
      tagline:
        'Trouvez des nettoyeurs indépendants à Montréal, Laval, Longueuil, sur la Rive-Nord et la Rive-Sud, puis comparez prix et disponibilités.',
      servicePlaceholder: 'Type de service',
      cityPlaceholder: 'Votre ville',
      search: 'Rechercher'
    },
    filters: {
      all: 'Tous',
      home: 'Domicile',
      deep: 'Nettoyage en profondeur',
      office: 'Bureau',
      move: 'Déménagement',
      renovation: 'Post-rénovation',
      airbnb: 'Airbnb'
    },
    services: {
      home: {
        name: 'Nettoyage à domicile',
        description:
          'Service proposé par des nettoyeurs indépendants sur la plateforme pour l’entretien régulier de votre logement.',
        includedLabel: 'Exemples de tâches proposées',
        included: [
          'Sols, surfaces et poussière',
          'Cuisine et salle de bain',
          'Rangement léger selon accord',
          'Intervention selon les préférences du nettoyeur'
        ],
        price: 'Prix variable selon le nettoyeur',
        duration: 'Durée estimée selon la demande',
        badge: { label: 'Le plus recherché', tone: 'sky' }
      },
      deep: {
        name: 'Nettoyage en profondeur',
        description:
          'Pour un besoin plus détaillé, comparez les profils qui offrent un nettoyage approfondi et leurs conditions.',
        includedLabel: 'Exemples de tâches proposées',
        included: [
          'Nettoyage détaillé des zones critiques',
          'Zones difficiles d’accès selon accord',
          'Durée et périmètre définis avec le nettoyeur',
          'Niveau de détail variable selon le profil'
        ],
        price: 'Prix variable selon le nettoyeur',
        duration: 'Souvent plus long qu’un entretien régulier'
      },
      office: {
        name: 'Nettoyage de bureau',
        description:
          'Des nettoyeurs indépendants peuvent proposer des interventions pour bureaux et espaces professionnels.',
        includedLabel: 'Exemples de tâches proposées',
        included: [
          'Postes de travail et espaces communs',
          'Cuisine et sanitaires',
          'Fréquence ponctuelle ou récurrente',
          'Périmètre défini avec le nettoyeur'
        ],
        price: 'Prix variable selon le nettoyeur',
        duration: 'Selon surface et fréquence'
      },
      move: {
        name: 'Nettoyage de déménagement',
        description:
          'Idéal avant ou après un déménagement, selon les prestations proposées par chaque nettoyeur.',
        includedLabel: 'Exemples de tâches proposées',
        included: [
          'Nettoyage général du logement',
          'Électroménagers et vitres selon accord',
          'Intervention adaptée à l’état des lieux',
          'Services additionnels selon disponibilité'
        ],
        price: 'Prix variable selon le nettoyeur',
        duration: 'Selon taille du logement'
      },
      renovation: {
        name: 'Nettoyage post-rénovation',
        description:
          'Comparez les nettoyeurs qui acceptent les interventions après travaux et vérifiez leur expérience.',
        includedLabel: 'Exemples de tâches proposées',
        included: [
          'Poussière de chantier et surfaces',
          'Nettoyage ciblé selon le type de travaux',
          'Matériel et méthode selon le nettoyeur',
          'Estimation personnalisée selon le besoin'
        ],
        price: 'Prix variable selon le nettoyeur',
        duration: 'Selon complexité des travaux',
        badge: { label: 'Demande spécialisée', tone: 'coral' }
      },
      airbnb: {
        name: 'Remise en état Airbnb',
        description:
          'Pour les locations courte durée, trouvez des nettoyeurs disponibles entre deux réservations.',
        includedLabel: 'Exemples de tâches proposées',
        included: [
          'Préparation du logement entre séjours',
          'Linge et réapprovisionnement selon accord',
          'Coordination horaire selon disponibilité',
          'Choix du profil selon prix et avis'
        ],
        price: 'Prix variable selon le nettoyeur',
        duration: 'Selon rotation et taille du logement',
        badge: { label: 'Très demandé', tone: 'mint' }
      }
    },
    book: 'Voir les profils',
    pricing: {
      title: 'Comment fonctionne la tarification',
      blocks: [
        {
          title: 'Frais de plateforme',
          description:
            'Nettoyó facture un petit frais de plateforme par réservation (exemple : 5 $) pour faciliter la mise en relation.'
        },
        {
          title: 'Prix fixés par les nettoyeurs',
          description:
            'Chaque nettoyeur indépendant fixe ses propres tarifs. Comparez prix, disponibilité et avis avant de choisir.'
        },
        {
          title: 'Paiement direct du service',
          description:
            'Le paiement de la prestation est réglé directement entre le client et le nettoyeur, en dehors de la plateforme.'
        }
      ]
    },
    addOns: {
      title: 'Options possibles selon le nettoyeur',
      items: [
        { id: 'fridge', label: 'Intérieur du frigo', price: 15 },
        { id: 'oven', label: 'Intérieur du four', price: 15 },
        { id: 'windows', label: 'Vitres intérieures', price: 20 },
        { id: 'laundry', label: 'Lessive / pliage', price: 25 },
        { id: 'eco', label: 'Produits écoresponsables', price: 10 },
        { id: 'balcony', label: 'Balcon / terrasse', price: 18 }
      ],
      totalLabel: (total) =>
        `Exemple d’options sélectionnées : +$${total} (les prix finaux varient selon le nettoyeur)`
    },
    business: {
      title: 'Vous gérez plusieurs logements ou locaux ?',
      subtitle:
        'Nettoyó vous aide à trouver des nettoyeurs indépendants selon vos besoins récurrents, sans imposer de prestataire unique.',
      bullets: [
        'Comparez plusieurs profils pour un même besoin',
        'Choisissez selon disponibilité, zone et prix',
        'Coordonnez directement avec les nettoyeurs retenus'
      ],
      cta: 'Parler à notre équipe'
    },
    eco: {
      title: 'Choisissez aussi selon vos préférences',
      subtitle:
        'Certains nettoyeurs indiquent des pratiques écoresponsables dans leur profil. Vous pouvez comparer ces critères avant de réserver.',
      cards: [
        {
          title: 'Profils détaillés',
          description: 'Consultez les méthodes, produits et préférences déclarés par chaque nettoyeur.'
        },
        {
          title: 'Comparaison transparente',
          description: 'Comparez les options selon vos priorités : budget, horaire, zone et style de prestation.'
        },
        {
          title: 'Choix flexible',
          description: 'Vous restez libre de changer de nettoyeur selon vos besoins à chaque réservation.'
        }
      ]
    },
    faq: {
      title: 'Questions sur les services',
      items: [
        {
          question: 'Nettoyó fournit-il directement le service de nettoyage ?',
          answer:
            'Non. Nettoyó facilite la mise en relation entre clients et nettoyeurs indépendants. Les prestations sont réalisées par ces professionnels.'
        },
        {
          question: 'Pourquoi les prix ne sont-ils pas fixes ?',
          answer:
            'Chaque nettoyeur fixe ses propres tarifs. Les prix peuvent varier selon la zone, la disponibilité, le type de service et l’expérience.'
        },
        {
          question: 'Comment payer la réservation ?',
          answer:
            'Vous payez le frais de plateforme dans l’application. Le paiement du service se fait directement au nettoyeur hors plateforme.'
        },
        {
          question: 'Dans quelles zones les services sont-ils disponibles ?',
          answer:
            'Les disponibilités dépendent des nettoyeurs actifs, notamment à Montréal, Laval, Longueuil, sur la Rive-Nord et la Rive-Sud.'
        },
        {
          question: 'Comment choisir le bon nettoyeur ?',
          answer:
            'Comparez les profils selon les avis, le prix, la zone, les horaires et les types de services proposés.'
        }
      ]
    },
    finalCta: {
      title: 'Trouvez le profil qui vous convient',
      subtitle:
        'Comparez les nettoyeurs indépendants, envoyez une demande et organisez votre prestation en toute transparence.',
      primary: 'Commencer une demande',
      secondary: 'Nous contacter'
    }
  },
  en: {
    hero: {
      title: 'Our cleaning services',
      tagline: 'Find the service you need, book in minutes.',
      servicePlaceholder: 'Service type',
      cityPlaceholder: 'Your city',
      search: 'Search'
    },
    filters: {
      all: 'All',
      home: 'Home',
      deep: 'Deep Clean',
      office: 'Office',
      move: 'Move-out',
      renovation: 'Post-renovation',
      airbnb: 'Airbnb'
    },
    services: {
      home: {
        name: 'Home Cleaning',
        description: 'A complete cleaning of your home, room by room.',
        includedLabel: "What's included",
        included: [
          'Vacuuming and mopping floors',
          'Cleaning surfaces and furniture',
          'Bathroom and kitchen',
          'Emptying bins'
        ],
        price: 'From $25/h',
        duration: '2h â€“ 4h',
        badge: { label: 'Most popular', tone: 'sky' }
      },
      deep: {
        name: 'Deep Clean',
        description: 'An intensive clean to restore your home to its best condition.',
        includedLabel: "What's included",
        included: [
          'Everything in Home Cleaning',
          'Inside cupboards',
          'Behind appliances',
          'Grout and hard-to-reach spots'
        ],
        price: 'From $35/h',
        duration: '4h â€“ 8h'
      },
      office: {
        name: 'Office Cleaning',
        description: 'Clean and welcoming professional spaces for your team.',
        includedLabel: "What's included",
        included: [
          'Desks, workstations, meeting rooms',
          'Kitchen and common areas',
          'Restrooms',
          'Waste management'
        ],
        price: 'Custom quote',
        duration: 'Depends on size'
      },
      move: {
        name: 'Move-out Cleaning',
        description: 'Leave your home spotless before handing back the keys.',
        includedLabel: "What's included",
        included: [
          'Full clean of all rooms',
          'Inside fridge and oven',
          'Windows and mirrors',
          'Cleaning report provided'
        ],
        price: 'From $120',
        duration: '4h â€“ 6h'
      },
      renovation: {
        name: 'Post-renovation',
        description: "Let's clear the dust, debris and construction residue together.",
        includedLabel: "What's included",
        included: [
          'Full dusting and vacuuming',
          'Cleaning windows and frames',
          'Removing paint residue',
          'Floors and surfaces after works'
        ],
        price: 'From $45/h',
        duration: '4h â€“ 10h',
        badge: { label: 'New', tone: 'coral' }
      },
      airbnb: {
        name: 'Airbnb Turnover',
        description: "Between every guest, a home that's ready and sparkling.",
        includedLabel: "What's included",
        included: [
          'Full quick clean',
          'Fresh bed linen change',
          'Restocking consumables',
          'End-of-service photos'
        ],
        price: 'From $30',
        duration: '1h â€“ 3h',
        badge: { label: 'Eco-friendly', tone: 'mint' }
      }
    },
    book: 'Book',
    pricing: {
      title: 'How are our prices calculated?',
      blocks: [
        {
          title: 'Size of your space',
          description: 'The larger your space, the more time we allocate.'
        },
        {
          title: 'Type of service chosen',
          description: 'Each service has its own level of detail and duration.'
        },
        {
          title: 'Additional options',
          description: 'Add extras based on your specific needs.'
        }
      ]
    },
    addOns: {
      title: 'Add extras to your booking',
      items: [
        { id: 'fridge', label: 'Fridge cleaning', price: 15 },
        { id: 'oven', label: 'Oven cleaning', price: 15 },
        { id: 'windows', label: 'Window cleaning', price: 20 },
        { id: 'laundry', label: 'Laundry and ironing', price: 25 },
        { id: 'eco', label: 'Eco-friendly products', price: 10 },
        { id: 'balcony', label: 'Balcony cleaning', price: 18 }
      ],
      totalLabel: (total) => `Selected options: $${total} extra`
    },
    business: {
      title: 'Are you a business?',
      subtitle: 'Tailored solutions for offices, hotels and Airbnb hosts.',
      bullets: [
        'Recurring contracts with preferential rates',
        'Simplified monthly invoicing',
        'Dedicated and priority cleaners'
      ],
      cta: 'Request a quote'
    },
    eco: {
      title: 'Our eco-friendly commitment',
      subtitle: "Because a clean space shouldn't cost the planet.",
      cards: [
        {
          title: 'Certified products',
          description: 'All our eco products are certified and biodegradable.'
        },
        {
          title: 'Less waste',
          description: 'We use reusable tools and minimize plastic.'
        },
        {
          title: 'Trained cleaners',
          description: 'Our cleaners are trained in good environmental practices.'
        }
      ]
    },
    faq: {
      title: 'Questions about our services',
      items: [
        {
          question: 'What is included in each service?',
          answer: 'Each service has a detailed list of inclusions visible on its card. You can also add extra options during booking.'
        },
        {
          question: 'How long does a cleaning session take?',
          answer: 'The duration depends on the size of your home and the service chosen. An estimate is shown on each service card.'
        },
        {
          question: 'Do I need to be home during the cleaning?',
          answer: "No, you don't need to be present. You can leave access instructions during the booking process."
        },
        {
          question: 'Do cleaners bring their own equipment?',
          answer: 'Yes, all cleaners come with their own professional equipment. If you want eco-friendly products, select the option during booking.'
        },
        {
          question: 'Can I modify or cancel my booking?',
          answer: 'Yes. You can modify or cancel for free up to 24 hours before your session from your personal dashboard.'
        }
      ]
    },
    finalCta: {
      title: 'Which service is right for you?',
      subtitle: 'Book in a few minutes or contact us for a custom quote.',
      primary: 'Book now',
      secondary: 'Contact us'
    }
  },
  es: {
    hero: {
      title: 'Nuestros servicios de limpieza',
      tagline: 'Encuentra el servicio que necesitas, reserva en minutos.',
      servicePlaceholder: 'Tipo de servicio',
      cityPlaceholder: 'Tu ciudad',
      search: 'Buscar'
    },
    filters: {
      all: 'Todos',
      home: 'Hogar',
      deep: 'Limpieza profunda',
      office: 'Oficina',
      move: 'Mudanza',
      renovation: 'Post-renovaciÃ³n',
      airbnb: 'Airbnb'
    },
    services: {
      home: {
        name: 'Limpieza del hogar',
        description: 'Una limpieza completa de tu hogar, habitaciÃ³n por habitaciÃ³n.',
        includedLabel: 'QuÃ© incluye',
        included: [
          'Aspirado y fregado de suelos',
          'Limpieza de superficies y muebles',
          'BaÃ±o y cocina',
          'Vaciado de papeleras'
        ],
        price: 'Desde $25/h',
        duration: '2h â€“ 4h',
        badge: { label: 'MÃ¡s popular', tone: 'sky' }
      },
      deep: {
        name: 'Limpieza profunda',
        description: 'Una limpieza intensiva para devolver tu hogar a su mejor estado.',
        includedLabel: 'QuÃ© incluye',
        included: [
          'Todo lo de Limpieza del hogar',
          'Interior de armarios',
          'DetrÃ¡s de electrodomÃ©sticos',
          'Juntas y rincones difÃ­ciles'
        ],
        price: 'Desde $35/h',
        duration: '4h â€“ 8h'
      },
      office: {
        name: 'Limpieza de oficina',
        description: 'Espacios profesionales limpios y acogedores para tu equipo.',
        includedLabel: 'QuÃ© incluye',
        included: [
          'Escritorios, puestos, salas de reuniones',
          'Cocina y zonas comunes',
          'BaÃ±os',
          'GestiÃ³n de residuos'
        ],
        price: 'Presupuesto',
        duration: 'SegÃºn superficie'
      },
      move: {
        name: 'Limpieza de mudanza',
        description: 'Deja tu hogar impecable antes de entregar las llaves.',
        includedLabel: 'QuÃ© incluye',
        included: [
          'Limpieza completa de todas las habitaciones',
          'Interior de nevera y horno',
          'Ventanas y espejos',
          'Informe de limpieza incluido'
        ],
        price: 'Desde $120',
        duration: '4h â€“ 6h'
      },
      renovation: {
        name: 'Post-renovaciÃ³n',
        description: 'Eliminemos juntos polvo, escombros y residuos de obra.',
        includedLabel: 'QuÃ© incluye',
        included: [
          'Desempolvado y aspirado completo',
          'Limpieza de ventanas y marcos',
          'EliminaciÃ³n de residuos de pintura',
          'Suelos y superficies tras obras'
        ],
        price: 'Desde $45/h',
        duration: '4h â€“ 10h',
        badge: { label: 'Nuevo', tone: 'coral' }
      },
      airbnb: {
        name: 'RotaciÃ³n Airbnb',
        description: 'Entre cada huÃ©sped, un hogar listo y reluciente.',
        includedLabel: 'QuÃ© incluye',
        included: [
          'Limpieza completa y rÃ¡pida',
          'Cambio de ropa de cama',
          'ReposiciÃ³n de consumibles',
          'Fotos al final del servicio'
        ],
        price: 'Desde $30',
        duration: '1h â€“ 3h',
        badge: { label: 'Eco-friendly', tone: 'mint' }
      }
    },
    book: 'Reservar',
    pricing: {
      title: 'Â¿CÃ³mo calculamos nuestros precios?',
      blocks: [
        {
          title: 'TamaÃ±o de tu espacio',
          description: 'Cuanto mÃ¡s grande es tu espacio, mÃ¡s tiempo asignamos.'
        },
        {
          title: 'Tipo de servicio elegido',
          description: 'Cada servicio tiene su propio nivel de detalle y duraciÃ³n.'
        },
        {
          title: 'Opciones adicionales',
          description: 'AÃ±ade extras segÃºn tus necesidades especÃ­ficas.'
        }
      ]
    },
    addOns: {
      title: 'AÃ±ade opciones a tu reserva',
      items: [
        { id: 'fridge', label: 'Limpieza de nevera', price: 15 },
        { id: 'oven', label: 'Limpieza del horno', price: 15 },
        { id: 'windows', label: 'Limpieza de ventanas', price: 20 },
        { id: 'laundry', label: 'LavanderÃ­a y planchado', price: 25 },
        { id: 'eco', label: 'Productos ecolÃ³gicos', price: 10 },
        { id: 'balcony', label: 'Limpieza del balcÃ³n', price: 18 }
      ],
      totalLabel: (total) => `Opciones seleccionadas: $${total} adicional`
    },
    business: {
      title: 'Â¿Eres una empresa?',
      subtitle: 'Soluciones a medida para oficinas, hoteles y anfitriones de Airbnb.',
      bullets: [
        'Contratos recurrentes con tarifas preferenciales',
        'FacturaciÃ³n mensual simplificada',
        'Limpiadores dedicados y prioritarios'
      ],
      cta: 'Solicitar presupuesto'
    },
    eco: {
      title: 'Nuestro compromiso ecolÃ³gico',
      subtitle: 'Porque un espacio limpio no deberÃ­a costarle nada al planeta.',
      cards: [
        {
          title: 'Productos certificados',
          description: 'Todos nuestros productos eco estÃ¡n certificados y son biodegradables.'
        },
        {
          title: 'Menos residuos',
          description: 'Usamos herramientas reutilizables y minimizamos el plÃ¡stico.'
        },
        {
          title: 'Limpiadores formados',
          description: 'Nuestros limpiadores estÃ¡n formados en buenas prÃ¡cticas medioambientales.'
        }
      ]
    },
    faq: {
      title: 'Preguntas sobre nuestros servicios',
      items: [
        {
          question: 'Â¿QuÃ© incluye cada servicio?',
          answer: 'Cada servicio tiene una lista detallada de inclusiones visible en su tarjeta. TambiÃ©n puedes aÃ±adir opciones extra durante la reserva.'
        },
        {
          question: 'Â¿CuÃ¡nto dura una sesiÃ³n de limpieza?',
          answer: 'La duraciÃ³n depende del tamaÃ±o de tu hogar y del servicio elegido. Se muestra una estimaciÃ³n en cada tarjeta de servicio.'
        },
        {
          question: 'Â¿Debo estar en casa durante la limpieza?',
          answer: 'No, no necesitas estar presente. Puedes dejar las instrucciones de acceso durante la reserva.'
        },
        {
          question: 'Â¿Los limpiadores traen su propio equipo?',
          answer: 'SÃ­, todos los limpiadores vienen con su propio equipo profesional. Si deseas productos ecolÃ³gicos, selecciona la opciÃ³n durante la reserva.'
        },
        {
          question: 'Â¿Puedo modificar o cancelar mi reserva?',
          answer: 'SÃ­. Puedes modificar o cancelar gratis hasta 24 horas antes de tu sesiÃ³n desde tu panel personal.'
        }
      ]
    },
    finalCta: {
      title: 'Â¿QuÃ© servicio te conviene?',
      subtitle: 'Reserva en pocos minutos o contÃ¡ctanos para un presupuesto personalizado.',
      primary: 'Reservar ahora',
      secondary: 'ContÃ¡ctanos'
    }
  },
};

export function ServicesPage() {
  const { language } = useLanguage();
  const content = pageContent[language];
  const [selectedFilter, setSelectedFilter] = useState<ServiceCategory>('all');
  const [searchCategory, setSearchCategory] = useState<ServiceCategory>('all');
  const [city, setCity] = useState('');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [openFaq, setOpenFaq] = useState(0);
  const bookingPath = getPathForRoute(language, 'login');
  const contactPath = 'mailto:hello@nettoyo.com';

  const filteredServices = useMemo(() => {
    const entries = Object.entries(content.services) as Array<
      [Exclude<ServiceCategory, 'all'>, ServiceCardContent]
    >;

    if (selectedFilter === 'all') {
      return entries;
    }

    return entries.filter(([key]) => key === selectedFilter);
  }, [content.services, selectedFilter]);

  const addOnTotal = useMemo(
    () =>
      content.addOns.items
        .filter((item) => selectedAddOns.includes(item.id))
        .reduce((sum, item) => sum + item.price, 0),
    [content.addOns.items, selectedAddOns]
  );

  const handleSearch = () => {
    setSelectedFilter(searchCategory);
    document.getElementById('services-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  return (
    <div className="bg-white">
      <section className="border-b border-[#E5E7EB] bg-[rgba(168,230,207,0.2)]">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-[#1A1A2E] md:text-5xl">{content.hero.title}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg text-[#6B7280]">{content.hero.tagline}</p>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_20px_40px_rgba(17,24,39,0.06)] backdrop-blur-sm md:grid-cols-[1.15fr_1fr_auto]">
            <div className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">
              <SlidersHorizontal size={18} className="text-[#6B7280]" />
              <select
                value={searchCategory}
                onChange={(event) => setSearchCategory(event.target.value as ServiceCategory)}
                className="w-full bg-transparent text-sm text-[#1A1A2E] outline-none"
              >
                <option value="all">{content.hero.servicePlaceholder}</option>
                {(Object.entries(content.filters) as Array<[ServiceCategory, string]>)
                  .filter(([key]) => key !== 'all')
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">
              <Building2 size={18} className="text-[#6B7280]" />
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder={content.hero.cityPlaceholder}
                className="w-full bg-transparent text-sm text-[#1A1A2E] outline-none placeholder:text-[#9CA3AF]"
              />
            </div>

            <button
              onClick={handleSearch}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4FC3F7] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#3FAAD4]"
            >
              <Search size={18} />
              {content.hero.search}
            </button>
          </div>
        </div>
      </section>

      <section className="border-b border-[#E5E7EB] bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(Object.entries(content.filters) as Array<[ServiceCategory, string]>).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setSelectedFilter(key);
                  setSearchCategory(key);
                }}
                className={`whitespace-nowrap rounded-full border px-5 py-3 text-sm font-semibold transition-all ${
                  selectedFilter === key
                    ? 'border-[#4FC3F7] bg-[#4FC3F7] text-white'
                    : 'border-[#E5E7EB] bg-white text-[#1A1A2E] hover:border-[#4FC3F7]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="services-grid" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-[#1A1A2E]">
                {selectedFilter === 'all' ? content.hero.title : content.filters[selectedFilter]}
              </h2>
              <p className="mt-2 text-sm text-[#6B7280]">
                {city.trim() ? `${filteredServices.length} services â€¢ ${city}` : `${filteredServices.length} services`}
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredServices.map(([key, service]) => {
              const Icon = serviceIcons[key];

              return (
                <article
                  key={key}
                  className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_14px_36px_rgba(17,24,39,0.06)]"
                >
                  <div className={`relative h-44 bg-gradient-to-br ${coverClassNames[key]} p-5`}>
                    {service.badge ? (
                      <span className={`inline-flex rounded-full px-4 py-2 text-xs font-semibold ${badgeClassNames[service.badge.tone]}`}>
                        {service.badge.label}
                      </span>
                    ) : null}

                    <div className="absolute inset-x-0 bottom-0 flex justify-center pb-5">
                      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/80 bg-white/80 shadow-sm">
                        <Icon size={34} className="text-[#1A1A2E]" />
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-[18px] font-bold text-[#1A1A2E]">{service.name}</h3>
                    <p className="mt-3 min-h-[3.5rem] text-sm leading-6 text-[#6B7280]">{service.description}</p>
                    <div className="my-5 border-t border-[#E5E7EB]" />
                    <div>
                      <div className="text-sm font-semibold text-[#1A1A2E]">{service.includedLabel}</div>
                      <ul className="mt-3 space-y-2">
                        {service.included.map((item) => (
                          <li key={item} className="flex items-start gap-3 text-sm text-[#6B7280]">
                            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(168,230,207,0.35)]">
                              <Check size={12} className="text-[#059669]" />
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-5">
                      <span className="text-lg font-bold text-[#4FC3F7]">{service.price}</span>
                      <span className="text-sm text-[#6B7280]">{service.duration}</span>
                      <a
                        href={bookingPath}
                        className="rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3FAAD4]"
                      >
                        {content.book}
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[rgba(79,195,247,0.1)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-[#1A1A2E] md:text-4xl">{content.pricing.title}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.pricing.blocks.map((block, index) => {
              const Icon = pricingIcons[index];

              return (
                <div key={block.title} className="rounded-2xl bg-white p-8 text-center shadow-[0_12px_32px_rgba(17,24,39,0.06)]">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7]">
                    <Icon size={28} className="text-[#4FC3F7]" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-[#1A1A2E]">{block.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#6B7280]">{block.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-[#1A1A2E] md:text-4xl">{content.addOns.title}</h2>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {content.addOns.items.map((item) => {
              const Icon = addOnIcons[item.id as keyof typeof addOnIcons];
              const isSelected = selectedAddOns.includes(item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => toggleAddOn(item.id)}
                  className={`inline-flex items-center gap-3 rounded-full border px-5 py-3 text-sm font-semibold transition-all ${
                    isSelected
                      ? 'border-[#4FC3F7] bg-[#4FC3F7] text-white'
                      : 'border-[#E5E7EB] bg-white text-[#1A1A2E] hover:border-[#4FC3F7]'
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                  <span className={isSelected ? 'text-white/90' : 'text-[#6B7280]'}>+${item.price}</span>
                </button>
              );
            })}
          </div>

          <div className="mx-auto mt-8 max-w-3xl border-t border-[#E5E7EB] pt-5 text-center text-sm text-[#6B7280]">
            {content.addOns.totalLabel(addOnTotal)}
          </div>
        </div>
      </section>

      <section className="bg-[#1A1A2E] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <h2 className="text-3xl font-bold text-white md:text-4xl">{content.business.title}</h2>
            <p className="mt-4 max-w-2xl text-lg text-[#D1D5DB]">{content.business.subtitle}</p>
            <a
              href={contactPath}
              className="mt-8 inline-flex rounded-lg bg-[#A8E6CF] px-8 py-4 font-bold text-[#1A1A2E] transition-colors hover:bg-[#97d9be]"
            >
              {content.business.cta}
            </a>
          </div>

          <div className="grid gap-4">
            {content.business.bullets.map((bullet, index) => {
              const Icon = businessIcons[index];

              return (
                <div key={bullet} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#A8E6CF] text-[#1A1A2E]">
                      <Icon size={20} />
                    </div>
                    <p className="text-base font-semibold text-white">{bullet}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[rgba(168,230,207,0.15)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
            <Leaf size={28} className="text-[#1A1A2E]" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-[#1A1A2E] md:text-4xl">{content.eco.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#6B7280]">{content.eco.subtitle}</p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.eco.cards.map((card) => (
              <div key={card.title} className="rounded-2xl bg-white p-7 shadow-[0_12px_32px_rgba(17,24,39,0.06)]">
                <h3 className="text-xl font-bold text-[#1A1A2E]">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#6B7280]">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-[#1A1A2E] md:text-4xl">{content.faq.title}</h2>
          <div className="mt-10 space-y-4">
            {content.faq.items.map((item, index) => {
              const isOpen = openFaq === index;

              return (
                <div key={item.question} className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
                  <button
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-base font-semibold text-[#1A1A2E]">{item.question}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F7F7] text-[#1A1A2E]">
                      {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                    </span>
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-6 text-sm leading-6 text-[#6B7280]">{item.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[rgba(168,230,207,0.25)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-[rgba(255,255,255,0.6)] bg-white/40 px-6 py-12 text-center shadow-[0_20px_40px_rgba(17,24,39,0.06)] backdrop-blur-sm sm:px-10">
          <h2 className="text-3xl font-bold text-[#1A1A2E] md:text-4xl">{content.finalCta.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#6B7280]">{content.finalCta.subtitle}</p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href={bookingPath}
              className="rounded-lg bg-[#4FC3F7] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-[#3FAAD4]"
            >
              {content.finalCta.primary}
            </a>
            <a
              href={contactPath}
              className="rounded-lg border border-[#1A1A2E] px-8 py-4 text-base font-bold text-[#1A1A2E] transition-colors hover:bg-white/70"
            >
              {content.finalCta.secondary}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

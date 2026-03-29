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
      title: 'Nos services de nettoyage',
      tagline: "Trouvez le service qu'il vous faut, réservez en quelques minutes.",
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
        name: 'Nettoyage domicile',
        description: 'Un nettoyage complet de votre logement, pièce par pièce.',
        includedLabel: 'Ce qui est inclus',
        included: [
          'Aspiration et lavage des sols',
          'Nettoyage des surfaces et meubles',
          'Salle de bain et cuisine',
          'Vider les poubelles'
        ],
        price: 'À partir de $25/h',
        duration: '2h – 4h',
        badge: { label: 'Le plus populaire', tone: 'sky' }
      },
      deep: {
        name: 'Nettoyage en profondeur',
        description: 'Un nettoyage intensif pour redonner un éclat neuf à votre logement.',
        includedLabel: 'Ce qui est inclus',
        included: [
          'Tout le nettoyage domicile inclus',
          'Intérieur des placards',
          'Derrière les appareils électroménagers',
          'Joints et recoins'
        ],
        price: 'À partir de $35/h',
        duration: '4h – 8h'
      },
      office: {
        name: 'Nettoyage bureau',
        description: 'Des locaux professionnels propres et accueillants pour vos équipes.',
        includedLabel: 'Ce qui est inclus',
        included: [
          'Bureaux, postes de travail, salles de réunion',
          'Cuisine et espaces communs',
          'Sanitaires',
          'Gestion des déchets'
        ],
        price: 'Sur devis',
        duration: 'Selon surface'
      },
      move: {
        name: 'Nettoyage déménagement',
        description: 'Rendez votre logement impeccable avant de rendre les clés.',
        includedLabel: 'Ce qui est inclus',
        included: [
          'Nettoyage complet de toutes les pièces',
          'Intérieur frigo et four',
          'Vitres et miroirs',
          'Rapport de nettoyage fourni'
        ],
        price: 'À partir de $120',
        duration: '4h – 6h'
      },
      renovation: {
        name: 'Post-rénovation',
        description: 'Éliminons ensemble poussière, gravats et résidus de chantier.',
        includedLabel: 'Ce qui est inclus',
        included: [
          'Dépoussiérage complet',
          'Nettoyage des vitres et cadres',
          'Élimination des résidus de peinture',
          'Sols et surfaces après travaux'
        ],
        price: 'À partir de $45/h',
        duration: '4h – 10h',
        badge: { label: 'Nouveau', tone: 'coral' }
      },
      airbnb: {
        name: 'Remise en état Airbnb',
        description: 'Entre chaque voyageur, un logement prêt à accueillir et qui brille.',
        includedLabel: 'Ce qui est inclus',
        included: [
          'Nettoyage complet et rapide',
          'Changement du linge de lit',
          'Réapprovisionnement des consommables',
          'Photos de fin de prestation'
        ],
        price: 'À partir de $30',
        duration: '1h – 3h',
        badge: { label: 'Éco-friendly', tone: 'mint' }
      }
    },
    book: 'Réserver',
    pricing: {
      title: 'Comment sont calculés nos tarifs ?',
      blocks: [
        {
          title: 'Surface de votre logement',
          description: 'Plus votre espace est grand, plus la durée est adaptée.'
        },
        {
          title: 'Type de service choisi',
          description: 'Chaque service a son propre niveau de détail et de durée.'
        },
        {
          title: 'Options supplémentaires',
          description: 'Ajoutez des extras selon vos besoins spécifiques.'
        }
      ]
    },
    addOns: {
      title: 'Ajoutez des options à votre réservation',
      items: [
        { id: 'fridge', label: 'Nettoyage du frigo', price: 15 },
        { id: 'oven', label: 'Nettoyage du four', price: 15 },
        { id: 'windows', label: 'Nettoyage des vitres', price: 20 },
        { id: 'laundry', label: 'Lessive et repassage', price: 25 },
        { id: 'eco', label: 'Produits éco-responsables', price: 10 },
        { id: 'balcony', label: 'Nettoyage du balcon', price: 18 }
      ],
      totalLabel: (total) => `Options sélectionnées : $${total} supplémentaire`
    },
    business: {
      title: 'Vous êtes une entreprise ?',
      subtitle: 'Des solutions sur-mesure pour bureaux, hôtels et propriétaires Airbnb.',
      bullets: [
        'Contrats récurrents avec tarifs préférentiels',
        'Facturation mensuelle simplifiée',
        'Nettoyeurs dédiés et prioritaires'
      ],
      cta: 'Demander un devis'
    },
    eco: {
      title: 'Notre engagement écologique',
      subtitle: "Parce qu'un espace propre ne devrait pas coûter cher à la planète.",
      cards: [
        {
          title: 'Produits certifiés',
          description: 'Tous nos produits éco sont certifiés et biodégradables.'
        },
        {
          title: 'Moins de déchets',
          description: 'Nous utilisons des outils réutilisables et limitons le plastique.'
        },
        {
          title: 'Nettoyeurs formés',
          description: 'Nos nettoyeurs sont formés aux bonnes pratiques environnementales.'
        }
      ]
    },
    faq: {
      title: 'Questions sur nos services',
      items: [
        {
          question: "Qu'est-ce qui est inclus dans chaque service ?",
          answer: "Chaque service a une liste détaillée d'inclusions visible sur sa carte. Vous pouvez aussi ajouter des options supplémentaires lors de la réservation."
        },
        {
          question: 'Combien de temps dure une prestation ?',
          answer: 'La durée dépend de la taille de votre logement et du service choisi. Une estimation est indiquée sur chaque carte de service.'
        },
        {
          question: 'Dois-je être présent pendant le nettoyage ?',
          answer: "Non, vous n'avez pas besoin d'être présent. Vous pouvez laisser les instructions d'accès lors de la réservation."
        },
        {
          question: 'Les nettoyeurs apportent-ils leur matériel ?',
          answer: "Oui, tous les nettoyeurs viennent avec leur propre matériel professionnel. Si vous souhaitez des produits éco-responsables, sélectionnez l'option lors de la réservation."
        },
        {
          question: 'Puis-je modifier ou annuler ma réservation ?',
          answer: 'Oui. Vous pouvez modifier ou annuler gratuitement jusqu’à 24 heures avant votre prestation depuis votre espace personnel.'
        }
      ]
    },
    finalCta: {
      title: 'Quel service vous convient ?',
      subtitle: 'Réservez en quelques minutes ou contactez-nous pour un devis personnalisé.',
      primary: 'Réserver maintenant',
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
        duration: '2h – 4h',
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
        duration: '4h – 8h'
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
        duration: '4h – 6h'
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
        duration: '4h – 10h',
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
        duration: '1h – 3h',
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
      renovation: 'Post-renovación',
      airbnb: 'Airbnb'
    },
    services: {
      home: {
        name: 'Limpieza del hogar',
        description: 'Una limpieza completa de tu hogar, habitación por habitación.',
        includedLabel: 'Qué incluye',
        included: [
          'Aspirado y fregado de suelos',
          'Limpieza de superficies y muebles',
          'Baño y cocina',
          'Vaciado de papeleras'
        ],
        price: 'Desde $25/h',
        duration: '2h – 4h',
        badge: { label: 'Más popular', tone: 'sky' }
      },
      deep: {
        name: 'Limpieza profunda',
        description: 'Una limpieza intensiva para devolver tu hogar a su mejor estado.',
        includedLabel: 'Qué incluye',
        included: [
          'Todo lo de Limpieza del hogar',
          'Interior de armarios',
          'Detrás de electrodomésticos',
          'Juntas y rincones difíciles'
        ],
        price: 'Desde $35/h',
        duration: '4h – 8h'
      },
      office: {
        name: 'Limpieza de oficina',
        description: 'Espacios profesionales limpios y acogedores para tu equipo.',
        includedLabel: 'Qué incluye',
        included: [
          'Escritorios, puestos, salas de reuniones',
          'Cocina y zonas comunes',
          'Baños',
          'Gestión de residuos'
        ],
        price: 'Presupuesto',
        duration: 'Según superficie'
      },
      move: {
        name: 'Limpieza de mudanza',
        description: 'Deja tu hogar impecable antes de entregar las llaves.',
        includedLabel: 'Qué incluye',
        included: [
          'Limpieza completa de todas las habitaciones',
          'Interior de nevera y horno',
          'Ventanas y espejos',
          'Informe de limpieza incluido'
        ],
        price: 'Desde $120',
        duration: '4h – 6h'
      },
      renovation: {
        name: 'Post-renovación',
        description: 'Eliminemos juntos polvo, escombros y residuos de obra.',
        includedLabel: 'Qué incluye',
        included: [
          'Desempolvado y aspirado completo',
          'Limpieza de ventanas y marcos',
          'Eliminación de residuos de pintura',
          'Suelos y superficies tras obras'
        ],
        price: 'Desde $45/h',
        duration: '4h – 10h',
        badge: { label: 'Nuevo', tone: 'coral' }
      },
      airbnb: {
        name: 'Rotación Airbnb',
        description: 'Entre cada huésped, un hogar listo y reluciente.',
        includedLabel: 'Qué incluye',
        included: [
          'Limpieza completa y rápida',
          'Cambio de ropa de cama',
          'Reposición de consumibles',
          'Fotos al final del servicio'
        ],
        price: 'Desde $30',
        duration: '1h – 3h',
        badge: { label: 'Eco-friendly', tone: 'mint' }
      }
    },
    book: 'Reservar',
    pricing: {
      title: '¿Cómo calculamos nuestros precios?',
      blocks: [
        {
          title: 'Tamaño de tu espacio',
          description: 'Cuanto más grande es tu espacio, más tiempo asignamos.'
        },
        {
          title: 'Tipo de servicio elegido',
          description: 'Cada servicio tiene su propio nivel de detalle y duración.'
        },
        {
          title: 'Opciones adicionales',
          description: 'Añade extras según tus necesidades específicas.'
        }
      ]
    },
    addOns: {
      title: 'Añade opciones a tu reserva',
      items: [
        { id: 'fridge', label: 'Limpieza de nevera', price: 15 },
        { id: 'oven', label: 'Limpieza del horno', price: 15 },
        { id: 'windows', label: 'Limpieza de ventanas', price: 20 },
        { id: 'laundry', label: 'Lavandería y planchado', price: 25 },
        { id: 'eco', label: 'Productos ecológicos', price: 10 },
        { id: 'balcony', label: 'Limpieza del balcón', price: 18 }
      ],
      totalLabel: (total) => `Opciones seleccionadas: $${total} adicional`
    },
    business: {
      title: '¿Eres una empresa?',
      subtitle: 'Soluciones a medida para oficinas, hoteles y anfitriones de Airbnb.',
      bullets: [
        'Contratos recurrentes con tarifas preferenciales',
        'Facturación mensual simplificada',
        'Limpiadores dedicados y prioritarios'
      ],
      cta: 'Solicitar presupuesto'
    },
    eco: {
      title: 'Nuestro compromiso ecológico',
      subtitle: 'Porque un espacio limpio no debería costarle nada al planeta.',
      cards: [
        {
          title: 'Productos certificados',
          description: 'Todos nuestros productos eco están certificados y son biodegradables.'
        },
        {
          title: 'Menos residuos',
          description: 'Usamos herramientas reutilizables y minimizamos el plástico.'
        },
        {
          title: 'Limpiadores formados',
          description: 'Nuestros limpiadores están formados en buenas prácticas medioambientales.'
        }
      ]
    },
    faq: {
      title: 'Preguntas sobre nuestros servicios',
      items: [
        {
          question: '¿Qué incluye cada servicio?',
          answer: 'Cada servicio tiene una lista detallada de inclusiones visible en su tarjeta. También puedes añadir opciones extra durante la reserva.'
        },
        {
          question: '¿Cuánto dura una sesión de limpieza?',
          answer: 'La duración depende del tamaño de tu hogar y del servicio elegido. Se muestra una estimación en cada tarjeta de servicio.'
        },
        {
          question: '¿Debo estar en casa durante la limpieza?',
          answer: 'No, no necesitas estar presente. Puedes dejar las instrucciones de acceso durante la reserva.'
        },
        {
          question: '¿Los limpiadores traen su propio equipo?',
          answer: 'Sí, todos los limpiadores vienen con su propio equipo profesional. Si deseas productos ecológicos, selecciona la opción durante la reserva.'
        },
        {
          question: '¿Puedo modificar o cancelar mi reserva?',
          answer: 'Sí. Puedes modificar o cancelar gratis hasta 24 horas antes de tu sesión desde tu panel personal.'
        }
      ]
    },
    finalCta: {
      title: '¿Qué servicio te conviene?',
      subtitle: 'Reserva en pocos minutos o contáctanos para un presupuesto personalizado.',
      primary: 'Reservar ahora',
      secondary: 'Contáctanos'
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
                {city.trim() ? `${filteredServices.length} services • ${city}` : `${filteredServices.length} services`}
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

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  CircleDollarSign,
  CreditCard,
  Home,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Wallet,
  Minus,
  Plus
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { getLocalizedSectionPath, getPathForRoute } from '../i18n/routes';

type Audience = 'client' | 'cleaner';

type StepContent = {
  title: string;
  description: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

type Testimonial = {
  name: string;
  location: string;
  quote: string;
};

type CleanerGender = 'M' | 'F';

const pageContent: Record<
  Language,
  {
    hero: { title: string; tagline: string; cta: string };
    tabs: Record<Audience, string>;
    clientSteps: StepContent[];
    cleanerSteps: StepContent[];
    trustTitle: string;
    trustCards: Array<{ title: string; description: string }>;
    pricingTitle: string;
    pricingCards: Array<{ title: string; description: string }>;
    faqTitle: string;
    faqItems: FAQItem[];
    testimonialsTitle: string;
    clients: Testimonial[];
    cleanerBadge: string;
    cleaner: Testimonial;
    finalCta: { title: string; subtitle: string; primary: string; secondary: string };
  }
> = {
  fr: {
    hero: {
      title: 'Comment ça marche ?',
      tagline:
        "Nettoyó est une marketplace qui vous met en relation avec des nettoyeurs indépendants à Montréal, Laval, Longueuil, sur la Rive-Nord et la Rive-Sud.",
      cta: 'Envoyer une demande'
    },
    tabs: {
      client: 'Je suis un client',
      cleaner: 'Je suis un nettoyeur'
    },
    clientSteps: [
      {
        title: 'Décrivez votre besoin',
        description:
          'Précisez le type de logement, la zone et le service recherché pour recevoir des options pertinentes.'
      },
      {
        title: 'Comparez les nettoyeurs disponibles',
        description:
          'Consultez profils, avis, disponibilités et prix définis par chaque nettoyeur indépendant.'
      },
      {
        title: 'Envoyez votre demande',
        description:
          "Sélectionnez une date puis envoyez une demande de réservation. Le nettoyeur accepte ou refuse selon ses disponibilités."
      },
      {
        title: 'Connectez-vous directement',
        description:
          "Une fois la demande acceptée, vous coordonnez les détails directement avec le nettoyeur. Le paiement du service se fait hors plateforme."
      }
    ],
    cleanerSteps: [
      {
        title: 'Créez votre profil',
        description:
          "Présentez votre expérience, vos services et vos zones d'intervention pour être visible auprès des clients."
      },
      {
        title: 'Définissez vos services',
        description:
          'Fixez vos propres prix, vos disponibilités et les secteurs où vous souhaitez intervenir.'
      },
      {
        title: 'Recevez des demandes',
        description:
          'Les clients vous envoient des demandes de réservation. Vous choisissez uniquement les missions que vous voulez accepter.'
      },
      {
        title: 'Soyez payé directement par vos clients',
        description:
          "Après chaque prestation, vous êtes payé directement par le client selon l'entente convenue entre vous."
      }
    ],
    trustTitle: 'Pourquoi utiliser Nettoyó ?',
    trustCards: [
      {
        title: 'Profils vérifiés',
        description:
          "Les nettoyeurs présents sur la plateforme passent une vérification de profil avant d'être visibles."
      },
      {
        title: 'Transparence des informations',
        description:
          'Disponibilités, zones, prix et avis sont visibles pour vous aider à comparer avant de réserver.'
      },
      {
        title: 'Avis de la communauté',
        description:
          "Les retours d'autres utilisateurs vous aident à choisir un nettoyeur adapté à vos attentes."
      },
      {
        title: 'Matching local et flexible',
        description:
          'Trouvez des nettoyeurs indépendants près de chez vous, avec des horaires et des conditions qui vous conviennent.'
      }
    ],
    pricingTitle: 'Comment fonctionne la tarification',
    pricingCards: [
      {
        title: 'Frais de plateforme',
        description:
          "Nettoyó facture un petit frais de plateforme par réservation (exemple : 5 $) pour l'utilisation du service."
      },
      {
        title: 'Prix du nettoyeur',
        description:
          'Chaque nettoyeur indépendant fixe ses propres tarifs. Les prix peuvent varier selon le profil, la zone et la demande.'
      },
      {
        title: 'Paiement du service',
        description:
          'Le paiement de la prestation est réglé directement entre le client et le nettoyeur, hors plateforme.'
      }
    ],
    faqTitle: 'Questions fréquentes',
    faqItems: [
      {
        question: 'Nettoyó emploie-t-il les nettoyeurs ?',
        answer:
          'Non. Les nettoyeurs sont des professionnels indépendants qui utilisent la marketplace pour trouver des clients.'
      },
      {
        question: 'Qui fixe le prix du service ?',
        answer:
          'Le nettoyeur fixe son propre prix. Vous pouvez comparer plusieurs profils avant d’envoyer votre demande.'
      },
      {
        question: 'Comment se passe le paiement ?',
        answer:
          "Le frais de plateforme est payé dans l'application. Le paiement du service est effectué directement au nettoyeur en dehors de la plateforme."
      },
      {
        question: 'Dans quelles zones puis-je trouver un nettoyeur ?',
        answer:
          'Vous pouvez trouver des nettoyeurs à Montréal, Laval, Longueuil, sur la Rive-Nord et la Rive-Sud selon les disponibilités.'
      },
      {
        question: 'Comment devenir nettoyeur sur Nettoyó ?',
        answer:
          'Créez votre profil, définissez vos services et disponibilités, puis acceptez les demandes qui vous intéressent.'
      }
    ],
    testimonialsTitle: 'Retours de la communauté',
    clients: [
      {
        name: 'Nadia T.',
        location: 'Montréal',
        quote:
          'J’ai pu comparer plusieurs profils avant de réserver. Le fonctionnement est clair et je choisis le nettoyeur qui me convient.'
      },
      {
        name: 'Marc D.',
        location: 'Laval',
        quote:
          'La demande a été acceptée rapidement et la communication directe avec le nettoyeur a simplifié toute l’organisation.'
      },
      {
        name: 'Lina P.',
        location: 'Longueuil',
        quote:
          'Les prix varient selon les profils, ce qui me permet de comparer et de réserver selon mon budget.'
      }
    ],
    cleanerBadge: 'Nettoyeur indépendant',
    cleaner: {
      name: 'Olivier R.',
      location: 'Rive-Sud',
      quote:
        'Je gère mon planning, mes tarifs et les demandes que j’accepte. La plateforme me met en relation avec des clients locaux.'
    },
    finalCta: {
      title: 'Prêt à commencer ?',
      subtitle:
        "Que vous soyez client ou nettoyeur indépendant, Nettoyó facilite la mise en relation locale de façon transparente.",
      primary: 'Créer une demande',
      secondary: 'Créer mon profil nettoyeur'
    }
  },
  en: {
    hero: {
      title: 'How does it work?',
      tagline: 'Simple, fast and reliable — in three steps.',
      cta: 'Book a cleaner'
    },
    tabs: {
      client: 'I am a client',
      cleaner: 'I am a cleaner'
    },
    clientSteps: [
      {
        title: 'Describe your space',
        description: 'Tell us the type of home, the size and your specific needs.'
      },
      {
        title: 'Choose a cleaner',
        description: 'Browse verified profiles, reviews and rates. Pick the one that suits you best.'
      },
      {
        title: 'Book a time slot',
        description: 'Select the date and time that works for you. Instant confirmation.'
      },
      {
        title: 'Enjoy a spotless space',
        description: 'Your cleaner arrives on time. You come home to a perfectly clean space.'
      }
    ],
    cleanerSteps: [
      {
        title: 'Create your profile',
        description: 'Add your skills, experience and a photo. Quick identity verification.'
      },
      {
        title: 'Set your availability',
        description: 'Choose your days, hours and working area. You are in control.'
      },
      {
        title: 'Receive bookings',
        description: 'Clients contact you directly. Accept the jobs that work for you.'
      },
      {
        title: 'Get paid fast',
        description: 'Secure payment after every job. Withdraw your earnings anytime.'
      }
    ],
    trustTitle: 'Why trust Nettoyó?',
    trustCards: [
      {
        title: 'Verified cleaners',
        description: 'Every cleaner goes through identity verification and a background check before being accepted.'
      },
      {
        title: 'Secure payment',
        description: 'Your banking details are protected. You only pay once the job is confirmed.'
      },
      {
        title: 'Satisfaction guaranteed',
        description: 'Not happy? We come back for free within 24 hours or you get a full refund.'
      },
      {
        title: 'Insurance coverage',
        description: 'Every cleaning session is covered by our professional liability insurance.'
      }
    ],
    pricingTitle: 'Simple and transparent pricing',
    pricingCards: [
      {
        title: 'No hidden fees',
        description: 'The price shown is the final price. No bad surprises.'
      },
      {
        title: 'Pay only for what you book',
        description: 'No subscription. No commitment. Pay per job.'
      },
      {
        title: 'Free cancellation',
        description: 'Cancel up to 24 hours before your booking with no charge.'
      }
    ],
    faqTitle: 'Frequently asked questions',
    faqItems: [
      {
        question: 'How are cleaners selected?',
        answer: 'Every cleaner goes through identity verification, a background check and a skills assessment before being accepted on the platform.'
      },
      {
        question: "What happens if I'm not satisfied?",
        answer: 'Contact us within 24 hours of your cleaning. We will arrange a free return visit or issue a full refund.'
      },
      {
        question: 'Can I keep the same cleaner every time?',
        answer: 'Yes. You can mark a cleaner as a favourite and book them directly for your future cleaning sessions.'
      },
      {
        question: 'What cleaning products are used?',
        answer: 'Cleaners bring their own professional equipment. You can also request the use of eco-friendly products.'
      },
      {
        question: 'How do I become a cleaner on Nettoyó?',
        answer: 'Create an account, complete your profile, pass the identity verification and start receiving requests from nearby clients.'
      }
    ],
    testimonialsTitle: 'They love Nettoyó',
    clients: [
      {
        name: 'Marie L.',
        location: 'Paris',
        quote: 'I use Nettoyó every week. My apartment has never been so clean and I have never had the slightest issue.'
      },
      {
        name: 'Thomas B.',
        location: 'Lyon',
        quote: 'Booking in two minutes, punctual and professional cleaner. Exactly what I needed.'
      },
      {
        name: 'Sofia R.',
        location: 'Bordeaux',
        quote: 'The customer service is excellent. I had a small issue once and they resolved everything in under an hour.'
      }
    ],
    cleanerBadge: 'Certified cleaner',
    cleaner: {
      name: 'Karim D.',
      location: 'Marseille',
      quote: 'Since joining Nettoyó, I have a stable income and regular clients. The platform is simple and payments are always on time.'
    },
    finalCta: {
      title: 'Ready to get started?',
      subtitle: 'Join thousands of happy clients — or offer your services starting today.',
      primary: 'Book a cleaner',
      secondary: 'Become a cleaner'
    }
  },
  es: {
    hero: {
      title: '¿Cómo funciona?',
      tagline: 'Simple, rápido y confiable — en tres pasos.',
      cta: 'Reservar un limpiador'
    },
    tabs: {
      client: 'Soy un cliente',
      cleaner: 'Soy un limpiador'
    },
    clientSteps: [
      {
        title: 'Describe tu espacio',
        description: 'Indica el tipo de vivienda, el tamaño y tus necesidades específicas.'
      },
      {
        title: 'Elige un limpiador',
        description: 'Explora perfiles verificados, reseñas y tarifas. Elige el que más te convenga.'
      },
      {
        title: 'Reserva un horario',
        description: 'Selecciona la fecha y hora que te convenga. Confirmación instantánea.'
      },
      {
        title: 'Disfruta de un espacio impecable',
        description: 'Tu limpiador llega a tiempo. Vuelves a un espacio perfectamente limpio.'
      }
    ],
    cleanerSteps: [
      {
        title: 'Crea tu perfil',
        description: 'Añade tus habilidades, experiencia y una foto. Verificación de identidad rápida.'
      },
      {
        title: 'Define tu disponibilidad',
        description: 'Elige tus días, horarios y zona de trabajo. Tú tienes el control.'
      },
      {
        title: 'Recibe reservas',
        description: 'Los clientes te contactan directamente. Acepta los trabajos que te convengan.'
      },
      {
        title: 'Cobra rápido',
        description: 'Pago seguro después de cada trabajo. Retira tus ganancias cuando quieras.'
      }
    ],
    trustTitle: '¿Por qué confiar en Nettoyó?',
    trustCards: [
      {
        title: 'Limpiadores verificados',
        description: 'Cada limpiador pasa una verificación de identidad y un control de antecedentes antes de ser aceptado.'
      },
      {
        title: 'Pago seguro',
        description: 'Tus datos bancarios están protegidos. Solo pagas una vez confirmado el trabajo.'
      },
      {
        title: 'Satisfacción garantizada',
        description: '¿No estás satisfecho? Volvemos gratis en 24 horas o te reembolsamos.'
      },
      {
        title: 'Cobertura de seguro',
        description: 'Cada sesión de limpieza está cubierta por nuestro seguro de responsabilidad profesional.'
      }
    ],
    pricingTitle: 'Precios simples y transparentes',
    pricingCards: [
      {
        title: 'Sin costos ocultos',
        description: 'El precio mostrado es el precio final. Sin sorpresas.'
      },
      {
        title: 'Paga solo lo que reservas',
        description: 'Sin suscripción. Sin compromiso. Paga por trabajo.'
      },
      {
        title: 'Cancelación gratuita',
        description: 'Cancela hasta 24 horas antes de tu reserva sin ningún cargo.'
      }
    ],
    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        question: '¿Cómo se seleccionan los limpiadores?',
        answer: 'Cada limpiador pasa una verificación de identidad, un control de antecedentes y una evaluación de habilidades antes de ser aceptado en la plataforma.'
      },
      {
        question: '¿Qué pasa si no estoy satisfecho?',
        answer: 'Contáctanos dentro de las 24 horas posteriores a tu limpieza. Organizaremos una visita gratuita o te reembolsaremos completamente.'
      },
      {
        question: '¿Puedo tener siempre el mismo limpiador?',
        answer: 'Sí. Puedes marcar un limpiador como favorito y reservarlo directamente para tus próximas sesiones de limpieza.'
      },
      {
        question: '¿Qué productos de limpieza se usan?',
        answer: 'Los limpiadores traen su propio equipo profesional. También puedes solicitar el uso de productos ecológicos.'
      },
      {
        question: '¿Cómo me convierto en limpiador en Nettoyó?',
        answer: 'Crea una cuenta, completa tu perfil, pasa la verificación de identidad y empieza a recibir solicitudes de clientes cercanos.'
      }
    ],
    testimonialsTitle: 'Ellos aman Nettoyó',
    clients: [
      {
        name: 'Marie L.',
        location: 'Paris',
        quote: 'Uso Nettoyó cada semana. Mi apartamento nunca ha estado tan limpio y nunca he tenido el menor problema.'
      },
      {
        name: 'Thomas B.',
        location: 'Lyon',
        quote: 'Reserva en dos minutos, limpiador puntual y profesional. Exactamente lo que necesitaba.'
      },
      {
        name: 'Sofia R.',
        location: 'Bordeaux',
        quote: 'El servicio al cliente es excelente. Tuve un pequeño problema una vez y lo resolvieron todo en menos de una hora.'
      }
    ],
    cleanerBadge: 'Limpiador certificado',
    cleaner: {
      name: 'Karim D.',
      location: 'Marseille',
      quote: 'Desde que me uní a Nettoyó, tengo ingresos estables y clientes regulares. La plataforma es sencilla y los pagos siempre llegan a tiempo.'
    },
    finalCta: {
      title: '¿Listo para empezar?',
      subtitle: 'Únete a miles de clientes satisfechos — o empieza a ofrecer tus servicios hoy.',
      primary: 'Reservar un limpiador',
      secondary: 'Convertirse en limpiador'
    }
  }
};

const clientStepIcons = [MapPinned, UserRound, CalendarDays, Sparkles];
const cleanerStepIcons = [BadgeCheck, CalendarDays, Bell, Wallet];
const trustIcons = [ShieldCheck, CreditCard, CheckCheck, Briefcase];
const pricingIcons = [CircleDollarSign, CreditCard, CalendarDays];

function Stars() {
  return (
    <div className="flex items-center gap-1 text-[#FDB022]">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} size={14} fill="#FDB022" stroke="#FDB022" />
      ))}
    </div>
  );
}

function StepSection({
  accentClass,
  steps,
  icons
}: {
  accentClass: string;
  steps: StepContent[];
  icons: Array<typeof Home>;
}) {
  return (
    <div className="relative mt-10">
      <div className="absolute left-[12%] right-[12%] top-10 hidden border-t border-dashed border-[#D1D5DB] md:block" />
      <div className="grid gap-6 md:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = icons[index];

          return (
            <div
              key={step.title}
              className="relative rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_12px_32px_rgba(17,24,39,0.06)]"
            >
              <div className={`text-4xl font-bold ${accentClass}`}>{index + 1}</div>
              <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7F7F7]">
                <Icon size={24} className="text-[#1A1A2E]" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-[#1A1A2E]">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#6B7280]">{step.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HowItWorksPage() {
  const { language } = useLanguage();
  const content = pageContent[language];
  const [audience, setAudience] = useState<Audience>('client');
  const [openFaq, setOpenFaq] = useState(0);
  const [activeShowcaseIndex, setActiveShowcaseIndex] = useState(0);
  const bookingPath = getPathForRoute(language, 'login');
  const cleanerPath = getLocalizedSectionPath(language, 'become-cleaner');

  const roleLabelByLanguage = useMemo(
    () => ({
      fr: {
        cleaner: { M: 'Nettoyeur indépendant', F: 'Nettoyeuse indépendante' },
        client: { M: 'Client', F: 'Cliente' }
      },
      en: {
        cleaner: { M: 'Independent cleaner', F: 'Independent cleaner' },
        client: { M: 'Client', F: 'Client' }
      },
      es: {
        cleaner: { M: 'Limpiador independiente', F: 'Limpiadora independiente' },
        client: { M: 'Cliente', F: 'Cliente' }
      }
    }),
    []
  );

  const cleanerShowcaseProfiles = useMemo(() => {
    const inferGender = (filePath: string): CleanerGender => {
      const lower = filePath.toLowerCase();
      if (lower.endsWith('/clean.png') || lower === 'clean.png') return 'F';
      return lower.includes('-m') ? 'M' : 'F';
    };

    const quoteByLanguage: Record<
      string,
      Record<Language, string>
    > = {
      alisha: {
        fr: "J’aime que les clients décrivent bien leurs attentes avant la réservation. Les rendez-vous sont plus fluides et l’organisation est simple.",
        en: 'I appreciate when clients describe their needs clearly before booking. It makes each session smoother and easier to plan.',
        es: 'Me gusta cuando los clientes explican bien sus necesidades antes de reservar. Así cada servicio se organiza mejor.'
      },
      beatrice: {
        fr: "J’ai réservé pour un ménage de fin de semaine et tout s’est passé comme prévu. La personne est arrivée à l’heure et la communication était claire.",
        en: 'I booked a weekend cleaning and everything happened exactly as expected. The cleaner arrived on time and communication was clear.',
        es: 'Reservé una limpieza para el fin de semana y todo salió como esperaba. Llegó puntual y la comunicación fue clara.'
      },
      camille: {
        fr: "Je compare les profils en quelques minutes, puis je choisis selon les avis et les disponibilités. Franchement, ça m’enlève une grosse charge mentale.",
        en: 'I can compare profiles in a few minutes and choose based on reviews and availability. It honestly removes a lot of stress.',
        es: 'Puedo comparar perfiles en pocos minutos y elegir según opiniones y disponibilidad. Me quita bastante estrés.'
      },
      marc: {
        fr: "L’application est simple à utiliser et le suivi est propre du début à la fin. Pour moi, c’est surtout le gain de temps qui fait la différence.",
        en: 'The app is simple to use and the process is clean from start to finish. For me, the biggest difference is the time saved.',
        es: 'La app es fácil de usar y el proceso está bien organizado de principio a fin. Para mí, lo mejor es el tiempo que ahorro.'
      },
      noah: {
        fr: "Après deux réservations, je retrouve la même qualité de service. C’est rassurant quand on veut quelque chose de fiable sur la durée.",
        en: 'After two bookings, I got the same level of service each time. It feels reliable when you want consistency over time.',
        es: 'Después de dos reservas, recibí la misma calidad de servicio. Da confianza cuando buscas algo constante.'
      }
    };

    const profiles = [
      { id: 'alisha', imagePath: '/clean.png', name: 'Alisha', location: 'Rive-Sud', role: 'cleaner' as const },
      { id: 'beatrice', imagePath: '/img-F.jpg', name: 'Béatrice', location: 'Laval', role: 'client' as const },
      { id: 'camille', imagePath: '/selfie_1-F.png', name: 'Camille', location: 'Montréal', role: 'client' as const },
      { id: 'marc', imagePath: '/im2-M.png', name: 'Marc', location: 'Longueuil', role: 'client' as const },
      { id: 'noah', imagePath: '/selfie_4-M.png', name: 'Noah', location: 'Montréal-Nord', role: 'client' as const }
    ];

    return profiles.map((profile) => {
      const gender = inferGender(profile.imagePath);
      return {
        ...profile,
        gender,
        quote: quoteByLanguage[profile.id][language]
      };
    });
  }, [language]);

  const showcaseTotal = cleanerShowcaseProfiles.length;

  const goToShowcase = (nextIndex: number) => {
    setActiveShowcaseIndex(((nextIndex % showcaseTotal) + showcaseTotal) % showcaseTotal);
  };

  useEffect(() => {
    if (showcaseTotal <= 1) return;
    const timer = window.setInterval(() => {
      setActiveShowcaseIndex((current) => (current + 1) % showcaseTotal);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [showcaseTotal]);

  return (
    <div className="bg-white">
      <section className="border-b border-[#E5E7EB] bg-[rgba(168,230,207,0.2)]">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-[#1A1A2E] md:text-5xl">{content.hero.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[#6B7280]">{content.hero.tagline}</p>
          <a
            href={bookingPath}
            className="mt-8 inline-flex rounded-lg bg-[#4FC3F7] px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-[#3FAAD4]"
          >
            {content.hero.cta}
          </a>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex justify-center">
            <div className="inline-flex rounded-full border border-[#E5E7EB] bg-white p-1 shadow-sm">
              {(['client', 'cleaner'] as Audience[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAudience(tab)}
                  className={`rounded-full px-5 py-3 text-sm font-semibold transition-all sm:px-6 ${
                    audience === tab
                      ? 'bg-[#4FC3F7] text-white'
                      : 'border border-transparent text-[#6B7280] hover:border-[#E5E7EB] hover:text-[#1A1A2E]'
                  }`}
                >
                  {content.tabs[tab]}
                </button>
              ))}
            </div>
          </div>

          {audience === 'client' ? (
            <StepSection accentClass="text-[#A8E6CF]" steps={content.clientSteps} icons={clientStepIcons} />
          ) : (
            <StepSection accentClass="text-[#4FC3F7]" steps={content.cleanerSteps} icons={cleanerStepIcons} />
          )}
        </div>
      </section>

      <section className="bg-[#F7F7F7] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-[#1A1A2E] md:text-4xl">{content.trustTitle}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {content.trustCards.map((card, index) => {
              const Icon = trustIcons[index];

              return (
                <div
                  key={card.title}
                  className="rounded-2xl bg-white p-7 shadow-[0_12px_32px_rgba(17,24,39,0.06)]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(168,230,207,0.35)]">
                    <Icon size={24} className="text-[#1A1A2E]" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-[#1A1A2E]">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#6B7280]">{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[rgba(79,195,247,0.1)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-[#1A1A2E] md:text-4xl">{content.pricingTitle}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.pricingCards.map((card, index) => {
              const Icon = pricingIcons[index];

              return (
                <div
                  key={card.title}
                  className="rounded-2xl bg-white p-8 text-center shadow-[0_12px_32px_rgba(17,24,39,0.06)]"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7]">
                    <Icon size={28} className="text-[#4FC3F7]" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-[#1A1A2E]">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#6B7280]">{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-[#1A1A2E] md:text-4xl">{content.faqTitle}</h2>
          <div className="mt-10 space-y-4">
            {content.faqItems.map((item, index) => {
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

      <section className="bg-[#F7F7F7] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-[#1A1A2E] md:text-4xl">{content.testimonialsTitle}</h2>
          <div className="relative mt-10 overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_20px_60px_rgba(17,24,39,0.08)] sm:p-5">
            <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[rgba(79,195,247,0.12)]" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-[rgba(168,230,207,0.18)]" />

            <div className="relative overflow-hidden rounded-3xl">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${activeShowcaseIndex * 100}%)` }}
              >
                {cleanerShowcaseProfiles.map((profile) => (
                  <article key={`${profile.imagePath}-${profile.name}`} className="w-full flex-shrink-0 p-2 sm:p-4">
                    <div className="grid gap-5 rounded-3xl border border-[#E9EEF4] bg-white p-4 shadow-[0_12px_32px_rgba(17,24,39,0.06)] md:grid-cols-[0.82fr_1.18fr] md:items-stretch md:p-6">
                      <div className="relative overflow-hidden rounded-3xl border border-[#E6EDF3] bg-[#F3F7FA]">
                        <img
                          src={profile.imagePath}
                          alt={profile.name}
                          className="h-[230px] w-full object-cover object-center sm:h-[260px] md:h-[285px]"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(17,24,39,0.66)] via-[rgba(17,24,39,0.26)] to-transparent p-3.5 sm:p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E5E7EB]">
                            Nettoyó
                          </p>
                          <p className="mt-1 text-xl font-bold text-white">{profile.name}</p>
                          <p className="mt-1 text-xs text-[#E5E7EB] sm:text-sm">{profile.location}</p>
                        </div>
                      </div>

                      <div className="flex min-h-0 h-full flex-col">
                        <div
                          className={`inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold ${
                            profile.role === 'cleaner'
                              ? 'bg-[rgba(79,195,247,0.14)] text-[#0284C7]'
                              : 'bg-[rgba(168,230,207,0.28)] text-[#065F46]'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              profile.role === 'cleaner' ? 'bg-[#4FC3F7]' : 'bg-[#10B981]'
                            }`}
                          />
                          {roleLabelByLanguage[language][profile.role][profile.gender]}
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <Stars />
                          <span className="text-xs font-semibold text-[#6B7280]">5.0</span>
                        </div>
                        <p className="mt-5 text-[15px] font-medium leading-7 text-[#4B5563] sm:text-base">
                          “{profile.quote}”
                        </p>
                        <div className="mt-auto pt-7">
                          <div className="h-px w-full bg-[#EEF2F7]" />
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#94A3B8]">
                            {roleLabelByLanguage[language][profile.role][profile.gender]}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="relative mt-5 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => goToShowcase(activeShowcaseIndex - 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E7F4] bg-white text-[#1A1A2E] shadow-[0_6px_20px_rgba(17,24,39,0.08)] transition-colors hover:border-[#4FC3F7] hover:text-[#0284C7]"
                aria-label="Previous cleaner"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-2">
                {cleanerShowcaseProfiles.map((profile, index) => (
                  <button
                    key={`${profile.name}-dot`}
                    type="button"
                    onClick={() => goToShowcase(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      activeShowcaseIndex === index ? 'w-8 bg-[#4FC3F7]' : 'w-2.5 bg-[#D1D5DB] hover:bg-[#94A3B8]'
                    }`}
                    aria-label={`Go to ${profile.name}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => goToShowcase(activeShowcaseIndex + 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E7F4] bg-white text-[#1A1A2E] shadow-[0_6px_20px_rgba(17,24,39,0.08)] transition-colors hover:border-[#4FC3F7] hover:text-[#0284C7]"
                aria-label="Next cleaner"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-5 gap-2 sm:gap-3">
              {cleanerShowcaseProfiles.map((profile, index) => (
                <button
                  key={`${profile.name}-thumb`}
                  type="button"
                  onClick={() => goToShowcase(index)}
                  className={`overflow-hidden rounded-2xl border transition-all ${
                    activeShowcaseIndex === index
                      ? 'border-[#4FC3F7] shadow-[0_8px_22px_rgba(79,195,247,0.35)]'
                      : 'border-[#E5E7EB] opacity-80 hover:opacity-100'
                  }`}
                >
                  <img src={profile.imagePath} alt={profile.name} className="h-20 w-full object-cover sm:h-24" />
                </button>
              ))}
            </div>
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
              href={cleanerPath}
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


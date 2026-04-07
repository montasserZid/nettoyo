import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bell,
  Briefcase,
  CalendarDays,
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
      tagline: 'Simple, fast and reliable â€” in three steps.',
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
    trustTitle: 'Why trust NettoyÃ³?',
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
        question: 'How do I become a cleaner on NettoyÃ³?',
        answer: 'Create an account, complete your profile, pass the identity verification and start receiving requests from nearby clients.'
      }
    ],
    testimonialsTitle: 'They love NettoyÃ³',
    clients: [
      {
        name: 'Marie L.',
        location: 'Paris',
        quote: 'I use NettoyÃ³ every week. My apartment has never been so clean and I have never had the slightest issue.'
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
      quote: 'Since joining NettoyÃ³, I have a stable income and regular clients. The platform is simple and payments are always on time.'
    },
    finalCta: {
      title: 'Ready to get started?',
      subtitle: 'Join thousands of happy clients â€” or offer your services starting today.',
      primary: 'Book a cleaner',
      secondary: 'Become a cleaner'
    }
  },
  es: {
    hero: {
      title: 'Â¿CÃ³mo funciona?',
      tagline: 'Simple, rÃ¡pido y confiable â€” en tres pasos.',
      cta: 'Reservar un limpiador'
    },
    tabs: {
      client: 'Soy un cliente',
      cleaner: 'Soy un limpiador'
    },
    clientSteps: [
      {
        title: 'Describe tu espacio',
        description: 'Indica el tipo de vivienda, el tamaÃ±o y tus necesidades especÃ­ficas.'
      },
      {
        title: 'Elige un limpiador',
        description: 'Explora perfiles verificados, reseÃ±as y tarifas. Elige el que mÃ¡s te convenga.'
      },
      {
        title: 'Reserva un horario',
        description: 'Selecciona la fecha y hora que te convenga. ConfirmaciÃ³n instantÃ¡nea.'
      },
      {
        title: 'Disfruta de un espacio impecable',
        description: 'Tu limpiador llega a tiempo. Vuelves a un espacio perfectamente limpio.'
      }
    ],
    cleanerSteps: [
      {
        title: 'Crea tu perfil',
        description: 'AÃ±ade tus habilidades, experiencia y una foto. VerificaciÃ³n de identidad rÃ¡pida.'
      },
      {
        title: 'Define tu disponibilidad',
        description: 'Elige tus dÃ­as, horarios y zona de trabajo. TÃº tienes el control.'
      },
      {
        title: 'Recibe reservas',
        description: 'Los clientes te contactan directamente. Acepta los trabajos que te convengan.'
      },
      {
        title: 'Cobra rÃ¡pido',
        description: 'Pago seguro despuÃ©s de cada trabajo. Retira tus ganancias cuando quieras.'
      }
    ],
    trustTitle: 'Â¿Por quÃ© confiar en NettoyÃ³?',
    trustCards: [
      {
        title: 'Limpiadores verificados',
        description: 'Cada limpiador pasa una verificaciÃ³n de identidad y un control de antecedentes antes de ser aceptado.'
      },
      {
        title: 'Pago seguro',
        description: 'Tus datos bancarios estÃ¡n protegidos. Solo pagas una vez confirmado el trabajo.'
      },
      {
        title: 'SatisfacciÃ³n garantizada',
        description: 'Â¿No estÃ¡s satisfecho? Volvemos gratis en 24 horas o te reembolsamos.'
      },
      {
        title: 'Cobertura de seguro',
        description: 'Cada sesiÃ³n de limpieza estÃ¡ cubierta por nuestro seguro de responsabilidad profesional.'
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
        description: 'Sin suscripciÃ³n. Sin compromiso. Paga por trabajo.'
      },
      {
        title: 'CancelaciÃ³n gratuita',
        description: 'Cancela hasta 24 horas antes de tu reserva sin ningÃºn cargo.'
      }
    ],
    faqTitle: 'Preguntas frecuentes',
    faqItems: [
      {
        question: 'Â¿CÃ³mo se seleccionan los limpiadores?',
        answer: 'Cada limpiador pasa una verificaciÃ³n de identidad, un control de antecedentes y una evaluaciÃ³n de habilidades antes de ser aceptado en la plataforma.'
      },
      {
        question: 'Â¿QuÃ© pasa si no estoy satisfecho?',
        answer: 'ContÃ¡ctanos dentro de las 24 horas posteriores a tu limpieza. Organizaremos una visita gratuita o te reembolsaremos completamente.'
      },
      {
        question: 'Â¿Puedo tener siempre el mismo limpiador?',
        answer: 'SÃ­. Puedes marcar un limpiador como favorito y reservarlo directamente para tus prÃ³ximas sesiones de limpieza.'
      },
      {
        question: 'Â¿QuÃ© productos de limpieza se usan?',
        answer: 'Los limpiadores traen su propio equipo profesional. TambiÃ©n puedes solicitar el uso de productos ecolÃ³gicos.'
      },
      {
        question: 'Â¿CÃ³mo me convierto en limpiador en NettoyÃ³?',
        answer: 'Crea una cuenta, completa tu perfil, pasa la verificaciÃ³n de identidad y empieza a recibir solicitudes de clientes cercanos.'
      }
    ],
    testimonialsTitle: 'Ellos aman NettoyÃ³',
    clients: [
      {
        name: 'Marie L.',
        location: 'Paris',
        quote: 'Uso NettoyÃ³ cada semana. Mi apartamento nunca ha estado tan limpio y nunca he tenido el menor problema.'
      },
      {
        name: 'Thomas B.',
        location: 'Lyon',
        quote: 'Reserva en dos minutos, limpiador puntual y profesional. Exactamente lo que necesitaba.'
      },
      {
        name: 'Sofia R.',
        location: 'Bordeaux',
        quote: 'El servicio al cliente es excelente. Tuve un pequeÃ±o problema una vez y lo resolvieron todo en menos de una hora.'
      }
    ],
    cleanerBadge: 'Limpiador certificado',
    cleaner: {
      name: 'Karim D.',
      location: 'Marseille',
      quote: 'Desde que me unÃ­ a NettoyÃ³, tengo ingresos estables y clientes regulares. La plataforma es sencilla y los pagos siempre llegan a tiempo.'
    },
    finalCta: {
      title: 'Â¿Listo para empezar?',
      subtitle: 'Ãšnete a miles de clientes satisfechos â€” o empieza a ofrecer tus servicios hoy.',
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
  const bookingPath = getPathForRoute(language, 'login');
  const cleanerPath = getLocalizedSectionPath(language, 'become-cleaner');

  const testimonialAvatars = useMemo(
    () => [
      'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200',
      'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200',
      'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200',
      'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200'
    ],
    []
  );

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
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.clients.map((testimonial, index) => (
              <div
                key={testimonial.name}
                className="rounded-2xl bg-white p-6 shadow-[0_12px_32px_rgba(17,24,39,0.06)]"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={testimonialAvatars[index]}
                    alt={testimonial.name}
                    className="block h-14 w-14 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-bold text-[#1A1A2E]">{testimonial.name}</div>
                    <div className="text-sm text-[#6B7280]">{testimonial.location}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Stars />
                </div>
                <p className="mt-4 text-sm italic leading-6 text-[#6B7280]">"{testimonial.quote}"</p>
              </div>
            ))}

            <div className="rounded-2xl border-l-4 border-[#A8E6CF] bg-white p-7 shadow-[0_12px_32px_rgba(17,24,39,0.06)] md:col-span-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src={testimonialAvatars[3]}
                    alt={content.cleaner.name}
                    className="block h-14 w-14 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-bold text-[#1A1A2E]">{content.cleaner.name}</div>
                    <div className="text-sm text-[#6B7280]">{content.cleaner.location}</div>
                  </div>
                </div>
                <span className="inline-flex w-fit rounded-full bg-[rgba(168,230,207,0.35)] px-4 py-2 text-sm font-semibold text-[#1A1A2E]">
                  {content.cleanerBadge}
                </span>
              </div>
              <p className="mt-5 text-sm italic leading-7 text-[#6B7280]">"{content.cleaner.quote}"</p>
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

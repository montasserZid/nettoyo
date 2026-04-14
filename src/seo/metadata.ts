import type { Language } from '../i18n/translations';

export type PublicSeoRoute = 'home' | 'howItWorks' | 'services' | 'login' | 'signup';

export interface SeoMetaEntry {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}

type SeoMetaByLocale = Record<Language, SeoMetaEntry>;

export const SEO_META: Record<PublicSeoRoute, SeoMetaByLocale> = {
  home: {
    fr: {
      title: 'Nettoyó — Réservez un nettoyage à Montréal, Laval, Longueuil',
      description:
        'Trouvez un nettoyeur indépendant certifié près de chez vous à Montréal, Laval ou Longueuil. Réservez en ligne en quelques minutes.',
      canonical: 'https://nettoyo.ca/fr',
      ogTitle: 'Nettoyó — Réservez un nettoyage à Montréal, Laval, Longueuil',
      ogDescription:
        'Trouvez un nettoyeur indépendant certifié près de chez vous à Montréal, Laval ou Longueuil. Réservez en ligne en quelques minutes.',
      ogImage: '/og-default.jpg'
    },
    en: {
      title: 'Nettoyó — Book a Cleaner in Montréal, Laval & Longueuil',
      description:
        'Find trusted independent cleaners near you in Montréal, Laval, Longueuil, Rive-Nord and Rive-Sud. Book online in minutes.',
      canonical: 'https://nettoyo.ca/en',
      ogTitle: 'Nettoyó — Book a Cleaner in Montréal, Laval & Longueuil',
      ogDescription:
        'Find trusted independent cleaners near you in Montréal, Laval, Longueuil, Rive-Nord and Rive-Sud. Book online in minutes.',
      ogImage: '/og-default.jpg'
    },
    es: {
      title: 'Nettoyó — Reserva un limpiador en Montréal, Laval y Longueuil',
      description:
        'Encuentra limpiadores independientes de confianza en Montréal, Laval, Longueuil. Reserva en línea en minutos.',
      canonical: 'https://nettoyo.ca/es',
      ogTitle: 'Nettoyó — Reserva un limpiador en Montréal, Laval y Longueuil',
      ogDescription:
        'Encuentra limpiadores independientes de confianza en Montréal, Laval, Longueuil. Reserva en línea en minutos.',
      ogImage: '/og-default.jpg'
    }
  },
  howItWorks: {
    fr: {
      title: 'Comment ça marche — Nettoyó',
      description:
        'Découvrez comment réserver un nettoyage en 3 étapes simples sur Nettoyó. Tarifs transparents, nettoyeurs vérifiés, disponibilités en temps réel.',
      canonical: 'https://nettoyo.ca/fr/comment-ca-marche',
      ogTitle: 'Comment ça marche — Nettoyó',
      ogDescription:
        'Découvrez comment réserver un nettoyage en 3 étapes simples sur Nettoyó. Tarifs transparents, nettoyeurs vérifiés, disponibilités en temps réel.',
      ogImage: '/og-default.jpg'
    },
    en: {
      title: 'How It Works — Nettoyó',
      description:
        'Learn how to book a cleaning in 3 simple steps on Nettoyó. Transparent pricing, verified cleaners, real-time availability.',
      canonical: 'https://nettoyo.ca/en/how-it-works',
      ogTitle: 'How It Works — Nettoyó',
      ogDescription:
        'Learn how to book a cleaning in 3 simple steps on Nettoyó. Transparent pricing, verified cleaners, real-time availability.',
      ogImage: '/og-default.jpg'
    },
    es: {
      title: 'Cómo funciona — Nettoyó',
      description:
        'Aprende a reservar una limpieza en 3 pasos simples en Nettoyó. Precios transparentes, limpiadores verificados, disponibilidad en tiempo real.',
      canonical: 'https://nettoyo.ca/es/como-funciona',
      ogTitle: 'Cómo funciona — Nettoyó',
      ogDescription:
        'Aprende a reservar una limpieza en 3 pasos simples en Nettoyó. Precios transparentes, limpiadores verificados, disponibilidad en tiempo real.',
      ogImage: '/og-default.jpg'
    }
  },
  services: {
    fr: {
      title: 'Trouver un nettoyeur — Services de nettoyage à Montréal | Nettoyó',
      description:
        'Comparez les nettoyeurs indépendants disponibles à Montréal, Laval et Longueuil. Nettoyage domicile, profond, bureau, déménagement, Airbnb.',
      canonical: 'https://nettoyo.ca/fr/services',
      ogTitle: 'Trouver un nettoyeur — Services de nettoyage à Montréal | Nettoyó',
      ogDescription:
        'Comparez les nettoyeurs indépendants disponibles à Montréal, Laval et Longueuil. Nettoyage domicile, profond, bureau, déménagement, Airbnb.',
      ogImage: '/og-default.jpg'
    },
    en: {
      title: 'Find a Cleaner — Cleaning Services in Montréal | Nettoyó',
      description:
        'Compare available independent cleaners in Montréal, Laval and Longueuil. Home, deep cleaning, office, moving, Airbnb services.',
      canonical: 'https://nettoyo.ca/en/services',
      ogTitle: 'Find a Cleaner — Cleaning Services in Montréal | Nettoyó',
      ogDescription:
        'Compare available independent cleaners in Montréal, Laval and Longueuil. Home, deep cleaning, office, moving, Airbnb services.',
      ogImage: '/og-default.jpg'
    },
    es: {
      title: 'Encuentra un limpiador — Servicios de limpieza en Montréal | Nettoyó',
      description:
        'Compara limpiadores independientes disponibles en Montréal, Laval y Longueuil. Limpieza de hogar, profunda, oficina, mudanza, Airbnb.',
      canonical: 'https://nettoyo.ca/es/servicios',
      ogTitle: 'Encuentra un limpiador — Servicios de limpieza en Montréal | Nettoyó',
      ogDescription:
        'Compara limpiadores independientes disponibles en Montréal, Laval y Longueuil. Limpieza de hogar, profunda, oficina, mudanza, Airbnb.',
      ogImage: '/og-default.jpg'
    }
  },
  login: {
    fr: {
      title: 'Connexion — Nettoyó',
      description: 'Connectez-vous à votre compte Nettoyó pour gérer vos réservations et votre profil.',
      canonical: 'https://nettoyo.ca/fr/connexion',
      ogTitle: 'Connexion — Nettoyó',
      ogDescription: 'Connectez-vous à votre compte Nettoyó pour gérer vos réservations et votre profil.',
      ogImage: '/og-default.jpg'
    },
    en: {
      title: 'Login — Nettoyó',
      description: 'Log in to your Nettoyó account to manage bookings and profile details.',
      canonical: 'https://nettoyo.ca/en/login',
      ogTitle: 'Login — Nettoyó',
      ogDescription: 'Log in to your Nettoyó account to manage bookings and profile details.',
      ogImage: '/og-default.jpg'
    },
    es: {
      title: 'Iniciar sesión — Nettoyó',
      description: 'Inicia sesión en tu cuenta de Nettoyó para gestionar reservas y tu perfil.',
      canonical: 'https://nettoyo.ca/es/iniciar-sesion',
      ogTitle: 'Iniciar sesión — Nettoyó',
      ogDescription: 'Inicia sesión en tu cuenta de Nettoyó para gestionar reservas y tu perfil.',
      ogImage: '/og-default.jpg'
    }
  },
  signup: {
    fr: {
      title: 'Inscription — Nettoyó',
      description: 'Créez votre compte Nettoyó pour réserver un nettoyeur ou proposer vos services.',
      canonical: 'https://nettoyo.ca/fr/inscription',
      ogTitle: 'Inscription — Nettoyó',
      ogDescription: 'Créez votre compte Nettoyó pour réserver un nettoyeur ou proposer vos services.',
      ogImage: '/og-default.jpg'
    },
    en: {
      title: 'Sign Up — Nettoyó',
      description: 'Create your Nettoyó account to book a cleaner or offer your services.',
      canonical: 'https://nettoyo.ca/en/signup',
      ogTitle: 'Sign Up — Nettoyó',
      ogDescription: 'Create your Nettoyó account to book a cleaner or offer your services.',
      ogImage: '/og-default.jpg'
    },
    es: {
      title: 'Registro — Nettoyó',
      description: 'Crea tu cuenta de Nettoyó para reservar limpieza u ofrecer tus servicios.',
      canonical: 'https://nettoyo.ca/es/registro',
      ogTitle: 'Registro — Nettoyó',
      ogDescription: 'Crea tu cuenta de Nettoyó para reservar limpieza u ofrecer tus servicios.',
      ogImage: '/og-default.jpg'
    }
  }
};

export function getSeoMeta(route: PublicSeoRoute, language: Language): SeoMetaEntry {
  return SEO_META[route][language];
}

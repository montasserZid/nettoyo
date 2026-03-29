import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { getLocalizedSectionPath, getPathForRoute } from '../i18n/routes';
import { NettoyoLogo } from './NettoyoLogo';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, setLanguage, route, navigateTo, t } = useLanguage();

  const flags: Record<Language, string> = {
    fr: '🇫🇷',
    en: '🇬🇧',
    es: '🇪🇸'
  };

  const howItWorksPath = getPathForRoute(language, 'howItWorks');
  const servicesPath = getPathForRoute(language, 'services');
  const loginPath = getPathForRoute(language, 'login');
  const cleanerPath = getLocalizedSectionPath(language, 'become-cleaner');
  const howItWorksClass =
    route === 'howItWorks'
      ? 'text-[#4FC3F7] font-semibold'
      : 'text-[#1A1A2E] font-medium hover:text-[#4FC3F7] transition-colors';
  const servicesClass =
    route === 'services'
      ? 'text-[#4FC3F7] font-semibold'
      : 'text-[#1A1A2E] font-medium hover:text-[#4FC3F7] transition-colors';

  return (
    <nav className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <a href="/" className="flex items-center overflow-visible py-2">
            <NettoyoLogo className="h-14" />
          </a>

          <div className="hidden items-center space-x-8 md:flex">
            <a
              href={howItWorksPath}
              onClick={(event) => {
                event.preventDefault();
                navigateTo('howItWorks');
              }}
              className={howItWorksClass}
            >
              {t.nav.howItWorks}
            </a>
            <a
              href={servicesPath}
              onClick={(event) => {
                event.preventDefault();
                navigateTo('services');
              }}
              className={servicesClass}
            >
              {t.nav.services}
            </a>
            <a href={cleanerPath} className="font-medium text-[#1A1A2E] transition-colors hover:text-[#4FC3F7]">
              {t.nav.becomeCleaner}
            </a>
          </div>

          <div className="hidden items-center space-x-4 md:flex">
            <div className="mr-2 flex items-center space-x-2">
              {(Object.keys(flags) as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`text-2xl transition-all ${
                    language === lang ? 'scale-110 border-b-2 border-[#A8E6CF]' : 'opacity-60 hover:opacity-100'
                  }`}
                  aria-label={lang}
                >
                  {flags[lang]}
                </button>
              ))}
            </div>

            <a
              href={loginPath}
              onClick={(event) => {
                event.preventDefault();
                navigateTo('login');
              }}
              className="px-4 py-2 font-medium text-[#1A1A2E] transition-colors hover:text-[#4FC3F7]"
            >
              {t.nav.login}
            </a>

            <a
              href={loginPath}
              onClick={(event) => {
                event.preventDefault();
                navigateTo('login');
              }}
              className="rounded-full bg-[#4FC3F7] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#3FAAD4]"
            >
              {t.nav.bookNow}
            </a>
          </div>

          <button className="text-[#1A1A2E] md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-[#E5E7EB] bg-white md:hidden">
          <div className="space-y-4 px-4 py-4">
            <a
              href={howItWorksPath}
              onClick={(event) => {
                event.preventDefault();
                setMobileMenuOpen(false);
                navigateTo('howItWorks');
              }}
              className={`block ${route === 'howItWorks' ? 'font-semibold text-[#4FC3F7]' : 'font-medium text-[#1A1A2E]'}`}
            >
              {t.nav.howItWorks}
            </a>
            <a
              href={servicesPath}
              onClick={(event) => {
                event.preventDefault();
                setMobileMenuOpen(false);
                navigateTo('services');
              }}
              className={`block ${route === 'services' ? 'font-semibold text-[#4FC3F7]' : 'font-medium text-[#1A1A2E]'}`}
            >
              {t.nav.services}
            </a>
            <a href={cleanerPath} className="block font-medium text-[#1A1A2E]">
              {t.nav.becomeCleaner}
            </a>

            <div className="flex items-center space-x-3 border-t border-[#E5E7EB] pt-2">
              {(Object.keys(flags) as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`text-2xl transition-all ${
                    language === lang ? 'scale-110 border-b-2 border-[#A8E6CF]' : 'opacity-60'
                  }`}
                >
                  {flags[lang]}
                </button>
              ))}
            </div>

            <a
              href={loginPath}
              onClick={(event) => {
                event.preventDefault();
                setMobileMenuOpen(false);
                navigateTo('login');
              }}
              className="block w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-center font-medium text-[#1A1A2E]"
            >
              {t.nav.login}
            </a>

            <a
              href={loginPath}
              onClick={(event) => {
                event.preventDefault();
                setMobileMenuOpen(false);
                navigateTo('login');
              }}
              className="block w-full rounded-full bg-[#4FC3F7] px-6 py-3 text-center font-semibold text-white"
            >
              {t.nav.bookNow}
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

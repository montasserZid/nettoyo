import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { getLocalizedSectionPath, getPathForRoute } from '../i18n/routes';
import { NettoyoLogo } from './NettoyoLogo';

export function Footer() {
  const { language, setLanguage, route, navigateTo, t } = useLanguage();

  const flags: Record<Language, string> = {
    fr: '🇫🇷',
    en: '🇬🇧',
    es: '🇪🇸'
  };

  const howItWorksPath = getPathForRoute(language, 'howItWorks');
  const servicesPath = getPathForRoute(language, 'services');
  const cleanerPath = getLocalizedSectionPath(language, 'become-cleaner');

  return (
    <footer className="border-t border-[#E5E7EB] bg-white py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-4 overflow-visible">
            <a href="/" className="flex items-center overflow-visible py-1">
              <NettoyoLogo className="h-11" />
            </a>
            <span className="text-sm text-[#6B7280]">{t.footer.copyright}</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
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

            <div className="hidden items-center gap-6 md:flex">
              <a
                href={howItWorksPath}
                onClick={(event) => {
                  event.preventDefault();
                  navigateTo('howItWorks');
                }}
                className={`text-sm transition-colors ${
                  route === 'howItWorks' ? 'font-semibold text-[#4FC3F7]' : 'text-[#6B7280] hover:text-[#4FC3F7]'
                }`}
              >
                {t.nav.howItWorks}
              </a>
              <a
                href={servicesPath}
                onClick={(event) => {
                  event.preventDefault();
                  navigateTo('services');
                }}
                className={`text-sm transition-colors ${
                  route === 'services' ? 'font-semibold text-[#4FC3F7]' : 'text-[#6B7280] hover:text-[#4FC3F7]'
                }`}
              >
                {t.nav.services}
              </a>
              <a href={cleanerPath} className="text-sm text-[#6B7280] transition-colors hover:text-[#4FC3F7]">
                {t.nav.becomeCleaner}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

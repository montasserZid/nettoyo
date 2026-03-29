import { Star } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { getPathForRoute } from '../i18n/routes';

export function Hero() {
  const { language, t } = useLanguage();
  const loginPath = getPathForRoute(language, 'login');

  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-0">
          <div className="px-6 py-16 md:py-24 lg:px-12 flex flex-col justify-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#1A1A2E] leading-tight mb-6">
              {t.hero.headline}
            </h1>

            <p className="text-lg text-[#6B7280] mb-8 leading-relaxed">
              {t.hero.subheadline}
            </p>

            <a
              href={loginPath}
              className="inline-flex bg-[#4FC3F7] text-white font-bold text-lg px-8 py-4 rounded-lg hover:bg-[#3FAAD4] transition-colors w-full md:w-auto justify-center"
            >
              {t.hero.cta}
            </a>

            <div className="flex items-center gap-2 mt-6 text-sm text-[#6B7280]">
              <Star size={16} fill="#FDB022" stroke="#FDB022" />
              <span>{t.hero.trustBar}</span>
            </div>
          </div>

          <div className="relative h-64 md:h-full min-h-[400px]">
            <img
              src="https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt="Clean modern living room"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

import { Home, Sparkles, Briefcase, Package, Hammer, Key } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export function ServicePills() {
  const { t } = useLanguage();

  const services = [
    { icon: Home, label: t.services.homeCleaning },
    { icon: Sparkles, label: t.services.deepClean },
    { icon: Briefcase, label: t.services.office },
    { icon: Package, label: t.services.moveOut },
    { icon: Hammer, label: t.services.postRenovation },
    { icon: Key, label: t.services.airbnb }
  ];

  return (
    <section className="bg-white py-8 border-b border-[#E5E7EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <button
                key={index}
                className="flex items-center gap-2 px-5 py-3 bg-white border border-[#E5E7EB] rounded-full hover:shadow-md hover:-translate-y-0.5 transition-all whitespace-nowrap flex-shrink-0"
              >
                <Icon size={18} className="text-[#4FC3F7]" />
                <span className="text-sm font-medium text-[#1A1A2E]">{service.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

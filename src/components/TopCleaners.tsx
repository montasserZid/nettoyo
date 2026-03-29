import { Star } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export function TopCleaners() {
  const { t } = useLanguage();

  const cleaners = [
    {
      name: 'Sarah M.',
      rating: 4.9,
      price: 30,
      image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200',
      skills: ['Housekeeping', 'Eco-Friendly'],
      available: true
    },
    {
      name: 'Jessica R.',
      rating: 5.0,
      price: 32,
      image: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200',
      skills: ['Deep Cleaning', 'Organising'],
      available: true
    },
    {
      name: 'Megan T.',
      rating: 4.8,
      price: 28,
      image: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200',
      skills: ['Office Cleaning', 'Pet Friendly'],
      available: true
    }
  ];

  return (
    <section className="bg-[#F7F7F7] py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-[#1A1A2E] mb-10">
          {t.cleaners.title}
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {cleaners.map((cleaner, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <img
                  src={cleaner.image}
                  alt={cleaner.name}
                  className="w-16 h-16 rounded-full object-cover"
                />

                <div className="flex-1">
                  <h3 className="font-bold text-[#1A1A2E] text-lg">{cleaner.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Star size={16} fill="#FDB022" stroke="#FDB022" />
                    <span className="text-[#FDB022] font-semibold">{cleaner.rating}</span>
                    <span className="text-[#6B7280] font-semibold">
                      ${cleaner.price}{t.cleaners.perHour}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {cleaner.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-xs text-[#6B7280] bg-[#F7F7F7] px-3 py-1 rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {cleaner.available && (
                <span className="inline-block bg-[#A8E6CF] text-[#059669] text-sm font-semibold px-4 py-2 rounded-full">
                  {t.cleaners.availableNow}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

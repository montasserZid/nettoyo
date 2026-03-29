import { Hero } from '../components/Hero';
import { ServicePills } from '../components/ServicePills';
import { TopCleaners } from '../components/TopCleaners';

export function HomePage() {
  return (
    <>
      <Hero />
      <div id="services">
        <ServicePills />
      </div>
      <div id="become-cleaner">
        <TopCleaners />
      </div>
    </>
  );
}

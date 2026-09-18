import { ServiceCard } from './ServiceCard';

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  price: number | null;
}

interface ServicesSectionProps {
  services: Service[];
  orgSlug: string;
}

export function ServicesSection({ services, orgSlug }: ServicesSectionProps) {
  if (services.length === 0) {
    return null;
  }

  // Layout logic based on number of services
  const getGridClasses = () => {
    if (services.length === 1) {
      return 'flex justify-center';
    }
    if (services.length === 2) {
      return 'grid gap-8 md:grid-cols-2 lg:max-w-4xl';
    }
    // 3+ services: horizontal stack
    return 'flex flex-wrap justify-center gap-8';
  };

  const getCardClasses = () => {
    if (services.length === 1) {
      return 'w-full max-w-md';
    }
    if (services.length === 2) {
      return '';
    }
    // 3+ services: fixed width cards
    return 'w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.5rem)]';
  };

  return (
    <section id="services" className="scroll-mt-16 bg-white py-20 md:py-28 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            Our Services
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600 md:text-xl">
            Discover what we can do for you
          </p>
        </div>

        <div className={`mx-auto max-w-7xl ${getGridClasses()}`}>
          {services.map((service) => (
            <div key={service.id} className={getCardClasses()}>
              <ServiceCard service={service} orgSlug={orgSlug} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

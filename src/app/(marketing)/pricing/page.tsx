import { type Metadata } from 'next';
import { getMarketingLocale } from '@/lib/i18n/marketing-locale';
import PricingPlans from './components/PricingPlans';
import PricingComparison from './components/PricingComparison';
import PricingFAQ from './components/PricingFAQ';
import PricingHeader from './components/PricingHeader';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getMarketingLocale();

  const title = locale === 'ru' ? 'Простые и понятные цены' : 'Simple, transparent pricing';
  const description = locale === 'ru' ? 'Начните бесплатно, перейдите на Pro когда вырастете' : 'Start free, upgrade when you grow';

  return {
    title,
    description,
  };
}

export default async function PricingPage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <PricingHeader />

      {/* Pricing Plans */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <PricingPlans />
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <PricingComparison />
        </div>
      </section>

      {/* Pricing FAQ */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <PricingFAQ />
        </div>
      </section>
    </main>
  );
}

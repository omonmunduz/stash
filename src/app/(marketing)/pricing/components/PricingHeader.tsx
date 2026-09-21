'use client';

import { useTranslations } from 'next-intl';

export default function PricingHeader() {
  const t = useTranslations('marketing.pricing');

  return (
    <section className="bg-gradient-to-b from-blue-50 to-white py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h1>
          <p className="text-xl text-gray-600">
            {t('subtitle')}
          </p>
        </div>
      </div>
    </section>
  );
}

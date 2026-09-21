'use client';

import { useTranslations } from 'next-intl';

const FAQ_ITEMS = ['q1', 'q2', 'q3', 'q4'] as const;

export default function PricingFAQ() {
  const t = useTranslations('marketing.pricing.faq');

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
        {t('title')}
      </h2>

      <div className="space-y-6">
        {FAQ_ITEMS.map((item) => (
          <div
            key={item}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t(item)}
            </h3>
            <p className="text-gray-600 leading-relaxed">
              {t(`${item.replace('q', 'a')}`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

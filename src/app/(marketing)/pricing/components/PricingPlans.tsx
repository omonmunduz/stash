'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { MARKETING_CONFIG, CURRENCY_SYMBOLS } from '@/config/marketing';

export default function PricingPlans() {
  const t = useTranslations('marketing.pricing');
  const locale = useLocale() as 'en' | 'ru';

  const currencySymbol = CURRENCY_SYMBOLS[MARKETING_CONFIG.pricing.currency];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 gap-8">
        {MARKETING_CONFIG.pricing.plans.map((plan) => {
          const isPro = plan.id === 'pro';

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-8 ${
                isPro
                  ? 'border-blue-600 shadow-xl'
                  : 'border-gray-200'
              }`}
            >
              {isPro && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    {t('popular')}
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name[locale]}
                </h3>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-5xl font-bold text-gray-900">
                    {plan.price === 0 ? '0' : `${plan.price.toLocaleString()}`}
                  </span>
                  <span className="text-xl text-gray-600">{currencySymbol}</span>
                </div>
                {plan.interval && (
                  <p className="text-gray-600">{plan.interval[locale]}</p>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature[locale]}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`block w-full py-3 px-6 rounded-lg text-center font-medium transition-colors ${
                  isPro
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {plan.price === 0 ? t('startFree') : t('getStarted')}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import FAQItem from './FAQItem';

const FAQ_ITEMS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'] as const;

export default function FAQList() {
  const t = useTranslations('marketing.faq');
  const locale = useLocale();

  // Build JSON-LD for FAQPage schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: t(`${item}.question`),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(`${item}.answer`),
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h1>
          <p className="text-xl text-gray-600">
            {t('subtitle')}
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <FAQItem
              key={item}
              question={t(`${item}.question`)}
              answer={t(`${item}.answer`)}
            />
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center p-8 bg-blue-50 rounded-xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {locale === 'ru' ? 'Не нашли ответ?' : "Can't find your answer?"}
          </h2>
          <p className="text-gray-600 mb-4">
            {locale === 'ru'
              ? 'Свяжитесь с нами, и мы будем рады помочь.'
              : "Get in touch and we'll be happy to help."}
          </p>
          <a
            href="/contact"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            {locale === 'ru' ? 'Связаться с нами' : 'Contact us'}
          </a>
        </div>
      </div>
    </>
  );
}

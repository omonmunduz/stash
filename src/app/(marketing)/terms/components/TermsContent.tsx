'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';

export default function TermsContent() {
  const t = useTranslations('marketing.terms');
  const locale = useLocale();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          {t('title')}
        </h1>
        <p className="text-gray-600">
          {t('lastUpdated')}: {new Date().toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Placeholder Content */}
      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
            <span className="text-yellow-900 font-bold">!</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {locale === 'ru' ? 'В разработке' : 'Under Development'}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t('placeholder')}
            </p>
            <p className="text-gray-600 mt-4">
              {locale === 'ru'
                ? 'Полные условия использования будут опубликованы перед запуском продукта. Они будут включать права и обязанности пользователей, условия подписки, ограничения ответственности и другие юридические положения.'
                : 'Complete terms of service will be published before product launch. They will include user rights and obligations, subscription terms, liability limitations, and other legal provisions.'}
            </p>
          </div>
        </div>
      </div>

      {/* TODO List */}
      <div className="mt-8 bg-white border border-gray-200 rounded-xl p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {locale === 'ru' ? 'Что будет включено:' : 'What will be included:'}
        </h3>
        <ul className="space-y-2 text-gray-700">
          <li>• {locale === 'ru' ? 'Принятие условий' : 'Acceptance of terms'}</li>
          <li>• {locale === 'ru' ? 'Учётные записи и доступ' : 'Accounts and access'}</li>
          <li>• {locale === 'ru' ? 'Использование сервиса' : 'Use of service'}</li>
          <li>• {locale === 'ru' ? 'Условия подписки и оплаты' : 'Subscription and payment terms'}</li>
          <li>• {locale === 'ru' ? 'Права интеллектуальной собственности' : 'Intellectual property rights'}</li>
          <li>• {locale === 'ru' ? 'Ограничения и запреты' : 'Limitations and prohibitions'}</li>
          <li>• {locale === 'ru' ? 'Отказ от гарантий' : 'Disclaimers'}</li>
          <li>• {locale === 'ru' ? 'Ограничение ответственности' : 'Limitation of liability'}</li>
          <li>• {locale === 'ru' ? 'Прекращение доступа' : 'Termination'}</li>
          <li>• {locale === 'ru' ? 'Изменения условий' : 'Changes to terms'}</li>
        </ul>
      </div>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';

export default function PrivacyContent() {
  const t = useTranslations('marketing.privacy');
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
                ? 'Полная политика конфиденциальности будет опубликована перед запуском продукта. Она будет включать информацию о сборе данных, использовании, хранении и правах пользователей в соответствии с применимым законодательством.'
                : 'A complete privacy policy will be published before product launch. It will include information about data collection, usage, storage, and user rights in accordance with applicable law.'}
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
          <li>• {locale === 'ru' ? 'Какие данные мы собираем' : 'What data we collect'}</li>
          <li>• {locale === 'ru' ? 'Как мы используем ваши данные' : 'How we use your data'}</li>
          <li>• {locale === 'ru' ? 'Как мы храним и защищаем данные' : 'How we store and protect data'}</li>
          <li>• {locale === 'ru' ? 'Ваши права на конфиденциальность' : 'Your privacy rights'}</li>
          <li>• {locale === 'ru' ? 'Использование файлов cookie' : 'Cookie usage'}</li>
          <li>• {locale === 'ru' ? 'Обмен данными с третьими сторонами' : 'Third-party data sharing'}</li>
          <li>• {locale === 'ru' ? 'Контактная информация' : 'Contact information'}</li>
        </ul>
      </div>
    </div>
  );
}

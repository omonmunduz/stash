'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { MARKETING_CONFIG } from '@/config/marketing';
import { Mail, MessageCircle, Phone } from 'lucide-react';

export default function ContactContent() {
  const t = useTranslations('marketing.contact');
  const locale = useLocale();

  const contactMethods = [
    MARKETING_CONFIG.contact.email && {
      icon: Mail,
      label: t('email'),
      value: MARKETING_CONFIG.contact.email,
      href: `mailto:${MARKETING_CONFIG.contact.email}`,
    },
    {
      icon: MessageCircle,
      label: t('telegram'),
      value: MARKETING_CONFIG.contact.telegram,
      href: `https://t.me/${MARKETING_CONFIG.contact.telegram.replace('@', '')}`,
    },
    {
      icon: Phone,
      label: t('whatsapp'),
      value: MARKETING_CONFIG.contact.whatsapp,
      href: `https://wa.me/${MARKETING_CONFIG.contact.whatsapp.replace(/[^0-9]/g, '')}`,
    },
  ].filter(Boolean);

  return (
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

      {/* Contact Methods */}
      <div className="grid gap-6 sm:grid-cols-3">
        {contactMethods.map((method) => {
          const Icon = method.icon;
          return (
            <a
              key={method.label}
              href={method.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-8 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-600 hover:shadow-lg transition-all"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {method.label}
              </h3>
              <p className="text-sm text-gray-600 text-center">
                {method.value}
              </p>
            </a>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="mt-12 p-8 bg-blue-50 rounded-xl text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {locale === 'ru' ? 'Время работы' : 'Business hours'}
        </h2>
        <p className="text-gray-600">
          {locale === 'ru'
            ? 'Понедельник – Пятница: 9:00 – 18:00 (GMT+6)'
            : 'Monday – Friday: 9:00 AM – 6:00 PM (GMT+6)'}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          {locale === 'ru'
            ? 'Мы отвечаем на сообщения в течение 24 часов.'
            : 'We respond to messages within 24 hours.'}
        </p>
      </div>
    </div>
  );
}

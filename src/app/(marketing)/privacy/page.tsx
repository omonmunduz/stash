import { type Metadata } from 'next';
import { getMarketingLocale } from '@/lib/i18n/marketing-locale';
import PrivacyContent from './components/PrivacyContent';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getMarketingLocale();

  const title = locale === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy';
  const description = locale === 'ru' ? 'Заглушка для правового контента — требуется проверка перед запуском' : 'Legal content placeholder - requires review before launch';

  return {
    title,
    description,
  };
}

export default async function PrivacyPage() {
  return (
    <main className="min-h-screen py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <PrivacyContent />
      </div>
    </main>
  );
}

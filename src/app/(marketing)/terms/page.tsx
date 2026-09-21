import { type Metadata } from 'next';
import { getMarketingLocale } from '@/lib/i18n/marketing-locale';
import TermsContent from './components/TermsContent';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getMarketingLocale();

  const title = locale === 'ru' ? 'Условия использования' : 'Terms of Service';
  const description = locale === 'ru' ? 'Заглушка для правового контента — требуется проверка перед запуском' : 'Legal content placeholder - requires review before launch';

  return {
    title,
    description,
  };
}

export default async function TermsPage() {
  return (
    <main className="min-h-screen py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <TermsContent />
      </div>
    </main>
  );
}

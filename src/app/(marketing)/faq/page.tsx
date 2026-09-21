import { type Metadata } from 'next';
import { getMarketingLocale } from '@/lib/i18n/marketing-locale';
import FAQList from './components/FAQList';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getMarketingLocale();

  const title = locale === 'ru' ? 'Часто задаваемые вопросы' : 'Frequently asked questions';
  const description = locale === 'ru' ? 'Всё, что нужно знать о Stash' : 'Everything you need to know about Stash';

  return {
    title,
    description,
  };
}

export default async function FAQPage() {
  return (
    <main className="min-h-screen py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <FAQList />
      </div>
    </main>
  );
}

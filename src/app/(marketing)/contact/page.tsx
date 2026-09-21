import { type Metadata } from 'next';
import { getMarketingLocale } from '@/lib/i18n/marketing-locale';
import ContactContent from './components/ContactContent';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getMarketingLocale();

  const title = locale === 'ru' ? 'Свяжитесь с нами' : 'Get in touch';
  const description = locale === 'ru' ? 'Есть вопросы? Мы здесь, чтобы помочь.' : "Have questions? We're here to help.";

  return {
    title,
    description,
  };
}

export default async function ContactPage() {
  return (
    <main className="min-h-screen py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <ContactContent />
      </div>
    </main>
  );
}

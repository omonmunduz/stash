/**
 * MARKETING HOME PAGE
 *
 * Main landing page for the CRM.
 * Sections: Hero, Problem/Solution, Features, Public Page Demo, How It Works, Who For, CTA
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getMarketingLocale } from '@/lib/i18n/marketing-locale';
import { MARKETING_CONFIG } from '@/config/marketing';
import { HeroSection } from './components/HeroSection';
import { ProblemSolutionSection } from './components/ProblemSolutionSection';
import { FeaturesSection } from './components/FeaturesSection';
import { PublicPageSection } from './components/PublicPageSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { WhoForSection } from './components/WhoForSection';
import { CTASection } from './components/CTASection';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getMarketingLocale();
  const title = MARKETING_CONFIG.seo.defaultTitle[locale];
  const description = MARKETING_CONFIG.seo.defaultDescription[locale];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: locale === 'ru' ? 'ru_RU' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function MarketingHomePage() {
  return (
    <>
      <HeroSection />
      <ProblemSolutionSection />
      <FeaturesSection />
      <PublicPageSection />
      <HowItWorksSection />
      <WhoForSection />
      <CTASection />
    </>
  );
}

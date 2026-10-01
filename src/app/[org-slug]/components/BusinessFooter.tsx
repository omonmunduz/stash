'use client';

import { useTranslations } from 'next-intl';

interface BusinessFooterProps {
  orgName: string;
}

export function BusinessFooter({ orgName }: BusinessFooterProps) {
  const t = useTranslations('landing.footer');
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-salon-border bg-salon-cream py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-salon-text-muted">
        <p>
          {t('copyright', { year: currentYear, orgName })}
        </p>
      </div>
    </footer>
  );
}

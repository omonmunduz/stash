'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MARKETING_CONFIG } from '@/config/marketing';

export function MarketingFooter() {
  const t = useTranslations('marketing.footer');
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { href: '/product', label: 'Product' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/faq', label: 'FAQ' },
    ],
    company: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
    legal: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  };

  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-xl font-bold">
              {MARKETING_CONFIG.productName}
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              {MARKETING_CONFIG.tagline.en}
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">{t('product')}</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">{t('company')}</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold">{t('legal')}</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-8">
          <p className="text-center text-sm text-muted-foreground">
            {t('copyright', { year: currentYear })}
          </p>
        </div>
      </div>
    </footer>
  );
}

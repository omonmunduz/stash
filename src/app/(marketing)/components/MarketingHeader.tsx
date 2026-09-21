'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useState } from 'react';
import { Menu, X, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MARKETING_CONFIG } from '@/config/marketing';

export function MarketingHeader() {
  const t = useTranslations('marketing.nav');
  const locale = useLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const toggleLanguage = (newLang: 'en' | 'ru') => {
    // Add ?lang= to current URL to switch language
    const url = new URL(window.location.href);
    url.searchParams.set('lang', newLang);
    window.location.href = url.toString();
  };

  const navLinks = [
    { href: '/#features', label: t('features') },
    { href: '/#how-it-works', label: t('howItWorks') },
    { href: '/pricing', label: t('pricing') },
    { href: '/faq', label: t('faq') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold">{MARKETING_CONFIG.productName}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center space-x-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center space-x-4 md:flex">
          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center space-x-1 text-sm text-muted-foreground hover:text-foreground"
              aria-label="Change language"
            >
              <Globe className="h-4 w-4" />
              <span className="uppercase">{locale}</span>
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-24 rounded-md border bg-background shadow-lg">
                <button
                  onClick={() => toggleLanguage('ru')}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                >
                  Русский
                </button>
                <button
                  onClick={() => toggleLanguage('en')}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-accent"
                >
                  English
                </button>
              </div>
            )}
          </div>

          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {t('login')}
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">{t('signup')}</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t bg-background md:hidden">
          <nav className="container mx-auto flex flex-col space-y-4 px-4 py-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center space-x-2 border-t pt-4">
              <button
                onClick={() => toggleLanguage(locale === 'ru' ? 'en' : 'ru')}
                className="flex items-center space-x-1 text-sm"
              >
                <Globe className="h-4 w-4" />
                <span>{locale === 'ru' ? 'English' : 'Русский'}</span>
              </button>
            </div>
            <div className="flex flex-col space-y-2 border-t pt-4">
              <Link href="/login" className="text-sm font-medium">
                {t('login')}
              </Link>
              <Button asChild>
                <Link href="/signup">{t('signup')}</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

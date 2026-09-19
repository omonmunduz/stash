'use client';

import { useLocale } from 'next-intl';

/**
 * Debug component to show current locale
 * Remove after debugging
 */
export function LocaleDebug() {
  const locale = useLocale();

  return (
    <div className="fixed bottom-4 left-4 z-50 rounded bg-black/80 px-3 py-2 text-xs text-white">
      Current locale: <strong>{locale}</strong>
    </div>
  );
}

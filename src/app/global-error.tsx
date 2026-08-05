'use client';

/**
 * ROOT ERROR BOUNDARY — the last resort.
 *
 * Catches what (dashboard)/error.tsx cannot: a throw in the root layout itself,
 * or in a route group with no error.tsx of its own — (auth) and (onboarding).
 * Without this file, those failures render Next's built-in error page, which
 * carries none of the app's branding and offers no way back.
 *
 * This replaces the root layout rather than nesting inside it, which has two
 * consequences worth stating, because both look like mistakes otherwise:
 *
 * 1. It must supply its own <html> and <body>. React has no document to attach to
 *    at this point.
 * 2. Everything is inline-styled. globals.css and the Inter font are loaded by
 *    the layout this file is standing in for, so Tailwind classes cannot be
 *    relied on here — a boundary that renders unstyled in the one situation it
 *    exists for would be worse than no boundary. The colours are the light-theme
 *    literals from globals.css; a hardcoded light theme is the safe default when
 *    the theme system itself may be what failed.
 *
 * A full page reload rather than reset(): if the root layout is what threw,
 * re-rendering the same tree throws again.
 */

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Root error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          backgroundColor: '#ffffff',
          color: '#0a0a0a',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <main style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>

          <p
            style={{
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: '#737373',
              margin: '0 0 1.5rem',
            }}
          >
            Stash hit an unexpected problem and could not finish loading.
            {error.digest ? ` Reference ${error.digest}.` : ''}
          </p>

          {/* A link, not a button with onClick: this must work even if hydration
              is what failed, and an anchor navigates without JavaScript. */}
          <a
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              backgroundColor: '#171717',
              color: '#fafafa',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Reload Stash
          </a>
        </main>
      </body>
    </html>
  );
}

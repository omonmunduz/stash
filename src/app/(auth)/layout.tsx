/**
 * Layout for public auth pages (login, signup, password reset).
 *
 * Centered single-column shell, no sidebar or nav — nothing here should hint at
 * app chrome to someone who isn't signed in.
 *
 * No session lookup: these pages are reachable without one, and resolving a
 * session here would add a round trip to every visit to /login.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      {/* max-w-md keeps forms readable on desktop; w-full lets them fill a phone. */}
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

/**
 * BOOKING URL REDIRECTS
 *
 * Permanent redirects from old booking URLs to new structure.
 * Old: /book/[org-slug] and /book/[org-slug]/[employee-slug]
 * New: /[org-slug]/book with ?employee= query param
 *
 * This ensures existing QR codes and shared links continue to work.
 */

import { redirect, permanentRedirect } from 'next/navigation';

interface RedirectPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ employee?: string }>;
}

export default async function BookingRedirect({ params, searchParams }: RedirectPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  // Redirect to new URL structure
  const queryString = search.employee ? `?employee=${search.employee}` : '';
  permanentRedirect(`/${slug}/book${queryString}`);
}

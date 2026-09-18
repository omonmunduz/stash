/**
 * PUBLIC ORG LANDING PAGE
 *
 * Route: /[org-slug]
 * Public-facing page showing organization info, services, and products.
 * No login required - publicly accessible.
 */

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/shared/EmptyState';
import { Store } from 'lucide-react';
import type { OrganizationId } from '@/lib/types/common';
import { BusinessHeader } from './components/BusinessHeader';
import { BusinessHero } from './components/BusinessHero';
import { ServicesSection } from './components/ServicesSection';
import { ProductsSection } from './components/ProductsSection';
import { BookingCTA } from './components/BookingCTA';
import { BusinessFooter } from './components/BusinessFooter';

interface OrgLandingPageProps {
  params: Promise<{ 'org-slug': string }>;
}

export default async function OrgLandingPage({ params }: OrgLandingPageProps) {
  const { 'org-slug': slug } = await params;
  const supabase = await createClient();

  // Load organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, description, logo_url, hero_image_url')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (orgError || !org) {
    notFound();
  }

  const organizationId = org.id as OrganizationId;

  // Load visible services
  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('visible_on_landing_page', true)
    .is('deleted_at', null)
    .order('name');

  // Load visible products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, sale_price, unit_of_measure')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('visible_on_landing_page', true)
    .is('deleted_at', null)
    .order('name');

  const hasServices = (services?.length ?? 0) > 0;
  const hasProducts = (products?.length ?? 0) > 0;
  const hasBooking = hasServices;
  const hasContent = hasServices || hasProducts;

  // Empty state when no content
  if (!hasContent) {
    return (
      <div className="min-h-screen bg-background">
        <BusinessHeader
          orgName={org.name}
          orgSlug={slug}
          logoUrl={org.logo_url}
          hasServices={false}
          hasProducts={false}
          hasBooking={false}
        />
        <div className="container mx-auto px-4 py-24">
          <EmptyState
            title="Coming soon"
            description="This business is setting up their page. Check back soon!"
            icon={<Store className="size-6" aria-hidden="true" />}
          />
        </div>
        <BusinessFooter orgName={org.name} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <BusinessHeader
        orgName={org.name}
        orgSlug={slug}
        logoUrl={org.logo_url}
        hasServices={hasServices}
        hasProducts={hasProducts}
        hasBooking={hasBooking}
      />

      <BusinessHero
        orgName={org.name}
        description={org.description}
        heroImageUrl={org.hero_image_url}
        hasServices={hasServices}
        hasProducts={hasProducts}
        orgSlug={slug}
      />

      <ServicesSection services={services || []} orgSlug={slug} />

      <ProductsSection products={products || []} orgSlug={slug} />

      {hasBooking && <BookingCTA orgName={org.name} orgSlug={slug} />}

      <BusinessFooter orgName={org.name} />
    </div>
  );
}

export async function generateMetadata({ params }: OrgLandingPageProps) {
  const { 'org-slug': slug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();

  return {
    title: org ? org.name : 'Business',
    description: org ? `Visit ${org.name}` : 'Business page',
  };
}

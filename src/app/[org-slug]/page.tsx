/**
 * PUBLIC ORG LANDING PAGE
 *
 * Route: /[org-slug]
 * Public-facing page showing organization info, services, and products.
 * No login required - publicly accessible.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Store, Calendar, Package } from 'lucide-react';
import type { OrganizationId } from '@/lib/types/common';

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

  const hasContent = (services && services.length > 0) || (products && products.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      {org.hero_image_url && (
        <div className="relative h-64 w-full overflow-hidden bg-muted">
          <img
            src={org.hero_image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-start gap-6">
          {org.logo_url && (
            <div className="shrink-0">
              <img
                src={org.logo_url}
                alt={`${org.name} logo`}
                className="h-24 w-24 rounded-lg object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-4xl font-bold tracking-tight">{org.name}</h1>
            {org.description && (
              <p className="mt-2 text-lg text-muted-foreground">{org.description}</p>
            )}
          </div>
        </div>

        {/* Content */}
        {!hasContent ? (
          <div className="mt-12">
            <EmptyState
              title="Coming soon"
              description="This business is setting up their page. Check back soon!"
              icon={<Store className="size-6" aria-hidden="true" />}
            />
          </div>
        ) : (
          <div className="mt-12 space-y-12">
            {/* Services Section */}
            {services && services.length > 0 && (
              <section>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Services</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Book an appointment for any of our services
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/${slug}/book`}>
                      <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                      Book Now
                    </Link>
                  </Button>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((service) => (
                    <Link
                      key={service.id}
                      href={`/${slug}/book?service=${service.id}`}
                      className="group block rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary"
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold group-hover:text-primary">
                          {service.name}
                        </h3>
                        <Badge variant="secondary">{service.duration_minutes} min</Badge>
                      </div>
                      {service.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {service.description}
                        </p>
                      )}
                      <p className="mt-4 text-lg font-semibold">
                        ${service.price.toFixed(2)}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Products Section */}
            {products && products.length > 0 && (
              <section>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">Products</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Browse our product catalog
                  </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="rounded-lg border border-border bg-card p-6"
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold">{product.name}</h3>
                        <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                      {product.description && (
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                          {product.description}
                        </p>
                      )}
                      <div className="mt-4 flex items-baseline justify-between">
                        <p className="text-lg font-semibold">
                          ${product.sale_price.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          per {product.unit_of_measure}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
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

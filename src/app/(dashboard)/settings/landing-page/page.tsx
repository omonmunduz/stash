/**
 * LANDING PAGE EDITOR
 *
 * Owner-only page to manage the public-facing org landing page.
 * Controls: description, hero image, logo, service visibility, product visibility.
 */

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LandingPageEditor } from '@/features/organizations/components/LandingPageEditor';
import { requireMinimumRole } from '@/features/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getServiceService } from '@/features/services/server';
import type { OrganizationId, ProductId } from '@/lib/types/common';

export const metadata = {
  title: 'Landing Page Editor',
};

export default async function LandingPageEditorPage() {
  const user = await requireMinimumRole('owner');
  const supabase = await createClient();

  // Load organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, description, logo_url, hero_image_url')
    .eq('id', user.organizationId)
    .single();

  if (orgError || !org) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <Alert variant="destructive">
          <AlertDescription>Failed to load organization data</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Load services
  const { service: serviceService } = await getServiceService();
  const servicesResult = await serviceService.list();

  // Load products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, visible_on_landing_page, is_active')
    .eq('organization_id', user.organizationId as OrganizationId)
    .is('deleted_at', null)
    .order('name')
    .returns<Array<{
      id: ProductId;
      name: string;
      visible_on_landing_page: boolean | null;
      is_active: boolean | null;
    }>>();

  const landingPageUrl = `/${org.slug}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Landing Page"
        description="Manage your public-facing landing page content and visibility"
        action={
          <Button asChild variant="outline">
            <Link href={landingPageUrl} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              Preview Page
            </Link>
          </Button>
        }
      />

      {!servicesResult.success ? (
        <Alert variant="destructive">
          <AlertDescription>{servicesResult.error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert>
            <AlertDescription>
              Your landing page is live at:{' '}
              <Link
                href={landingPageUrl}
                target="_blank"
                className="font-medium underline"
              >
                {typeof window !== 'undefined' ? window.location.origin : ''}
                {landingPageUrl}
              </Link>
            </AlertDescription>
          </Alert>

          <LandingPageEditor
            organization={{
              id: org.id as OrganizationId,
              name: org.name,
              slug: org.slug,
              description: org.description,
              logo_url: org.logo_url,
              hero_image_url: org.hero_image_url,
            }}
            services={servicesResult.data}
            products={products ?? []}
          />
        </>
      )}
    </div>
  );
}

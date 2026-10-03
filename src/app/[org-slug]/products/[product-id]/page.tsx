/**
 * PRODUCT DETAILS PAGE
 *
 * Route: /[org-slug]/products/[product-id]
 * Public-facing product detail page showing full product information.
 * No login required - publicly accessible.
 */

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getSignedUrl } from '@/lib/supabase/storage';
import { BusinessHeader } from '../../components/BusinessHeader';
import { BusinessFooter } from '../../components/BusinessFooter';
import { ProductDetails } from './components/ProductDetails';
import type { OrganizationId, ProductId } from '@/lib/types/common';

interface ProductPageProps {
  params: Promise<{ 'org-slug': string; 'product-id': string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { 'org-slug': slug, 'product-id': productId } = await params;
  const supabase = await createClient();

  // Load organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, slug, logo_url')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (orgError || !org) {
    notFound();
  }

  const organizationId = org.id as OrganizationId;

  // Load product
  const { data: product, error: productError } = await supabase
    .from('products')
    .select(`
      id,
      name,
      description,
      sale_price,
      unit_of_measure,
      category,
      image_url
    `)
    .eq('id', productId as ProductId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (productError || !product) {
    notFound();
  }

  // Get signed URLs for images
  let logoSignedUrl: string | null = null;
  let productImageUrl: string | null = null;

  if (org.logo_url) {
    const logoResult = await getSignedUrl('organization-images', org.logo_url);
    if (logoResult.success) {
      logoSignedUrl = logoResult.data.signedUrl;
    }
  }

  if (product.image_url) {
    const imageResult = await getSignedUrl('product-images', product.image_url);
    if (imageResult.success) {
      productImageUrl = imageResult.data.signedUrl;
    }
  }

  return (
    <div className="min-h-screen bg-salon-cream">
      <BusinessHeader
        orgName={org.name}
        orgSlug={slug}
        logoUrl={logoSignedUrl}
        hasServices={false}
        hasProducts={true}
        hasBooking={false}
      />

      <ProductDetails
        product={{
          ...product,
          imageSignedUrl: productImageUrl,
        }}
        orgSlug={slug}
        orgName={org.name}
      />

      <BusinessFooter orgName={org.name} />
    </div>
  );
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { 'org-slug': slug, 'product-id': productId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('name, default_locale')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();

  const { data: product } = await supabase
    .from('products')
    .select('name, description')
    .eq('id', productId as ProductId)
    .is('deleted_at', null)
    .maybeSingle();

  return {
    title: product ? `${product.name} - ${org?.name}` : org?.name || 'Product',
    description: product?.description || `View ${product?.name}`,
    other: {
      'html:lang': org?.default_locale || 'en',
    },
  };
}

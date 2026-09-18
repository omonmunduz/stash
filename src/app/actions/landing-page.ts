/**
 * LANDING PAGE ACTIONS
 *
 * Server actions for managing the public org landing page.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireMinimumRole } from '@/features/auth/guards';
import type { OrganizationId } from '@/lib/types/common';
import type { ServiceId } from '@/features/services/types';
import type { ProductId } from '@/lib/types/common';
import { ROUTES } from '@/lib/constants/routes';
import {
  uploadFile,
  generateOrgImagePath,
} from '@/lib/supabase/storage';

type ActionResult = { success: false; error: string } | { success: true };

export interface LandingPageFormValues {
  description: string;
  logo_url: string;
  hero_image_url: string;
  logo_file?: File | null;
  hero_image_file?: File | null;
}

export async function updateLandingPageAction(
  organizationId: OrganizationId,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireMinimumRole('owner');

  // Verify user owns this organization
  if (user.organizationId !== organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = await createClient();

  // Extract values from FormData
  const description = formData.get('description') as string;
  const logoUrl = formData.get('logo_url') as string;
  const heroImageUrl = formData.get('hero_image_url') as string;
  const logoFile = formData.get('logo_file') as File | null;
  const heroImageFile = formData.get('hero_image_file') as File | null;

  // Handle logo upload
  let finalLogoUrl = logoUrl.trim() || null;
  if (logoFile && logoFile.size > 0) {
    const logoPath = generateOrgImagePath(
      organizationId,
      'logo',
      logoFile
    );

    const uploadResult = await uploadFile(
      'organization-images',
      logoPath,
      logoFile,
      { upsert: true, contentType: logoFile.type }
    );

    if (uploadResult.success) {
      finalLogoUrl = logoPath;
    } else {
      return { success: false, error: 'Failed to upload logo' };
    }
  }

  // Handle hero image upload
  let finalHeroImageUrl = heroImageUrl.trim() || null;
  if (heroImageFile && heroImageFile.size > 0) {
    const heroPath = generateOrgImagePath(
      organizationId,
      'hero',
      heroImageFile
    );

    const uploadResult = await uploadFile(
      'organization-images',
      heroPath,
      heroImageFile,
      { upsert: true, contentType: heroImageFile.type }
    );

    if (uploadResult.success) {
      finalHeroImageUrl = heroPath;
    } else {
      return { success: false, error: 'Failed to upload hero image' };
    }
  }

  const { error } = await supabase
    .from('organizations')
    .update({
      description: description.trim() || null,
      logo_url: finalLogoUrl,
      hero_image_url: finalHeroImageUrl,
    })
    .eq('id', organizationId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Get org slug for revalidation
  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', organizationId)
    .single();

  if (org) {
    revalidatePath(`/${org.slug}`);
  }
  revalidatePath(ROUTES.settings.landingPage);

  return { success: true };
}

export async function toggleServiceVisibilityAction(
  serviceId: ServiceId,
  visible: boolean
): Promise<ActionResult> {
  await requireMinimumRole('owner');
  const supabase = await createClient();

  const { error } = await supabase
    .from('services')
    .update({ visible_on_landing_page: visible })
    .eq('id', serviceId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Revalidate landing page and editor
  revalidatePath(ROUTES.settings.landingPage);

  return { success: true };
}

export async function toggleProductVisibilityAction(
  productId: ProductId,
  visible: boolean
): Promise<ActionResult> {
  await requireMinimumRole('owner');
  const supabase = await createClient();

  const { error } = await supabase
    .from('products')
    .update({ visible_on_landing_page: visible })
    .eq('id', productId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Revalidate landing page and editor
  revalidatePath(ROUTES.settings.landingPage);

  return { success: true };
}

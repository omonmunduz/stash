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

type ActionResult = { success: false; error: string } | { success: true };

export interface LandingPageFormValues {
  description: string;
  logo_url: string;
  hero_image_url: string;
}

export async function updateLandingPageAction(
  organizationId: OrganizationId,
  values: LandingPageFormValues
): Promise<ActionResult> {
  const user = await requireMinimumRole('owner');

  // Verify user owns this organization
  if (user.organizationId !== organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('organizations')
    .update({
      description: values.description.trim() || null,
      logo_url: values.logo_url.trim() || null,
      hero_image_url: values.hero_image_url.trim() || null,
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

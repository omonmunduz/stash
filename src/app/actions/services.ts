/**
 * SERVICE ACTIONS
 *
 * Server Actions for service create/update with image upload support.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServiceService } from '@/features/services/server';
import { requireRole } from '@/features/auth/guards';
import { uploadFile, generateServiceImagePath } from '@/lib/supabase/storage';
import type { ServiceId } from '@/features/services/types';
import type { EmployeeId } from '@/features/employees/types';
import { ROUTES } from '@/lib/constants/routes';

export interface ServiceFormValues {
  name: string;
  description: string;
  duration_minutes: string;
  price: string;
  image_url?: string;
  provider_employee_ids: string[];
  is_active: boolean;
}

type ActionResult = { success: false; error: string } | never;

export async function createServiceAction(formData: FormData): Promise<ActionResult> {
  const { service, user } = await getServiceService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  // Extract form fields
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const durationStr = formData.get('duration_minutes') as string;
  const priceStr = formData.get('price') as string;
  const providerIdsJson = formData.get('provider_employee_ids') as string;
  const imageFile = formData.get('image') as File | null;

  const duration = parseInt(durationStr, 10);
  const price = parseFloat(priceStr);

  if (isNaN(duration) || duration <= 0) {
    return { success: false, error: 'Duration must be a positive number' };
  }

  if (isNaN(price) || price < 0) {
    return { success: false, error: 'Price must be a valid number' };
  }

  const providerIds = providerIdsJson ? JSON.parse(providerIdsJson) : [];

  // Create service first
  const result = await service.create({
    name: name.trim(),
    description: description.trim() || undefined,
    duration_minutes: duration,
    price,
    provider_employee_ids: providerIds as EmployeeId[],
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const createdService = result.data;

  // Upload image if provided
  if (imageFile && imageFile.size > 0) {
    const imagePath = generateServiceImagePath(user.organizationId, createdService.id, imageFile);
    const uploadResult = await uploadFile('service-images', imagePath, imageFile, {
      upsert: true,
      contentType: imageFile.type,
    });

    // Update service with image path (non-blocking - service created successfully)
    if (uploadResult.success) {
      await service.update(createdService.id, {
        image_url: imagePath,
      });
    }
  }

  revalidatePath(ROUTES.services.list);
  redirect(ROUTES.services.list);
}

export async function updateServiceAction(
  id: ServiceId,
  formData: FormData
): Promise<ActionResult> {
  const { service, user } = await getServiceService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  // Extract form fields
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const durationStr = formData.get('duration_minutes') as string;
  const priceStr = formData.get('price') as string;
  const isActiveStr = formData.get('is_active') as string;
  const providerIdsJson = formData.get('provider_employee_ids') as string;
  const imageFile = formData.get('image') as File | null;

  const duration = parseInt(durationStr, 10);
  const price = parseFloat(priceStr);
  const isActive = isActiveStr === 'true';

  if (isNaN(duration) || duration <= 0) {
    return { success: false, error: 'Duration must be a positive number' };
  }

  if (isNaN(price) || price < 0) {
    return { success: false, error: 'Price must be a valid number' };
  }

  const providerIds = providerIdsJson ? JSON.parse(providerIdsJson) : [];

  // Upload image if provided
  let imagePath: string | undefined;
  if (imageFile && imageFile.size > 0) {
    imagePath = generateServiceImagePath(user.organizationId, id, imageFile);
    const uploadResult = await uploadFile('service-images', imagePath, imageFile, {
      upsert: true,
      contentType: imageFile.type,
    });

    if (!uploadResult.success) {
      imagePath = undefined; // Don't update if upload failed
    }
  }

  const result = await service.update(id, {
    name: name.trim() || undefined,
    description: description.trim() || undefined,
    duration_minutes: duration,
    price,
    image_url: imagePath,
    is_active: isActive,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Update providers separately
  const providersResult = await service.setProviders(
    id,
    providerIds as EmployeeId[]
  );

  if (!providersResult.success) {
    return { success: false, error: providersResult.error };
  }

  revalidatePath(ROUTES.services.list);
  revalidatePath(ROUTES.services.edit(id));
  redirect(ROUTES.services.list);
}

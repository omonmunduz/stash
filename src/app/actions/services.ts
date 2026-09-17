/**
 * SERVICE ACTIONS
 *
 * Server Actions for service create/update.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServiceService } from '@/features/services/server';
import type { ServiceId } from '@/features/services/types';
import type { EmployeeId } from '@/features/employees/types';
import { ROUTES } from '@/lib/constants/routes';

export interface ServiceFormValues {
  name: string;
  description: string;
  duration_minutes: string;
  price: string;
  provider_employee_ids: string[];
  is_active: boolean;
}

type ActionResult = { success: false; error: string } | never;

export async function createServiceAction(values: ServiceFormValues): Promise<ActionResult> {
  const { service } = await getServiceService();

  const duration = parseInt(values.duration_minutes, 10);
  const price = parseFloat(values.price);

  if (isNaN(duration) || duration <= 0) {
    return { success: false, error: 'Duration must be a positive number' };
  }

  if (isNaN(price) || price < 0) {
    return { success: false, error: 'Price must be a valid number' };
  }

  const result = await service.create({
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    duration_minutes: duration,
    price,
    provider_employee_ids: values.provider_employee_ids as EmployeeId[],
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(ROUTES.services.list);
  redirect(ROUTES.services.list);
}

export async function updateServiceAction(
  id: ServiceId,
  values: ServiceFormValues
): Promise<ActionResult> {
  const { service } = await getServiceService();

  const duration = parseInt(values.duration_minutes, 10);
  const price = parseFloat(values.price);

  if (isNaN(duration) || duration <= 0) {
    return { success: false, error: 'Duration must be a positive number' };
  }

  if (isNaN(price) || price < 0) {
    return { success: false, error: 'Price must be a valid number' };
  }

  const result = await service.update(id, {
    name: values.name.trim() || undefined,
    description: values.description.trim() || undefined,
    duration_minutes: duration,
    price,
    is_active: values.is_active,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Update providers separately
  const providersResult = await service.setProviders(
    id,
    values.provider_employee_ids as EmployeeId[]
  );

  if (!providersResult.success) {
    return { success: false, error: providersResult.error };
  }

  revalidatePath(ROUTES.services.list);
  revalidatePath(ROUTES.services.edit(id));
  redirect(ROUTES.services.list);
}

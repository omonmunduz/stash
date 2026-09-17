/**
 * EMPLOYEE ACTIONS
 *
 * Server Actions for employee create/update.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getEmployeeService } from '@/features/employees/server';
import type { EmployeeId } from '@/features/employees/types';
import { ROUTES } from '@/lib/constants/routes';

export interface EmployeeFormValues {
  display_name: string;
  slug: string;
  bio: string;
  photo_url: string;
  is_active: boolean;
  // Optional user account fields
  create_user_account?: boolean;
  email?: string;
  password?: string;
}

type ActionResult = { success: false; error: string } | never;

export async function createEmployeeAction(values: EmployeeFormValues): Promise<ActionResult> {
  // Check if creating with user account
  if (values.create_user_account) {
    return createEmployeeWithUserAction(values);
  }

  // Standard employee creation (no user account)
  const { service } = await getEmployeeService();

  const result = await service.create({
    display_name: values.display_name.trim(),
    slug: values.slug.trim() || undefined,
    bio: values.bio.trim() || undefined,
    photo_url: values.photo_url.trim() || undefined,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(ROUTES.employees.list);
  redirect(ROUTES.employees.list);
}

async function createEmployeeWithUserAction(values: EmployeeFormValues): Promise<ActionResult> {
  const { organizationId } = await getEmployeeService();
  const { createEmployeeWithUser } = await import('@/features/employees/user-creation-service');

  if (!values.email?.trim()) {
    return { success: false, error: 'Email is required when creating a user account' };
  }

  if (!values.password || values.password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' };
  }

  const result = await createEmployeeWithUser(organizationId, {
    display_name: values.display_name.trim(),
    slug: values.slug.trim() || undefined,
    bio: values.bio.trim() || undefined,
    photo_url: values.photo_url.trim() || undefined,
    email: values.email.trim(),
    password: values.password,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(ROUTES.employees.list);
  redirect(ROUTES.employees.list);
}

export async function updateEmployeeAction(
  id: EmployeeId,
  values: EmployeeFormValues
): Promise<ActionResult> {
  const { service } = await getEmployeeService();

  const result = await service.update(id, {
    display_name: values.display_name.trim() || undefined,
    slug: values.slug.trim() || undefined,
    bio: values.bio.trim() || undefined,
    photo_url: values.photo_url.trim() || undefined,
    is_active: values.is_active,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(ROUTES.employees.list);
  revalidatePath(ROUTES.employees.edit(id));
  redirect(ROUTES.employees.list);
}

export async function deleteEmployeeAction(id: EmployeeId): Promise<ActionResult> {
  const { service } = await getEmployeeService();

  const result = await service.delete(id);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(ROUTES.employees.list);
  redirect(ROUTES.employees.list);
}

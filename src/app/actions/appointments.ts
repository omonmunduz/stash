/**
 * APPOINTMENT ACTIONS
 *
 * Server Actions for appointment create and updates.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAppointmentService } from '@/features/appointments/server';
import type { AppointmentId, AppointmentStatus } from '@/features/appointments/types';
import type { CustomerId } from '@/lib/types/common';
import type { ServiceId } from '@/features/services/types';
import type { EmployeeId } from '@/features/employees/types';
import { ROUTES } from '@/lib/constants/routes';

type ActionResult = { success: false; error: string } | never;

export interface AppointmentFormValues {
  customer_id: string;
  service_id: string;
  employee_id: string;
  appointment_date: string;
  start_time: string;
  notes: string;
}

export async function createAppointmentAction(
  values: AppointmentFormValues
): Promise<ActionResult> {
  const { service } = await getAppointmentService();

  // Validation
  if (!values.customer_id?.trim()) {
    return { success: false, error: 'Customer is required' };
  }
  if (!values.service_id?.trim()) {
    return { success: false, error: 'Service is required' };
  }
  if (!values.employee_id?.trim()) {
    return { success: false, error: 'Employee is required' };
  }
  if (!values.appointment_date?.trim()) {
    return { success: false, error: 'Date is required' };
  }
  if (!values.start_time?.trim()) {
    return { success: false, error: 'Start time is required' };
  }

  const result = await service.create({
    customer_id: values.customer_id as CustomerId,
    service_id: values.service_id as ServiceId,
    employee_id: values.employee_id as EmployeeId,
    appointment_date: new Date(values.appointment_date),
    start_time: values.start_time,
    notes: values.notes.trim() || undefined,
    source: 'staff_created',
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(ROUTES.appointments.list);
  redirect(ROUTES.appointments.list);
}

export async function updateAppointmentStatusAction(
  id: AppointmentId,
  status: AppointmentStatus
): Promise<{ success: false; error: string } | { success: true }> {
  const { service } = await getAppointmentService();

  const result = await service.update(id, { status });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath(ROUTES.appointments.list);
  revalidatePath(ROUTES.appointments.detail(id));
  return { success: true };
}

export async function cancelAppointmentAction(
  id: AppointmentId
): Promise<{ success: false; error: string } | { success: true }> {
  return updateAppointmentStatusAction(id, 'cancelled');
}

export async function confirmAppointmentAction(
  id: AppointmentId
): Promise<{ success: false; error: string } | { success: true }> {
  return updateAppointmentStatusAction(id, 'confirmed');
}

export async function completeAppointmentAction(
  id: AppointmentId
): Promise<{ success: false; error: string } | { success: true }> {
  return updateAppointmentStatusAction(id, 'completed');
}

export async function markNoShowAction(
  id: AppointmentId
): Promise<{ success: false; error: string } | { success: true }> {
  return updateAppointmentStatusAction(id, 'no_show');
}

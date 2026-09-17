/**
 * APPOINTMENT MAPPER
 *
 * Maps database rows to domain types.
 */

import type { Database } from '@/lib/database.types';
import type { Appointment, AppointmentId } from './types';
import type { OrganizationId, CustomerId } from '@/lib/types/common';
import type { ServiceId } from '@/features/services/types';
import type { EmployeeId } from '@/features/employees/types';

type AppointmentRow = Database['public']['Tables']['appointments']['Row'];

export function mapAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id as AppointmentId,
    organization_id: row.organization_id as OrganizationId,
    customer_id: row.customer_id as CustomerId,
    service_id: row.service_id as ServiceId,
    employee_id: row.employee_id as EmployeeId,
    appointment_date: new Date(row.appointment_date),
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.status as Appointment['status'],
    source: row.source as Appointment['source'],
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    notes: row.notes,
    created_by: row.created_by,
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    created_at: new Date(row.created_at!),
    updated_at: new Date(row.updated_at!),
  };
}

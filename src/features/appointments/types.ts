/**
 * APPOINTMENT TYPES
 *
 * Scheduled bookings for services.
 */

import type { OrganizationId, CustomerId } from '@/lib/types/common';
import type { EmployeeId } from '@/features/employees/types';
import type { ServiceId } from '@/features/services/types';

export type AppointmentId = string & { readonly __brand: 'AppointmentId' };

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type AppointmentSource = 'public_booking' | 'staff_created';

export interface Appointment {
  id: AppointmentId;
  organization_id: OrganizationId;
  customer_id: CustomerId;
  service_id: ServiceId;
  employee_id: EmployeeId;
  appointment_date: Date;
  start_time: string; // HH:mm:ss format
  end_time: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  customer_name: string; // Snapshot for public bookings
  customer_phone: string; // Snapshot
  notes: string | null;
  created_by: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Appointment with related details for display */
export interface AppointmentWithDetails extends Appointment {
  service_name: string;
  service_price: number;
  employee_name: string;
  customer_code: string;
}

export interface CreateAppointmentInput {
  customer_id: CustomerId;
  service_id: ServiceId;
  employee_id: EmployeeId;
  appointment_date: Date;
  start_time: string; // HH:mm format
  notes?: string;
  source?: AppointmentSource;
}

/** Public booking input (guest checkout) */
export interface PublicBookingInput {
  organization_slug: string;
  service_id: ServiceId;
  employee_id?: EmployeeId; // Null = any available
  appointment_date: Date;
  start_time: string;
  customer_name: string;
  customer_phone: string;
  notes?: string;
}

export interface UpdateAppointmentInput {
  status?: AppointmentStatus;
  notes?: string;
  appointment_date?: Date;
  start_time?: string;
}

export interface AppointmentFilter {
  organization_id: OrganizationId;
  customer_id?: CustomerId;
  employee_id?: EmployeeId;
  status?: AppointmentStatus;
  date_from?: Date;
  date_to?: Date;
}

/** Available time slot for booking UI */
export interface AvailableSlot {
  employee_id: EmployeeId;
  employee_name: string;
  available_times: string[]; // Array of HH:mm times
}

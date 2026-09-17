/**
 * APPOINTMENT REPOSITORY
 *
 * Scheduled bookings. Includes both staff-created and public bookings.
 * The book_appointment RPC handles conflict detection and "any available"
 * employee resolution.
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import type {
  Appointment,
  AppointmentId,
  AppointmentWithDetails,
  CreateAppointmentInput,
  PublicBookingInput,
  UpdateAppointmentInput,
  AppointmentFilter,
  AvailableSlot,
} from './types';
import type { OrganizationId, CustomerId } from '@/lib/types/common';
import type { EmployeeId } from '@/features/employees/types';
import type { ServiceId } from '@/features/services/types';
import { mapAppointment } from './mapper';

type AppointmentRow = Database['public']['Tables']['appointments']['Row'];
type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];

const APPOINTMENT_COLUMNS = `
  id, organization_id, customer_id, service_id, employee_id,
  appointment_date, start_time, end_time, status, source,
  customer_name, customer_phone, notes, created_by, deleted_at,
  created_at, updated_at
`;

export interface AppointmentRepository {
  findById(id: AppointmentId): Promise<Appointment | null>;
  findWithDetails(id: AppointmentId): Promise<AppointmentWithDetails | null>;
  findAll(filter: AppointmentFilter): Promise<Appointment[]>;
  findAllWithDetails(filter: AppointmentFilter): Promise<AppointmentWithDetails[]>;

  /** Staff-created appointment (already has customer_id) */
  create(organizationId: OrganizationId, input: CreateAppointmentInput): Promise<Appointment>;

  /** Public booking (guest checkout with name + phone) */
  bookPublic(input: PublicBookingInput): Promise<Appointment>;

  update(id: AppointmentId, input: UpdateAppointmentInput): Promise<Appointment>;
  delete(id: AppointmentId): Promise<void>;

  /** Get available time slots for a service on a date */
  getAvailableSlots(
    organizationId: OrganizationId,
    serviceId: ServiceId,
    date: Date,
    employeeId?: EmployeeId
  ): Promise<AvailableSlot[]>;
}

export class SupabaseAppointmentRepository implements AppointmentRepository {
  constructor(private supabase: SupabaseServerClient) {}

  async findById(id: AppointmentId): Promise<Appointment | null> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(APPOINTMENT_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load appointment: ${error.message}`);
    return data ? mapAppointment(data) : null;
  }

  async findWithDetails(id: AppointmentId): Promise<AppointmentWithDetails | null> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(`
        ${APPOINTMENT_COLUMNS},
        services!inner(name, price),
        employees!inner(display_name),
        customers!inner(customer_code)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load appointment details: ${error.message}`);
    return data ? mapAppointmentWithDetails(data) : null;
  }

  async findAll(filter: AppointmentFilter): Promise<Appointment[]> {
    let query = this.supabase
      .from('appointments')
      .select(APPOINTMENT_COLUMNS)
      .eq('organization_id', filter.organization_id)
      .is('deleted_at', null);

    if (filter.customer_id) query = query.eq('customer_id', filter.customer_id);
    if (filter.employee_id) query = query.eq('employee_id', filter.employee_id);
    if (filter.status) query = query.eq('status', filter.status);
    if (filter.date_from) query = query.gte('appointment_date', toDateOnly(filter.date_from));
    if (filter.date_to) query = query.lte('appointment_date', toDateOnly(filter.date_to));

    const { data, error } = await query
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw new Error(`Failed to list appointments: ${error.message}`);
    return (data ?? []).map(mapAppointment);
  }

  async findAllWithDetails(filter: AppointmentFilter): Promise<AppointmentWithDetails[]> {
    let query = this.supabase
      .from('appointments')
      .select(`
        ${APPOINTMENT_COLUMNS},
        services!inner(name, price),
        employees!inner(display_name),
        customers!inner(customer_code)
      `)
      .eq('organization_id', filter.organization_id)
      .is('deleted_at', null);

    if (filter.customer_id) query = query.eq('customer_id', filter.customer_id);
    if (filter.employee_id) query = query.eq('employee_id', filter.employee_id);
    if (filter.status) query = query.eq('status', filter.status);
    if (filter.date_from) query = query.gte('appointment_date', toDateOnly(filter.date_from));
    if (filter.date_to) query = query.lte('appointment_date', toDateOnly(filter.date_to));

    const { data, error } = await query
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw new Error(`Failed to list appointments with details: ${error.message}`);
    return (data ?? []).map(mapAppointmentWithDetails);
  }

  async create(
    organizationId: OrganizationId,
    input: CreateAppointmentInput
  ): Promise<Appointment> {
    // Get customer info for snapshots
    const { data: customer, error: customerError } = await this.supabase
      .from('customers')
      .select('name, phone')
      .eq('id', input.customer_id)
      .single();

    if (customerError) throw new Error(`Customer not found: ${customerError.message}`);

    // Call the booking RPC to handle conflict detection
    const { data: appointmentId, error } = await this.supabase.rpc('book_appointment', {
      p_organization_id: organizationId,
      p_service_id: input.service_id,
      p_employee_id: input.employee_id,
      p_appointment_date: toDateOnly(input.appointment_date),
      p_start_time: input.start_time,
      p_customer_name: customer.name,
      p_customer_phone: customer.phone ?? '',
      p_notes: input.notes ?? undefined,
      p_source: input.source ?? 'staff_created',
    });

    if (error) throw new Error(`Failed to create appointment: ${error.message}`);
    if (!appointmentId) throw new Error('Appointment created but no ID returned.');

    const appointment = await this.findById(appointmentId as AppointmentId);
    if (!appointment) throw new Error('Appointment created but could not be read back.');
    return appointment;
  }

  async bookPublic(input: PublicBookingInput): Promise<Appointment> {
    // Get organization_id from slug
    const { data: org, error: orgError } = await this.supabase
      .from('organizations')
      .select('id')
      .eq('slug', input.organization_slug)
      .is('deleted_at', null)
      .maybeSingle();

    if (orgError || !org) {
      throw new Error('Organization not found or no longer active.');
    }

    const organizationId = org.id as OrganizationId;

    // Call the booking RPC
    const { data: appointmentId, error } = await this.supabase.rpc('book_appointment', {
      p_organization_id: organizationId,
      p_service_id: input.service_id,
      p_employee_id: input.employee_id || ('' as EmployeeId),
      p_appointment_date: toDateOnly(input.appointment_date),
      p_start_time: input.start_time,
      p_customer_name: input.customer_name,
      p_customer_phone: input.customer_phone,
      p_notes: input.notes,
      p_source: 'public_booking',
    });

    if (error) throw new Error(`Failed to book appointment: ${error.message}`);
    if (!appointmentId) throw new Error('Appointment created but no ID returned.');

    const appointment = await this.findById(appointmentId as AppointmentId);
    if (!appointment) throw new Error('Appointment created but could not be read back.');
    return appointment;
  }

  async update(id: AppointmentId, input: UpdateAppointmentInput): Promise<Appointment> {
    const patch: AppointmentUpdate = {};

    if (input.status !== undefined) patch.status = input.status;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.appointment_date !== undefined) {
      patch.appointment_date = toDateOnly(input.appointment_date);
    }
    if (input.start_time !== undefined) patch.start_time = input.start_time;

    if (Object.keys(patch).length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error('Appointment not found.');
      return existing;
    }

    const { data, error } = await this.supabase
      .from('appointments')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select(APPOINTMENT_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to update appointment: ${error.message}`);
    return mapAppointment(data);
  }

  async delete(id: AppointmentId): Promise<void> {
    const { error } = await this.supabase
      .from('appointments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to delete appointment: ${error.message}`);
  }

  async getAvailableSlots(
    organizationId: OrganizationId,
    serviceId: ServiceId,
    date: Date,
    employeeId?: EmployeeId
  ): Promise<AvailableSlot[]> {
    const { data, error } = await this.supabase.rpc('get_available_slots', {
      p_organization_id: organizationId,
      p_service_id: serviceId,
      p_date: toDateOnly(date),
      p_employee_id: employeeId,
    });

    if (error) throw new Error(`Failed to get available slots: ${error.message}`);

    return (data ?? []).map((row: any) => ({
      employee_id: row.employee_id as EmployeeId,
      employee_name: row.employee_name,
      available_times: row.available_times ?? [],
    }));
  }
}

function mapAppointmentWithDetails(row: any): AppointmentWithDetails {
  return {
    ...mapAppointment(row),
    service_name: row.services.name,
    service_price: row.services.price,
    employee_name: row.employees.display_name,
    customer_code: row.customers.customer_code,
  };
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

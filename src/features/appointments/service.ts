/**
 * APPOINTMENT SERVICE
 *
 * Business logic for appointment management.
 */

import type { AppointmentRepository } from './repository';
import type {
  Appointment,
  AppointmentId,
  AppointmentWithDetails,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  AppointmentFilter,
  AvailableSlot,
} from './types';
import type { OrganizationId, CustomerId } from '@/lib/types/common';
import type { ServiceId } from '@/features/services/types';
import type { EmployeeId } from '@/features/employees/types';

export type Result<T> = { success: true; data: T } | { success: false; error: string };

export class AppointmentService {
  constructor(
    private repository: AppointmentRepository,
    private organizationId: OrganizationId
  ) {}

  async list(
    filter?: Partial<Omit<AppointmentFilter, 'organization_id'>>
  ): Promise<Result<AppointmentWithDetails[]>> {
    try {
      const appointments = await this.repository.findAllWithDetails({
        organization_id: this.organizationId,
        ...filter,
      });
      return { success: true, data: appointments };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list appointments',
      };
    }
  }

  async getById(id: AppointmentId): Promise<Result<Appointment>> {
    try {
      const appointment = await this.repository.findById(id);
      if (!appointment) {
        return { success: false, error: 'Appointment not found' };
      }
      return { success: true, data: appointment };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load appointment',
      };
    }
  }

  async getWithDetails(id: AppointmentId): Promise<Result<AppointmentWithDetails>> {
    try {
      const appointment = await this.repository.findWithDetails(id);
      if (!appointment) {
        return { success: false, error: 'Appointment not found' };
      }
      return { success: true, data: appointment };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load appointment',
      };
    }
  }

  async getByCustomer(customerId: CustomerId): Promise<Result<AppointmentWithDetails[]>> {
    try {
      const appointments = await this.repository.findAllWithDetails({
        organization_id: this.organizationId,
        customer_id: customerId,
      });
      return { success: true, data: appointments };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load customer appointments',
      };
    }
  }

  async getByEmployee(employeeId: EmployeeId): Promise<Result<AppointmentWithDetails[]>> {
    try {
      const appointments = await this.repository.findAllWithDetails({
        organization_id: this.organizationId,
        employee_id: employeeId,
      });
      return { success: true, data: appointments };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load employee appointments',
      };
    }
  }

  async create(input: CreateAppointmentInput): Promise<Result<Appointment>> {
    try {
      // Validation
      if (!input.customer_id || !input.service_id || !input.employee_id) {
        return { success: false, error: 'Customer, service, and employee are required' };
      }
      if (!input.appointment_date) {
        return { success: false, error: 'Appointment date is required' };
      }
      if (!input.start_time) {
        return { success: false, error: 'Start time is required' };
      }

      const appointment = await this.repository.create(this.organizationId, input);
      return { success: true, data: appointment };
    } catch (error) {
      // Handle conflict errors with friendlier messages
      const message = error instanceof Error ? error.message : 'Failed to create appointment';

      if (message.includes('no longer available')) {
        return {
          success: false,
          error: 'This time slot is no longer available. Please select another time.',
        };
      }

      return { success: false, error: message };
    }
  }

  async update(id: AppointmentId, input: UpdateAppointmentInput): Promise<Result<Appointment>> {
    try {
      const appointment = await this.repository.update(id, input);
      return { success: true, data: appointment };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update appointment',
      };
    }
  }

  async delete(id: AppointmentId): Promise<Result<void>> {
    try {
      await this.repository.delete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete appointment',
      };
    }
  }

  async getAvailableSlots(
    serviceId: ServiceId,
    date: Date,
    employeeId?: EmployeeId
  ): Promise<Result<AvailableSlot[]>> {
    try {
      const slots = await this.repository.getAvailableSlots(
        this.organizationId,
        serviceId,
        date,
        employeeId
      );
      return { success: true, data: slots };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get available slots',
      };
    }
  }
}

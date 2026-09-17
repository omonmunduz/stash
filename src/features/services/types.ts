/**
 * SERVICE TYPES
 *
 * What the business offers: haircuts, manicures, massages, etc.
 */

import type { OrganizationId } from '@/lib/types/common';
import type { EmployeeId } from '@/features/employees/types';

export type ServiceId = string & { readonly __brand: 'ServiceId' };

export interface Service {
  id: ServiceId;
  organization_id: OrganizationId;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Service with the employees who can perform it */
export interface ServiceWithProviders extends Service {
  providers: Array<{
    employee_id: EmployeeId;
    employee_name: string;
  }>;
}

export interface CreateServiceInput {
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  provider_employee_ids?: EmployeeId[]; // Which employees offer this service
}

export interface UpdateServiceInput {
  name?: string;
  description?: string;
  duration_minutes?: number;
  price?: number;
  is_active?: boolean;
}

export interface ServiceFilter {
  organization_id: OrganizationId;
  is_active?: boolean;
  search?: string;
}

/** Lightweight for booking UI */
export interface ServiceLookup {
  id: ServiceId;
  name: string;
  duration_minutes: number;
  price: number;
}

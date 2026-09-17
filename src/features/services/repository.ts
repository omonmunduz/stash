/**
 * SERVICE REPOSITORY
 *
 * Services (what the business offers) plus the many-to-many relationship
 * with employees (service_providers).
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import type {
  Service,
  ServiceId,
  ServiceWithProviders,
  CreateServiceInput,
  UpdateServiceInput,
  ServiceFilter,
  ServiceLookup,
} from './types';
import type { OrganizationId } from '@/lib/types/common';
import type { EmployeeId } from '@/features/employees/types';

export type { ServiceLookup };

type ServiceRow = Database['public']['Tables']['services']['Row'];
type ServiceUpdate = Database['public']['Tables']['services']['Update'];

const SERVICE_COLUMNS = `
  id, organization_id, name, description, duration_minutes,
  price, is_active, visible_on_landing_page, deleted_at, created_at, updated_at
`;

export interface ServiceRepository {
  findById(id: ServiceId): Promise<Service | null>;
  findWithProviders(id: ServiceId): Promise<ServiceWithProviders | null>;
  findAll(filter: ServiceFilter): Promise<Service[]>;
  findLookups(organizationId: OrganizationId): Promise<ServiceLookup[]>;

  /** Services that a specific employee can perform */
  findByEmployee(employeeId: EmployeeId, organizationId: OrganizationId): Promise<Service[]>;

  create(organizationId: OrganizationId, input: CreateServiceInput): Promise<Service>;
  update(id: ServiceId, input: UpdateServiceInput): Promise<Service>;
  delete(id: ServiceId): Promise<void>;

  /** Assign employees who can perform this service */
  setProviders(serviceId: ServiceId, employeeIds: EmployeeId[]): Promise<void>;
}

export class SupabaseServiceRepository implements ServiceRepository {
  constructor(private supabase: SupabaseServerClient) {}

  async findById(id: ServiceId): Promise<Service | null> {
    const { data, error } = await this.supabase
      .from('services')
      .select(SERVICE_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load service: ${error.message}`);
    return data ? mapService(data) : null;
  }

  async findWithProviders(id: ServiceId): Promise<ServiceWithProviders | null> {
    const service = await this.findById(id);
    if (!service) return null;

    const { data: providerRows, error } = await this.supabase
      .from('service_providers')
      .select('employee_id, employees!inner(display_name)')
      .eq('service_id', id);

    if (error) throw new Error(`Failed to load service providers: ${error.message}`);

    return {
      ...service,
      providers: (providerRows ?? []).map((row) => ({
        employee_id: row.employee_id as EmployeeId,
        employee_name: (row.employees as any).display_name,
      })),
    };
  }

  async findAll(filter: ServiceFilter): Promise<Service[]> {
    let query = this.supabase
      .from('services')
      .select(SERVICE_COLUMNS)
      .eq('organization_id', filter.organization_id)
      .is('deleted_at', null);

    if (filter.is_active !== undefined) {
      query = query.eq('is_active', filter.is_active);
    }

    if (filter.search) {
      query = query.ilike('name', `%${filter.search}%`);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw new Error(`Failed to list services: ${error.message}`);
    return (data ?? []).map(mapService);
  }

  async findLookups(organizationId: OrganizationId): Promise<ServiceLookup[]> {
    const { data, error } = await this.supabase
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to load service lookups: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id as ServiceId,
      name: row.name,
      duration_minutes: row.duration_minutes,
      price: row.price,
    }));
  }

  async findByEmployee(
    employeeId: EmployeeId,
    organizationId: OrganizationId
  ): Promise<Service[]> {
    const { data, error } = await this.supabase
      .from('service_providers')
      .select(`service_id, services!inner(${SERVICE_COLUMNS})`)
      .eq('employee_id', employeeId)
      .eq('services.organization_id', organizationId)
      .eq('services.is_active', true)
      .is('services.deleted_at', null);

    if (error) throw new Error(`Failed to load employee services: ${error.message}`);

    return (data ?? []).map((row) => mapService((row.services as any) as ServiceRow));
  }

  async create(organizationId: OrganizationId, input: CreateServiceInput): Promise<Service> {
    const { data, error } = await this.supabase
      .from('services')
      .insert({
        organization_id: organizationId,
        name: input.name,
        description: input.description ?? null,
        duration_minutes: input.duration_minutes,
        price: input.price,
      })
      .select(SERVICE_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to create service: ${error.message}`);

    const service = mapService(data);

    // Assign providers if specified
    if (input.provider_employee_ids && input.provider_employee_ids.length > 0) {
      await this.setProviders(service.id, input.provider_employee_ids);
    }

    return service;
  }

  async update(id: ServiceId, input: UpdateServiceInput): Promise<Service> {
    const patch: ServiceUpdate = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        patch[key as keyof ServiceUpdate] = value as never;
      }
    }

    if (Object.keys(patch).length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error('Service not found.');
      return existing;
    }

    const { data, error } = await this.supabase
      .from('services')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select(SERVICE_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to update service: ${error.message}`);
    return mapService(data);
  }

  async delete(id: ServiceId): Promise<void> {
    const { error } = await this.supabase
      .from('services')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to delete service: ${error.message}`);
  }

  async setProviders(serviceId: ServiceId, employeeIds: EmployeeId[]): Promise<void> {
    // Get organization_id for the service
    const service = await this.findById(serviceId);
    if (!service) throw new Error('Service not found.');

    // Delete existing providers
    const { error: deleteError } = await this.supabase
      .from('service_providers')
      .delete()
      .eq('service_id', serviceId);

    if (deleteError) throw new Error(`Failed to clear service providers: ${deleteError.message}`);

    // Insert new providers
    if (employeeIds.length > 0) {
      const { error: insertError } = await this.supabase
        .from('service_providers')
        .insert(
          employeeIds.map((employeeId) => ({
            organization_id: service.organization_id,
            service_id: serviceId,
            employee_id: employeeId,
          }))
        );

      if (insertError) throw new Error(`Failed to assign providers: ${insertError.message}`);
    }
  }
}

function mapService(row: ServiceRow): Service {
  return {
    id: row.id as ServiceId,
    organization_id: row.organization_id as OrganizationId,
    name: row.name,
    description: row.description,
    duration_minutes: row.duration_minutes,
    price: row.price,
    is_active: row.is_active,
    visible_on_landing_page: row.visible_on_landing_page ?? true,
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    created_at: new Date(row.created_at!),
    updated_at: new Date(row.updated_at!),
  };
}

/**
 * SERVICE SERVICE
 *
 * Business logic for service management.
 */

import type { ServiceRepository, ServiceLookup } from './repository';
import type {
  Service,
  ServiceId,
  ServiceWithProviders,
  CreateServiceInput,
  UpdateServiceInput,
  ServiceFilter,
} from './types';
import type { OrganizationId } from '@/lib/types/common';
import type { EmployeeId } from '@/features/employees/types';

export type Result<T> = { success: true; data: T } | { success: false; error: string };

export class ServiceService {
  constructor(
    private repository: ServiceRepository,
    private organizationId: OrganizationId
  ) {}

  async list(filter?: Partial<Omit<ServiceFilter, 'organization_id'>>): Promise<Result<Service[]>> {
    try {
      const services = await this.repository.findAll({
        organization_id: this.organizationId,
        ...filter,
      });
      return { success: true, data: services };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list services',
      };
    }
  }

  async listWithProviders(
    filter?: Partial<Omit<ServiceFilter, 'organization_id'>>
  ): Promise<Result<ServiceWithProviders[]>> {
    try {
      const services = await this.repository.findAll({
        organization_id: this.organizationId,
        ...filter,
      });

      // Fetch providers for each service
      const servicesWithProviders = await Promise.all(
        services.map(async (service) => {
          const withProviders = await this.repository.findWithProviders(service.id);
          return withProviders || { ...service, providers: [] };
        })
      );

      return { success: true, data: servicesWithProviders };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list services with providers',
      };
    }
  }

  async getById(id: ServiceId): Promise<Result<Service>> {
    try {
      const service = await this.repository.findById(id);
      if (!service) {
        return { success: false, error: 'Service not found' };
      }
      return { success: true, data: service };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load service',
      };
    }
  }

  async getWithProviders(id: ServiceId): Promise<Result<ServiceWithProviders>> {
    try {
      const service = await this.repository.findWithProviders(id);
      if (!service) {
        return { success: false, error: 'Service not found' };
      }
      return { success: true, data: service };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load service',
      };
    }
  }

  async getLookups(): Promise<Result<ServiceLookup[]>> {
    try {
      const lookups = await this.repository.findLookups(this.organizationId);
      return { success: true, data: lookups };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load services',
      };
    }
  }

  async getByEmployee(employeeId: EmployeeId): Promise<Result<Service[]>> {
    try {
      const services = await this.repository.findByEmployee(employeeId, this.organizationId);
      return { success: true, data: services };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load employee services',
      };
    }
  }

  async create(input: CreateServiceInput): Promise<Result<Service>> {
    try {
      // Validation
      if (!input.name?.trim()) {
        return { success: false, error: 'Service name is required' };
      }
      if (input.duration_minutes <= 0) {
        return { success: false, error: 'Duration must be greater than 0' };
      }
      if (input.price < 0) {
        return { success: false, error: 'Price cannot be negative' };
      }

      const service = await this.repository.create(this.organizationId, input);
      return { success: true, data: service };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create service',
      };
    }
  }

  async update(id: ServiceId, input: UpdateServiceInput): Promise<Result<Service>> {
    try {
      if (input.duration_minutes !== undefined && input.duration_minutes <= 0) {
        return { success: false, error: 'Duration must be greater than 0' };
      }
      if (input.price !== undefined && input.price < 0) {
        return { success: false, error: 'Price cannot be negative' };
      }

      const service = await this.repository.update(id, input);
      return { success: true, data: service };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update service',
      };
    }
  }

  async delete(id: ServiceId): Promise<Result<void>> {
    try {
      await this.repository.delete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete service',
      };
    }
  }

  async setProviders(serviceId: ServiceId, employeeIds: EmployeeId[]): Promise<Result<void>> {
    try {
      await this.repository.setProviders(serviceId, employeeIds);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update service providers',
      };
    }
  }
}

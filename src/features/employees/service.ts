/**
 * EMPLOYEE SERVICE
 *
 * Business logic for employee management. Wraps the repository with
 * validation and Result-based error handling.
 */

import type { EmployeeRepository, EmployeeLookup } from './repository';
import type {
  Employee,
  EmployeeId,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeFilter,
} from './types';
import type { OrganizationId, UserId } from '@/lib/types/common';

export type Result<T> = { success: true; data: T } | { success: false; error: string };

export class EmployeeService {
  constructor(
    private repository: EmployeeRepository,
    private organizationId: OrganizationId
  ) {}

  async list(filter?: Partial<Omit<EmployeeFilter, 'organization_id'>>): Promise<Result<Employee[]>> {
    try {
      const employees = await this.repository.findAll({
        organization_id: this.organizationId,
        ...filter,
      });
      return { success: true, data: employees };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list employees',
      };
    }
  }

  async getById(id: EmployeeId): Promise<Result<Employee>> {
    try {
      const employee = await this.repository.findById(id);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return { success: true, data: employee };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load employee',
      };
    }
  }

  async getBySlug(slug: string): Promise<Result<Employee>> {
    try {
      const employee = await this.repository.findBySlug(slug, this.organizationId);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return { success: true, data: employee };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load employee',
      };
    }
  }

  async getLookups(): Promise<Result<EmployeeLookup[]>> {
    try {
      const lookups = await this.repository.findLookups(this.organizationId);
      return { success: true, data: lookups };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load employees',
      };
    }
  }

  async getByUserProfileId(userId: UserId): Promise<Result<Employee | null>> {
    try {
      const employee = await this.repository.findByUserProfileId(userId, this.organizationId);
      return { success: true, data: employee };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load employee',
      };
    }
  }

  async create(input: CreateEmployeeInput): Promise<Result<Employee>> {
    try {
      // Validation
      if (!input.display_name?.trim()) {
        return { success: false, error: 'Display name is required' };
      }

      const employee = await this.repository.create(this.organizationId, input);
      return { success: true, data: employee };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create employee',
      };
    }
  }

  async update(id: EmployeeId, input: UpdateEmployeeInput): Promise<Result<Employee>> {
    try {
      const employee = await this.repository.update(id, input);
      return { success: true, data: employee };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update employee',
      };
    }
  }

  async delete(id: EmployeeId): Promise<Result<void>> {
    try {
      await this.repository.delete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete employee',
      };
    }
  }
}

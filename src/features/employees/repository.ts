/**
 * EMPLOYEE REPOSITORY
 *
 * Interface plus Supabase implementation. Follows the same pattern as
 * customers/products: reads that find nothing return null or empty array,
 * everything else throws for the service layer to translate.
 */

import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import type {
  Employee,
  EmployeeId,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeFilter,
  EmployeeLookup,
} from './types';
import type { OrganizationId, UserId } from '@/lib/types/common';

export type { EmployeeLookup };

type EmployeeRow = Database['public']['Tables']['employees']['Row'];
type EmployeeUpdate = Database['public']['Tables']['employees']['Update'];

const EMPLOYEE_COLUMNS = `
  id, organization_id, user_profile_id, display_name, slug,
  bio, photo_url, is_active, deleted_at, created_at, updated_at
`;

export interface EmployeeRepository {
  findById(id: EmployeeId): Promise<Employee | null>;
  findBySlug(slug: string, organizationId: OrganizationId): Promise<Employee | null>;
  findAll(filter: EmployeeFilter): Promise<Employee[]>;
  findLookups(organizationId: OrganizationId): Promise<EmployeeLookup[]>;

  /** Find employee linked to a user profile (for logged-in employees) */
  findByUserProfileId(userId: UserId, organizationId: OrganizationId): Promise<Employee | null>;

  create(organizationId: OrganizationId, input: CreateEmployeeInput): Promise<Employee>;
  update(id: EmployeeId, input: UpdateEmployeeInput): Promise<Employee>;
  delete(id: EmployeeId): Promise<void>;
}

export class SupabaseEmployeeRepository implements EmployeeRepository {
  constructor(private supabase: SupabaseServerClient) {}

  async findById(id: EmployeeId): Promise<Employee | null> {
    const { data, error } = await this.supabase
      .from('employees')
      .select(EMPLOYEE_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load employee: ${error.message}`);
    return data ? mapEmployee(data) : null;
  }

  async findBySlug(slug: string, organizationId: OrganizationId): Promise<Employee | null> {
    const { data, error } = await this.supabase
      .from('employees')
      .select(EMPLOYEE_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load employee by slug: ${error.message}`);
    return data ? mapEmployee(data) : null;
  }

  async findAll(filter: EmployeeFilter): Promise<Employee[]> {
    let query = this.supabase
      .from('employees')
      .select(EMPLOYEE_COLUMNS)
      .eq('organization_id', filter.organization_id)
      .is('deleted_at', null);

    if (filter.is_active !== undefined) {
      query = query.eq('is_active', filter.is_active);
    }

    if (filter.search) {
      query = query.ilike('display_name', `%${filter.search}%`);
    }

    const { data, error } = await query.order('display_name', { ascending: true });

    if (error) throw new Error(`Failed to list employees: ${error.message}`);
    return (data ?? []).map(mapEmployee);
  }

  async findLookups(organizationId: OrganizationId): Promise<EmployeeLookup[]> {
    const { data, error } = await this.supabase
      .from('employees')
      .select('id, display_name, slug, photo_url')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_name', { ascending: true });

    if (error) throw new Error(`Failed to load employee lookups: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id as EmployeeId,
      display_name: row.display_name,
      slug: row.slug,
      photo_url: row.photo_url,
    }));
  }

  async findByUserProfileId(
    userId: UserId,
    organizationId: OrganizationId
  ): Promise<Employee | null> {
    const { data, error } = await this.supabase
      .from('employees')
      .select(EMPLOYEE_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('user_profile_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to load employee by user: ${error.message}`);
    return data ? mapEmployee(data) : null;
  }

  async create(organizationId: OrganizationId, input: CreateEmployeeInput): Promise<Employee> {
    // Generate slug if not provided
    let slug = input.slug?.trim();

    if (!slug) {
      const { data: generated, error: slugError } = await this.supabase.rpc(
        'generate_employee_slug',
        {
          p_organization_id: organizationId,
          p_display_name: input.display_name,
        }
      );

      if (slugError) throw new Error(`Failed to generate slug: ${slugError.message}`);
      slug = generated as string;
    }

    const { data, error } = await this.supabase
      .from('employees')
      .insert({
        organization_id: organizationId,
        display_name: input.display_name,
        slug,
        bio: input.bio ?? null,
        photo_url: input.photo_url ?? null,
        user_profile_id: input.user_profile_id ?? null,
      })
      .select(EMPLOYEE_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to create employee: ${error.message}`);

    // Create default working hours (Monday-Saturday, 9am-5pm)
    const defaultHours = [1, 2, 3, 4, 5, 6].map((day) => ({
      organization_id: organizationId,
      employee_id: data.id,
      day_of_week: day,
      start_time: '09:00:00',
      end_time: '17:00:00',
    }));

    const { error: hoursError } = await this.supabase
      .from('working_hours')
      .insert(defaultHours);

    if (hoursError) {
      console.error('Failed to create default working hours:', hoursError);
      // Don't fail the employee creation, just log the error
    }

    return mapEmployee(data);
  }

  async update(id: EmployeeId, input: UpdateEmployeeInput): Promise<Employee> {
    const patch: EmployeeUpdate = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        patch[key as keyof EmployeeUpdate] = value as never;
      }
    }

    if (Object.keys(patch).length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error('Employee not found.');
      return existing;
    }

    const { data, error } = await this.supabase
      .from('employees')
      .update(patch)
      .eq('id', id)
      .is('deleted_at', null)
      .select(EMPLOYEE_COLUMNS)
      .single();

    if (error) throw new Error(`Failed to update employee: ${error.message}`);
    return mapEmployee(data);
  }

  async delete(id: EmployeeId): Promise<void> {
    const { error } = await this.supabase
      .from('employees')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to delete employee: ${error.message}`);
  }
}

function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id as EmployeeId,
    organization_id: row.organization_id as OrganizationId,
    user_profile_id: row.user_profile_id as UserId | null,
    display_name: row.display_name,
    slug: row.slug,
    bio: row.bio,
    photo_url: row.photo_url,
    is_active: row.is_active,
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    created_at: new Date(row.created_at!),
    updated_at: new Date(row.updated_at!),
  };
}

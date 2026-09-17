/**
 * EMPLOYEE USER CREATION SERVICE
 *
 * Handles creating employee accounts with Supabase Auth credentials.
 * Uses the admin client (service role) to bypass RLS and create users.
 *
 * Security:
 * - Only admins/owners can create employee accounts
 * - Created users are pre-verified (no email verification needed)
 * - Users are assigned 'employee' role by default
 * - Users are automatically linked to the creating organization
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { Result, OrganizationId, UserId } from '@/lib/types/common';
import type { Employee, EmployeeId } from './types';

export interface CreateEmployeeWithUserInput {
  // Employee fields
  display_name: string;
  slug?: string;
  bio?: string;
  photo_url?: string;

  // Auth fields
  email: string;
  password: string;
}

export interface CreateEmployeeWithUserResult {
  employee: Employee;
  userId: UserId;
}

/**
 * Create an employee with a user account.
 *
 * Steps:
 * 1. Validate inputs
 * 2. Create user in auth.users (with admin client)
 * 3. Create user_profiles record (links user to organization)
 * 4. Update auth.users.app_metadata with org_id and role
 * 5. Create employee record (linked to user_profile_id)
 *
 * If any step fails, rollback previous operations.
 */
export async function createEmployeeWithUser(
  organizationId: OrganizationId,
  input: CreateEmployeeWithUserInput
): Promise<Result<CreateEmployeeWithUserResult>> {
  const adminClient = createAdminClient();
  let createdUserId: string | null = null;
  let createdEmployeeId: string | null = null;

  try {
    // Step 1: Validate inputs
    if (!input.display_name?.trim()) {
      return { success: false, error: 'Display name is required' };
    }
    if (!input.email?.trim()) {
      return { success: false, error: 'Email is required' };
    }
    if (!input.password || input.password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    // Step 2: Create user in auth.users
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: input.email.trim(),
      password: input.password,
      email_confirm: true, // Skip email verification
      app_metadata: {
        organization_id: organizationId,
        role: 'employee',
      },
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: authError?.message || 'Failed to create user account',
      };
    }

    createdUserId = authData.user.id;

    // Step 3: Create user_profiles record
    const { error: profileError } = await adminClient.from('user_profiles').insert({
      id: authData.user.id,
      organization_id: organizationId,
      email: input.email.trim(),
      full_name: input.display_name.trim(),
      role: 'employee',
      is_active: true,
    } as any);

    if (profileError) {
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    // Step 4: Generate slug if not provided
    let slug = input.slug?.trim();
    if (!slug) {
      const { data: generated, error: slugError } = await adminClient.rpc(
        'generate_employee_slug',
        {
          p_organization_id: organizationId,
          p_display_name: input.display_name,
        }
      );

      if (slugError) throw new Error(`Failed to generate slug: ${slugError.message}`);
      slug = generated as string;
    }

    // Step 5: Create employee record (linked to user)
    const { data: employee, error: employeeError } = await adminClient
      .from('employees')
      .insert({
        organization_id: organizationId,
        user_profile_id: authData.user.id,
        display_name: input.display_name.trim(),
        slug,
        bio: input.bio?.trim() || null,
        photo_url: input.photo_url?.trim() || null,
        is_active: true,
      })
      .select(
        `id, organization_id, user_profile_id, display_name, slug,
         bio, photo_url, is_active, deleted_at, created_at, updated_at`
      )
      .single();

    if (employeeError || !employee) {
      throw new Error(`Failed to create employee: ${employeeError?.message}`);
    }

    createdEmployeeId = employee.id;

    return {
      success: true,
      data: {
        employee: {
          id: employee.id as EmployeeId,
          organization_id: employee.organization_id as OrganizationId,
          user_profile_id: employee.user_profile_id as UserId,
          display_name: employee.display_name,
          slug: employee.slug,
          bio: employee.bio,
          photo_url: employee.photo_url,
          is_active: employee.is_active,
          deleted_at: employee.deleted_at ? new Date(employee.deleted_at) : null,
          created_at: new Date(employee.created_at!),
          updated_at: new Date(employee.updated_at!),
        },
        userId: authData.user.id as UserId,
      },
    };
  } catch (error) {
    // Rollback: delete employee and user if created
    if (createdEmployeeId) {
      try {
        await adminClient.from('employees').delete().eq('id', createdEmployeeId);
      } catch (deleteError) {
        console.error('Failed to rollback employee creation:', deleteError);
      }
    }

    if (createdUserId) {
      try {
        await adminClient.auth.admin.deleteUser(createdUserId);
      } catch (deleteError) {
        console.error('Failed to rollback user creation:', deleteError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create employee account',
    };
  }
}

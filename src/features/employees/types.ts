/**
 * EMPLOYEE TYPES
 *
 * Staff who perform services. Separate from user_profiles.role='employee'
 * because a stylist may take appointments without needing app login.
 */

import type { OrganizationId, UserId } from '@/lib/types/common';

export type EmployeeId = string & { readonly __brand: 'EmployeeId' };

export interface Employee {
  id: EmployeeId;
  organization_id: OrganizationId;
  user_profile_id: UserId | null;
  display_name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEmployeeInput {
  display_name: string;
  slug?: string; // Auto-generated if not provided
  bio?: string;
  photo_url?: string;
  user_profile_id?: UserId; // Link to app user if they need login
}

export interface UpdateEmployeeInput {
  display_name?: string;
  slug?: string;
  bio?: string;
  photo_url?: string;
  is_active?: boolean;
  user_profile_id?: UserId | null;
}

export interface EmployeeFilter {
  organization_id: OrganizationId;
  is_active?: boolean;
  search?: string;
}

/** Lightweight shape for dropdowns and quick lookups */
export interface EmployeeLookup {
  id: EmployeeId;
  display_name: string;
  slug: string;
  photo_url: string | null;
}

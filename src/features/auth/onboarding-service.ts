/**
 * ONBOARDING SERVICE
 *
 * Orchestrates organization creation during the signup flow.
 *
 * Design decisions:
 * - Uses the admin client (service role) because new users have no organization
 *   yet, and RLS policies block them from creating one via the normal client.
 * - Writes JWT claims (organization_id, role) to app_metadata so RLS policies
 *   can read them without an extra DB query on every request.
 * - Transaction-like: if any step fails, the organization is deleted.
 * - Slug collision is handled with a numeric suffix (org-name-2, org-name-3).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Result, OrganizationId, UserId } from '@/lib/types/common';
import { generateSlug, getDefaultSettings } from '@/features/organizations/business-rules';

export interface CreateOrganizationInput {
  userId: UserId;
  organizationName: string;
  userFullName: string;
  userEmail: string;
}

/**
 * Create an organization and assign the user as owner.
 *
 * This is the only way to create an organization because:
 * - RLS blocks unauthenticated users from inserting into organizations
 * - RLS blocks authenticated users without an organization from inserting
 * - Therefore only the admin client (service role) can create the first org
 *
 * Steps:
 * 1. Generate a unique slug from the organization name
 * 2. Insert the organization record (with service role, bypassing RLS)
 * 3. Insert the user_profiles record linking user to org
 * 4. Update auth.users.app_metadata with org_id and role (for JWT claims)
 * 5. Refresh the user's session so the new JWT includes the claims
 *
 * If any step fails, the organization is deleted (rollback).
 */
export async function createOrganizationWithOwner(
  input: CreateOrganizationInput
): Promise<Result<{ organizationId: OrganizationId }>> {
  const adminClient = createAdminClient();
  let createdOrgId: string | null = null;

  try {
    // Step 1: Generate slug and ensure it's unique
    const baseSlug = generateSlug(input.organizationName);
    let slug = baseSlug;
    let attempt = 1;

    // Check for slug collision and append number if needed
    while (true) {
      const { data: existing } = await adminClient
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single();

      if (!existing) break; // Slug is available

      attempt++;
      slug = `${baseSlug}-${attempt}`;

      if (attempt > 100) {
        return {
          success: false,
          error: 'Could not generate a unique organization identifier. Please try a different name.',
        };
      }
    }

    // Step 2: Create organization
    //
    // No subscription or trial fields: the canonical schema doesn't have them.
    // Billing arrives in Phase 2 as its own migration. Stamping a trial_ends_at
    // now would leave a live 30-day timer in the database with no code reading
    // it — and the day someone writes the enforcement check, every existing
    // business locks out retroactively.
    const orgInsert = {
      name: input.organizationName,
      slug,
      settings: getDefaultSettings(),
    };

    const { data: org, error: orgError } = (await adminClient
      .from('organizations')
      .insert(orgInsert as any)
      .select('id')
      .single()) as any;

    if (orgError || !org) {
      return {
        success: false,
        error: 'Failed to create organization. Please try again.',
      };
    }

    createdOrgId = org.id;

    // Step 3: Create user_profiles record
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .insert({
        id: input.userId,
        organization_id: org.id,
        email: input.userEmail,
        full_name: input.userFullName,
        role: 'owner',
        is_active: true,
      } as any);

    if (profileError) {
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    // Step 4: Update auth.users.app_metadata with JWT claims
    const { error: metadataError } = await adminClient.auth.admin.updateUserById(
      input.userId,
      {
        app_metadata: {
          organization_id: org.id,
          role: 'owner',
        },
      }
    );

    if (metadataError) {
      throw new Error(`Failed to update user metadata: ${metadataError.message}`);
    }

    // Step 5: Refresh the user's session to get new JWT with claims
    // Note: This is best-effort. The claims might not land immediately,
    // but our middleware and pages fall back to DB lookup when missing.
    try {
      const supabase = await createClient();
      await supabase.auth.refreshSession();
    } catch (refreshError) {
      // Log but don't fail — the fallback will handle it
      console.warn('Session refresh after org creation failed:', refreshError);
    }

    return {
      success: true,
      data: { organizationId: org.id as OrganizationId },
    };
  } catch (error) {
    // Rollback: delete the organization if we created it
    if (createdOrgId) {
      try {
        await adminClient
          .from('organizations')
          .delete()
          .eq('id', createdOrgId);
      } catch (deleteError) {
        console.error('Failed to rollback organization creation:', deleteError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Organization creation failed.',
    };
  }
}

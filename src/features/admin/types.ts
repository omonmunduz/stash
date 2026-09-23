/**
 * ADMIN FEATURE - TYPES
 *
 * Types specific to super admin functionality.
 */

import type { OrganizationBilling, AdminDashboardSummary } from '@/features/billing/types';

export type { OrganizationBilling, AdminDashboardSummary };

/**
 * Admin action types for UI
 */
export type AdminAction =
  | 'mark_paid'
  | 'extend_period'
  | 'change_plan'
  | 'suspend'
  | 'reactivate'
  | 'cancel'
  | 'grant_subscription'
  | 'resend_payment_link';

/**
 * Admin action result
 */
export interface AdminActionResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * ADMIN FEATURE - SERVICE
 *
 * Business logic for super admin operations.
 * All operations require super_admin role (checked in actions layer).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import * as billingRepo from '@/features/billing/repository';
import * as billingService from '@/features/billing/service';
import type { AdminDashboardSummary, AdminOrganizationFilter } from '@/features/billing/types';

const supabase = createAdminClient();

/**
 * Get dashboard summary statistics
 */
export async function getDashboardSummary(): Promise<AdminDashboardSummary> {
  // Get total organizations
  const { count: totalOrgs } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  // Note: Subscription status tracking requires the subscriptions table
  // For now, return basic counts
  const counts = {
    total_organizations: totalOrgs || 0,
    active_subscriptions: 0,
    trial_subscriptions: 0,
    past_due_subscriptions: 0,
    suspended_subscriptions: 0,
  };

  const expiringCount = 0;
  const overdueCount = 0;

  // Revenue tracking requires payments table
  const revenueThisMonth = 0;
  const revenueLastMonth = 0;

  return {
    ...counts,
    expiring_soon_count: expiringCount || 0,
    overdue_count: overdueCount || 0,
    revenue_this_month: revenueThisMonth,
    revenue_last_month: revenueLastMonth,
  };
}

/**
 * Get organizations with billing info
 */
export async function getOrganizationsBilling(
  filter?: AdminOrganizationFilter,
  page = 1,
  pageSize = 100
) {
  return billingRepo.getOrganizationsBilling(filter || {}, page, pageSize);
}

/**
 * Get detailed organization billing
 */
export async function getOrganizationDetail(organizationId: string) {
  const [org, subscription, invoices, payments, webhooks, auditLogs] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', organizationId).single(),
    billingRepo.getSubscriptionByOrgId(organizationId),
    billingRepo.getInvoicesByOrgId(organizationId),
    billingRepo.getPaymentsByOrgId(organizationId),
    billingRepo.getWebhookEventsByOrgId(organizationId),
    billingRepo.getAuditLogsByOrgId(organizationId),
  ]);

  if (org.error) throw org.error;

  return {
    organization: org.data,
    subscription,
    invoices,
    payments,
    webhooks,
    auditLogs,
  };
}

/**
 * Resend payment link for invoice
 */
export async function resendPaymentLink(invoiceId: string): Promise<string> {
  const invoice = await billingRepo.getInvoiceById(invoiceId);

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.status !== 'pending') {
    throw new Error('Can only resend payment link for pending invoices');
  }

  // Return existing payment URL if available
  if (invoice.gateway_payment_url) {
    return invoice.gateway_payment_url;
  }

  throw new Error('Invoice has no payment URL. Payment creation may have failed.');
}

// Re-export billing service admin actions for convenience
export {
  markInvoicePaid,
  extendSubscriptionPeriod,
  changeSubscriptionPlan,
  suspendSubscription,
  reactivateSubscription,
  cancelSubscription,
  grantSubscription,
} from '@/features/billing/service';

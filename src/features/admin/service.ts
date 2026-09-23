/**
 * ADMIN FEATURE - SERVICE
 *
 * Business logic for super admin operations.
 * All operations require super_admin role (checked in actions layer).
 */

import { createClient } from '@/lib/supabase/admin';
import * as billingRepo from '@/features/billing/repository';
import * as billingService from '@/features/billing/service';
import type { AdminDashboardSummary, AdminOrganizationFilter } from '@/features/billing/types';

const supabase = createClient();

/**
 * Get dashboard summary statistics
 */
export async function getDashboardSummary(): Promise<AdminDashboardSummary> {
  // Get subscription counts by status
  const { data: statusCounts, error: statusError } = await supabase
    .from('organizations')
    .select('subscription_status')
    .is('deleted_at', null);

  if (statusError) {
    console.error('Failed to get status counts:', statusError);
  }

  const counts = {
    total_organizations: statusCounts?.length || 0,
    active_subscriptions: statusCounts?.filter(o => o.subscription_status === 'active').length || 0,
    trial_subscriptions: statusCounts?.filter(o => o.subscription_status === 'trial').length || 0,
    past_due_subscriptions: statusCounts?.filter(o => o.subscription_status === 'past_due').length || 0,
    suspended_subscriptions: statusCounts?.filter(o => o.subscription_status === 'suspended').length || 0,
  };

  // Get expiring soon count (within 7 days)
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const { count: expiringCount } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .lte('current_period_end', sevenDaysFromNow.toISOString())
    .gte('current_period_end', new Date().toISOString())
    .in('subscription_status', ['active', 'trial']);

  // Get overdue count
  const { count: overdueCount } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .lt('current_period_end', new Date().toISOString())
    .in('subscription_status', ['active', 'past_due']);

  // Get revenue this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: thisMonthPayments } = await supabase
    .from('payments')
    .select('amount_kgs')
    .gte('paid_at', startOfMonth.toISOString());

  const revenueThisMonth = thisMonthPayments?.reduce(
    (sum, p) => sum + Number(p.amount_kgs),
    0
  ) || 0;

  // Get revenue last month
  const startOfLastMonth = new Date(startOfMonth);
  startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);
  const endOfLastMonth = new Date(startOfMonth);
  endOfLastMonth.setMilliseconds(-1);

  const { data: lastMonthPayments } = await supabase
    .from('payments')
    .select('amount_kgs')
    .gte('paid_at', startOfLastMonth.toISOString())
    .lte('paid_at', endOfLastMonth.toISOString());

  const revenueLastMonth = lastMonthPayments?.reduce(
    (sum, p) => sum + Number(p.amount_kgs),
    0
  ) || 0;

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
  return billingRepo.getOrganizationsBilling(filter, page, pageSize);
}

/**
 * Get detailed organization billing
 */
export async function getOrganizationDetail(organizationId: string) {
  const [org, subscription, invoices, payments, webhooks, auditLogs] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', organizationId).single(),
    billingRepo.getSubscriptionByOrgId(organizationId),
    billingRepo.getInvoicesByOrgId(organizationId, 50),
    billingRepo.getPaymentsByOrgId(organizationId, 50),
    billingRepo.getWebhookEventsByOrgId(organizationId, 50),
    billingRepo.getAuditLogsByOrgId(organizationId, 50),
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

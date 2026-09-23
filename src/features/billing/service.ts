/**
 * BILLING SERVICE
 *
 * Business logic for subscription billing operations.
 */

import { createClient } from '@/lib/supabase/admin';
import * as billingRepo from './repository';
import { getPaymentGateway } from './payment-gateway';
import type {
  BillingSummary,
  MarkInvoicePaidInput,
  ExtendPeriodInput,
  ChangePlanInput,
  SuspendSubscriptionInput,
  GrantSubscriptionInput,
} from './types';

const supabase = createClient();

// ============================================================================
// BUSINESS DASHBOARD QUERIES
// ============================================================================

/**
 * Get billing summary for an organization
 */
export async function getBillingSummary(
  organizationId: string
): Promise<BillingSummary | null> {
  const subscription = await billingRepo.getSubscriptionByOrgId(organizationId);

  if (!subscription) {
    return null;
  }

  // Get open invoice
  const invoices = await billingRepo.getInvoicesByOrgId(organizationId, 1);
  const nextInvoice = invoices.find((inv) => inv.status === 'pending') || null;

  // Get recent payments
  const recentPayments = await billingRepo.getPaymentsByOrgId(organizationId, 5);

  // Calculate days until due
  let daysUntilDue: number | null = null;
  let isExpiring = false;
  let isOverdue = false;

  if (subscription.current_period_end) {
    const periodEnd = new Date(subscription.current_period_end);
    const now = new Date();
    const diffTime = periodEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    daysUntilDue = diffDays;
    isExpiring = diffDays <= 7 && diffDays > 0;
    isOverdue = diffDays < 0;
  }

  return {
    subscription,
    nextInvoice,
    recentPayments,
    daysUntilDue,
    isExpiring,
    isOverdue,
  };
}

// ============================================================================
// INVOICE GENERATION
// ============================================================================

/**
 * Generate invoice for upcoming billing period
 */
export async function generateInvoice(
  organizationId: string
): Promise<string> {
  const subscription = await billingRepo.getSubscriptionByOrgId(organizationId);

  if (!subscription) {
    throw new Error('No subscription found for organization');
  }

  if (!subscription.plan_id || !subscription.plan) {
    throw new Error('Subscription has no plan assigned');
  }

  // Check if invoice already exists for this period
  const existingInvoices = await billingRepo.getInvoicesByOrgId(organizationId, 10);
  const periodStart = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : new Date();

  const hasInvoice = existingInvoices.some((inv) => {
    const invPeriodStart = new Date(inv.period_start);
    return invPeriodStart.getTime() === periodStart.getTime() && inv.status === 'pending';
  });

  if (hasInvoice) {
    throw new Error('Invoice already exists for this period');
  }

  // Generate invoice number
  const { data: invoiceNumberData, error: invoiceNumberError } = await supabase
    .rpc('generate_invoice_number', { org_id: organizationId });

  if (invoiceNumberError) {
    throw new Error(`Failed to generate invoice number: ${invoiceNumberError.message}`);
  }

  const invoiceNumber = invoiceNumberData as string;

  // Calculate period dates
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const dueDate = new Date(periodEnd);
  dueDate.setDate(dueDate.getDate() - 7); // Due 7 days before period ends

  // Generate unique request ID for Finik
  const gatewayRequestId = `inv_${organizationId.slice(0, 8)}_${Date.now()}`;

  // Create invoice
  const invoice = await billingRepo.createInvoice({
    organization_id: organizationId,
    subscription_id: subscription.id,
    invoice_number: invoiceNumber,
    amount_kgs: Number(subscription.plan.price_kgs),
    currency: 'KGS',
    period_start: periodStart,
    period_end: periodEnd,
    due_date: dueDate,
    status: 'pending',
    gateway_payment_url: null,
    gateway_qr_code_url: null,
    gateway_request_id: gatewayRequestId,
    gateway_transaction_id: null,
    paid_at: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
  });

  // Create payment via gateway
  try {
    const gateway = getPaymentGateway();
    const paymentResponse = await gateway.createPayment({
      amount: Number(subscription.plan.price_kgs),
      currency: 'KGS',
      requestId: gatewayRequestId,
      description: `${subscription.plan.name} subscription - ${invoiceNumber}`,
      customFields: {
        invoice_id: invoice.id,
        organization_id: organizationId,
      },
    });

    if (paymentResponse.success) {
      // Update invoice with payment URLs
      await billingRepo.updateInvoice(invoice.id, {
        gateway_payment_url: paymentResponse.paymentUrl,
        gateway_qr_code_url: paymentResponse.qrCodeUrl,
      });
    } else {
      console.error('[Billing] Failed to create payment:', paymentResponse.error);
    }
  } catch (error) {
    console.error('[Billing] Gateway error:', error);
    // Invoice still created, can retry payment later
  }

  return invoice.id;
}

// ============================================================================
// ADMIN ACTIONS
// ============================================================================

/**
 * Manually mark invoice as paid (admin action)
 */
export async function markInvoicePaid(input: MarkInvoicePaidInput): Promise<void> {
  if (!input.note || input.note.trim().length === 0) {
    throw new Error('Note is required when manually marking invoice paid');
  }

  const invoice = await billingRepo.getInvoiceById(input.invoice_id);

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.status === 'paid') {
    throw new Error('Invoice is already paid');
  }

  const amount = input.amount_kgs || Number(invoice.amount_kgs);

  // Update invoice
  await billingRepo.updateInvoice(invoice.id, {
    status: 'paid',
    paid_at: new Date(),
  });

  // Create payment record
  await billingRepo.createPayment({
    invoice_id: invoice.id,
    organization_id: invoice.organization_id,
    amount_kgs: amount,
    currency: invoice.currency,
    paid_via: 'manual',
    gateway_transaction_id: null,
    gateway_raw_payload: null,
    marked_paid_by: input.admin_user_id,
    admin_note: input.note,
    paid_at: new Date(),
  });

  // Extend subscription
  const subscription = await billingRepo.getSubscriptionByOrgId(invoice.organization_id);
  if (subscription) {
    await supabase.rpc('extend_subscription_period', {
      p_subscription_id: subscription.id,
      p_interval: '1 month',
    });
  }

  // Log action
  await billingRepo.createAuditLog({
    admin_user_id: input.admin_user_id,
    action: 'mark_paid',
    organization_id: invoice.organization_id,
    subscription_id: invoice.subscription_id,
    invoice_id: invoice.id,
    details: { amount, manual: true },
    note: input.note,
  });
}

/**
 * Extend subscription period (admin action)
 */
export async function extendSubscriptionPeriod(input: ExtendPeriodInput): Promise<void> {
  if (!input.note || input.note.trim().length === 0) {
    throw new Error('Note is required when extending period');
  }

  const subscription = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', input.subscription_id)
    .single();

  if (subscription.error || !subscription.data) {
    throw new Error('Subscription not found');
  }

  const interval = `${input.months} month${input.months > 1 ? 's' : ''}`;

  await supabase.rpc('extend_subscription_period', {
    p_subscription_id: input.subscription_id,
    p_interval: interval,
  });

  // Log action
  await billingRepo.createAuditLog({
    admin_user_id: input.admin_user_id,
    action: 'extend_period',
    organization_id: subscription.data.organization_id,
    subscription_id: input.subscription_id,
    invoice_id: null,
    details: { months: input.months },
    note: input.note,
  });
}

/**
 * Change subscription plan (admin action)
 */
export async function changeSubscriptionPlan(input: ChangePlanInput): Promise<void> {
  if (!input.note || input.note.trim().length === 0) {
    throw new Error('Note is required when changing plan');
  }

  const subscription = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', input.subscription_id)
    .single();

  if (subscription.error || !subscription.data) {
    throw new Error('Subscription not found');
  }

  const plan = await billingRepo.getPlanById(input.plan_id);
  if (!plan) {
    throw new Error('Plan not found');
  }

  const oldPlanId = subscription.data.plan_id;

  await billingRepo.updateSubscription(input.subscription_id, {
    plan_id: input.plan_id,
  });

  // Log action
  await billingRepo.createAuditLog({
    admin_user_id: input.admin_user_id,
    action: 'change_plan',
    organization_id: subscription.data.organization_id,
    subscription_id: input.subscription_id,
    invoice_id: null,
    details: { old_plan_id: oldPlanId, new_plan_id: input.plan_id },
    note: input.note,
  });
}

/**
 * Suspend subscription (admin action)
 */
export async function suspendSubscription(input: SuspendSubscriptionInput): Promise<void> {
  if (!input.note || input.note.trim().length === 0) {
    throw new Error('Note is required when suspending subscription');
  }

  const subscription = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', input.subscription_id)
    .single();

  if (subscription.error || !subscription.data) {
    throw new Error('Subscription not found');
  }

  await billingRepo.updateSubscription(input.subscription_id, {
    status: 'suspended',
  });

  // Log action
  await billingRepo.createAuditLog({
    admin_user_id: input.admin_user_id,
    action: 'suspend',
    organization_id: subscription.data.organization_id,
    subscription_id: input.subscription_id,
    invoice_id: null,
    details: { previous_status: subscription.data.status },
    note: input.note,
  });
}

/**
 * Reactivate subscription (admin action)
 */
export async function reactivateSubscription(
  subscriptionId: string,
  adminUserId: string,
  note: string
): Promise<void> {
  if (!note || note.trim().length === 0) {
    throw new Error('Note is required when reactivating subscription');
  }

  const subscription = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (subscription.error || !subscription.data) {
    throw new Error('Subscription not found');
  }

  await billingRepo.updateSubscription(subscriptionId, {
    status: 'active',
  });

  // Log action
  await billingRepo.createAuditLog({
    admin_user_id: adminUserId,
    action: 'reactivate',
    organization_id: subscription.data.organization_id,
    subscription_id: subscriptionId,
    invoice_id: null,
    details: { previous_status: subscription.data.status },
    note,
  });
}

/**
 * Cancel subscription (admin action)
 */
export async function cancelSubscription(
  subscriptionId: string,
  adminUserId: string,
  note: string
): Promise<void> {
  if (!note || note.trim().length === 0) {
    throw new Error('Note is required when cancelling subscription');
  }

  const subscription = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (subscription.error || !subscription.data) {
    throw new Error('Subscription not found');
  }

  await billingRepo.updateSubscription(subscriptionId, {
    status: 'cancelled',
    cancelled_at: new Date(),
  });

  // Log action
  await billingRepo.createAuditLog({
    admin_user_id: adminUserId,
    action: 'cancel',
    organization_id: subscription.data.organization_id,
    subscription_id: subscriptionId,
    invoice_id: null,
    details: { previous_status: subscription.data.status },
    note,
  });
}

/**
 * Grant subscription (admin action - gives free subscription)
 */
export async function grantSubscription(input: GrantSubscriptionInput): Promise<void> {
  if (!input.note || input.note.trim().length === 0) {
    throw new Error('Note is required when granting subscription');
  }

  const plan = await billingRepo.getPlanById(input.plan_id);
  if (!plan) {
    throw new Error('Plan not found');
  }

  const subscription = await billingRepo.getSubscriptionByOrgId(input.organization_id);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const newPeriodEnd = new Date();
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + input.months);

  await billingRepo.updateSubscription(subscription.id, {
    plan_id: input.plan_id,
    status: 'active',
    current_period_start: new Date(),
    current_period_end: newPeriodEnd,
  });

  // Log action
  await billingRepo.createAuditLog({
    admin_user_id: input.admin_user_id,
    action: 'grant_subscription',
    organization_id: input.organization_id,
    subscription_id: subscription.id,
    invoice_id: null,
    details: { plan_id: input.plan_id, months: input.months },
    note: input.note,
  });
}

/**
 * BILLING SERVICE
 *
 * Business logic for subscription billing operations.
 */

import { createAdminClient } from '@/lib/supabase/admin';
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

const supabase = createAdminClient();

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
  const invoices = await billingRepo.getInvoicesByOrgId(organizationId);
  const nextInvoice = invoices.find((inv) => inv.status === 'pending') || null;

  // Get recent payments
  const recentPayments = await billingRepo.getPaymentsByOrgId(organizationId);

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
  const existingInvoices = await billingRepo.getInvoicesByOrgId(organizationId);
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
    .rpc('generate_invoice_number' as any, { org_id: organizationId });

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
    await supabase.rpc('extend_subscription_period' as any, {
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
  // Billing tables not yet migrated
  throw new Error('Billing functionality not yet available');
}

/**
 * Change subscription plan (admin action)
 */
export async function changeSubscriptionPlan(input: ChangePlanInput): Promise<void> {
  // Billing tables not yet migrated
  throw new Error('Billing functionality not yet available');
}

/**
 * Suspend subscription (admin action)
 */
export async function suspendSubscription(input: SuspendSubscriptionInput): Promise<void> {
  // Billing tables not yet migrated
  throw new Error('Billing functionality not yet available');
}

/**
 * Reactivate subscription (admin action)
 */
export async function reactivateSubscription(
  subscriptionId: string,
  adminUserId: string,
  note: string
): Promise<void> {
  // Billing tables not yet migrated
  throw new Error('Billing functionality not yet available');
}

/**
 * Cancel subscription (admin action)
 */
export async function cancelSubscription(
  subscriptionId: string,
  adminUserId: string,
  note: string
): Promise<void> {
  // Billing tables not yet migrated
  throw new Error('Billing functionality not yet available');
}

/**
 * Grant subscription (admin action - gives free subscription)
 */
export async function grantSubscription(input: GrantSubscriptionInput): Promise<void> {
  // Billing tables not yet migrated
  throw new Error('Billing functionality not yet available');
}

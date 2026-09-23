/**
 * BILLING DOMAIN MODEL
 *
 * Types for subscription billing system.
 */

import type { OrganizationId } from '@/lib/types/common';

// ============================================================================
// ENUMS
// ============================================================================

export type SubscriptionStatus =
  | 'trial'       // Free trial period
  | 'active'      // Paid and current
  | 'past_due'    // Payment failed, in grace period
  | 'suspended'   // Grace period expired, access restricted
  | 'cancelled';  // Manually cancelled

export type InvoiceStatus =
  | 'pending'     // Awaiting payment
  | 'paid'        // Successfully paid
  | 'failed'      // Payment attempt failed
  | 'void';       // Cancelled/invalidated by admin

export type PaymentSource =
  | 'webhook'     // Automatic via gateway webhook
  | 'manual';     // Manually marked paid by admin

// ============================================================================
// PLAN
// ============================================================================

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price_kgs: number;
  interval: string;
  description: string | null;
  features: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// SUBSCRIPTION
// ============================================================================

export interface Subscription {
  id: string;
  organization_id: OrganizationId;
  plan_id: string | null;
  status: SubscriptionStatus;
  current_period_start: Date | null;
  current_period_end: Date | null;
  trial_ends_at: Date | null;
  cancelled_at: Date | null;
  grace_days: number;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionWithPlan extends Subscription {
  plan: Plan | null;
}

// ============================================================================
// INVOICE
// ============================================================================

export interface Invoice {
  id: string;
  organization_id: OrganizationId;
  subscription_id: string;
  invoice_number: string;
  amount_kgs: number;
  currency: string;
  period_start: Date;
  period_end: Date;
  due_date: Date;
  status: InvoiceStatus;
  gateway_payment_url: string | null;
  gateway_qr_code_url: string | null;
  gateway_request_id: string | null;
  gateway_transaction_id: string | null;
  paid_at: Date | null;
  voided_at: Date | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// PAYMENT
// ============================================================================

export interface Payment {
  id: string;
  invoice_id: string;
  organization_id: OrganizationId;
  amount_kgs: number;
  currency: string;
  paid_via: PaymentSource;
  gateway_transaction_id: string | null;
  gateway_raw_payload: Record<string, any> | null;
  marked_paid_by: string | null;
  admin_note: string | null;
  paid_at: Date;
  created_at: Date;
}

export interface PaymentWithInvoice extends Payment {
  invoice: Pick<Invoice, 'invoice_number' | 'period_start' | 'period_end'>;
}

// ============================================================================
// WEBHOOK EVENT
// ============================================================================

export interface WebhookEvent {
  id: string;
  provider: string;
  event_type: string | null;
  gateway_request_id: string | null;
  signature: string | null;
  signature_valid: boolean | null;
  raw_payload: Record<string, any>;
  processed: boolean;
  processed_at: Date | null;
  error_message: string | null;
  received_at: Date;
}

// ============================================================================
// ADMIN AUDIT LOG
// ============================================================================

export interface AdminAuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  organization_id: string | null;
  subscription_id: string | null;
  invoice_id: string | null;
  details: Record<string, any> | null;
  note: string | null;
  created_at: Date;
}

export interface AdminAuditLogWithAdmin extends AdminAuditLog {
  admin: {
    full_name: string;
    email: string;
  };
}

// ============================================================================
// BILLING SUMMARY (For business dashboard)
// ============================================================================

export interface BillingSummary {
  subscription: SubscriptionWithPlan;
  nextInvoice: Invoice | null;
  recentPayments: PaymentWithInvoice[];
  daysUntilDue: number | null;
  isExpiring: boolean;
  isOverdue: boolean;
}

// ============================================================================
// ADMIN DASHBOARD TYPES
// ============================================================================

export interface OrganizationBilling {
  organization_id: string;
  organization_name: string;
  owner_email: string;
  owner_name: string;
  created_at: Date;
  subscription_status: SubscriptionStatus;
  plan_name: string | null;
  plan_price: number | null;
  current_period_end: Date | null;
  days_until_due: number | null;
  last_payment_date: Date | null;
  last_payment_amount: number | null;
  last_payment_method: PaymentSource | null;
  open_invoice_id: string | null;
  open_invoice_amount: number | null;
  open_invoice_due_date: Date | null;
}

export interface AdminDashboardSummary {
  total_organizations: number;
  active_subscriptions: number;
  trial_subscriptions: number;
  past_due_subscriptions: number;
  suspended_subscriptions: number;
  expiring_soon_count: number; // Within 7 days
  overdue_count: number;
  revenue_this_month: number;
  revenue_last_month: number;
}

export interface AdminOrganizationFilter {
  status?: SubscriptionStatus;
  expiring_days?: number;  // Show expiring within N days
  overdue?: boolean;
  search?: string;         // Search by org name or owner
}

// ============================================================================
// ADMIN ACTIONS
// ============================================================================

export interface MarkInvoicePaidInput {
  invoice_id: string;
  admin_user_id: string;
  note: string;  // Required: explain why manual
  amount_kgs?: number;  // Optional: if different from invoice amount
}

export interface ExtendPeriodInput {
  subscription_id: string;
  admin_user_id: string;
  months: number;
  note: string;  // Required: explain why extending
}

export interface ChangePlanInput {
  subscription_id: string;
  plan_id: string;
  admin_user_id: string;
  note: string;  // Required: explain reason
}

export interface SuspendSubscriptionInput {
  subscription_id: string;
  admin_user_id: string;
  note: string;  // Required: explain reason
}

export interface GrantSubscriptionInput {
  organization_id: string;
  plan_id: string;
  months: number;  // How many months to grant
  admin_user_id: string;
  note: string;  // Required: explain reason
}

/**
 * BILLING REPOSITORY
 *
 * Data access layer for billing operations.
 * Uses Supabase client (service-role for admin operations).
 *
 * NOTE: Billing tables not yet migrated - all functions return empty/null data
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/database.types';
import type {
  Plan,
  Subscription,
  SubscriptionWithPlan,
  Invoice,
  Payment,
  PaymentWithInvoice,
  WebhookEvent,
  AdminAuditLog,
  OrganizationBilling,
  AdminOrganizationFilter,
} from './types';

type SupabaseClient = ReturnType<typeof createAdminClient>;

// ============================================================================
// PLANS
// ============================================================================

export async function getActivePlans(): Promise<Plan[]> {
  return [];
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  return null;
}

export async function getPlanBySlug(slug: string): Promise<Plan | null> {
  return null;
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export async function getSubscriptionByOrgId(
  orgId: string
): Promise<SubscriptionWithPlan | null> {
  return null;
}

export async function updateSubscription(
  subscriptionId: string,
  updates: Partial<Subscription>
): Promise<void> {
  // No-op
}

// ============================================================================
// INVOICES
// ============================================================================

export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  return null;
}

export async function getInvoiceByGatewayRequestId(
  requestId: string
): Promise<Invoice | null> {
  return null;
}

export async function getInvoicesByOrgId(
  organizationId: string
): Promise<Invoice[]> {
  return [];
}

export async function getPendingInvoices(): Promise<Invoice[]> {
  return [];
}

export async function createInvoice(invoice: any): Promise<Invoice> {
  throw new Error('Billing tables not yet migrated');
}

export async function updateInvoice(
  invoiceId: string,
  updates: Partial<Invoice>
): Promise<void> {
  // No-op
}

// ============================================================================
// PAYMENTS
// ============================================================================

export async function createPayment(payment: any): Promise<Payment> {
  throw new Error('Billing tables not yet migrated');
}

export async function getPaymentsByOrgId(
  organizationId: string
): Promise<PaymentWithInvoice[]> {
  return [];
}

// ============================================================================
// WEBHOOK EVENTS
// ============================================================================

export async function createWebhookEvent(event: any): Promise<WebhookEvent> {
  throw new Error('Billing tables not yet migrated');
}

export async function updateWebhookEvent(
  eventId: string,
  updates: Partial<WebhookEvent>
): Promise<void> {
  // No-op
}

export async function getWebhookEventsByOrgId(
  organizationId: string
): Promise<WebhookEvent[]> {
  return [];
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export async function createAuditLog(log: any): Promise<void> {
  // No-op
}

export async function getAuditLogsByOrgId(
  organizationId: string
): Promise<AdminAuditLog[]> {
  return [];
}

// ============================================================================
// ADMIN - ORGANIZATION BILLING
// ============================================================================

export async function getOrganizationsBilling(
  filters: AdminOrganizationFilter,
  page: number = 1,
  limit: number = 50
): Promise<{ data: OrganizationBilling[]; total: number }> {
  return { data: [], total: 0 };
}

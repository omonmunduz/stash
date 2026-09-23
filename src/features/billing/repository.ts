/**
 * BILLING REPOSITORY
 *
 * Data access layer for billing operations.
 * Uses Supabase client (service-role for admin operations).
 */

import { createClient } from '@/lib/supabase/admin';
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

type SupabaseClient = ReturnType<typeof createClient>;

// ============================================================================
// PLANS
// ============================================================================

export async function getActivePlans(): Promise<Plan[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price_kgs', { ascending: true });

  if (error) throw error;
  return data as Plan[];
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as Plan;
}

export async function getPlanBySlug(slug: string): Promise<Plan | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Plan;
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export async function getSubscriptionByOrgId(
  organizationId: string
): Promise<SubscriptionWithPlan | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:plans(*)
    `)
    .eq('organization_id', organizationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return {
    ...data,
    plan: data.plan || null,
  } as SubscriptionWithPlan;
}

export async function updateSubscription(
  subscriptionId: string,
  updates: Partial<Subscription>
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', subscriptionId);

  if (error) throw error;
}

// ============================================================================
// INVOICES
// ============================================================================

export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Invoice;
}

export async function getInvoiceByGatewayRequestId(
  gatewayRequestId: string
): Promise<Invoice | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('gateway_request_id', gatewayRequestId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Invoice;
}

export async function getInvoicesByOrgId(
  organizationId: string,
  limit = 10
): Promise<Invoice[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Invoice[];
}

export async function getPendingInvoices(): Promise<Invoice[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('status', 'pending')
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data as Invoice[];
}

export async function createInvoice(
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>
): Promise<Invoice> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('invoices')
    .insert(invoice)
    .select()
    .single();

  if (error) throw error;
  return data as Invoice;
}

export async function updateInvoice(
  invoiceId: string,
  updates: Partial<Invoice>
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', invoiceId);

  if (error) throw error;
}

// ============================================================================
// PAYMENTS
// ============================================================================

export async function createPayment(
  payment: Omit<Payment, 'id' | 'created_at'>
): Promise<Payment> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('payments')
    .insert(payment)
    .select()
    .single();

  if (error) throw error;
  return data as Payment;
}

export async function getPaymentsByOrgId(
  organizationId: string,
  limit = 10
): Promise<PaymentWithInvoice[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      invoice:invoices(invoice_number, period_start, period_end)
    `)
    .eq('organization_id', organizationId)
    .order('paid_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as PaymentWithInvoice[];
}

// ============================================================================
// WEBHOOK EVENTS
// ============================================================================

export async function createWebhookEvent(
  event: Omit<WebhookEvent, 'id' | 'received_at'>
): Promise<WebhookEvent> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('webhook_events')
    .insert(event)
    .select()
    .single();

  if (error) throw error;
  return data as WebhookEvent;
}

export async function updateWebhookEvent(
  eventId: string,
  updates: Partial<WebhookEvent>
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('webhook_events')
    .update(updates)
    .eq('id', eventId);

  if (error) throw error;
}

export async function getWebhookEventsByOrgId(
  organizationId: string,
  limit = 50
): Promise<WebhookEvent[]> {
  const supabase = createClient();

  // Get webhook events for this org's invoices
  const { data, error } = await supabase
    .from('webhook_events')
    .select(`
      *,
      invoices!inner(organization_id)
    `)
    .eq('invoices.organization_id', organizationId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as WebhookEvent[];
}

// ============================================================================
// ADMIN AUDIT LOG
// ============================================================================

export async function createAuditLog(
  log: Omit<AdminAuditLog, 'id' | 'created_at'>
): Promise<AdminAuditLog> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('admin_audit_log')
    .insert(log)
    .select()
    .single();

  if (error) throw error;
  return data as AdminAuditLog;
}

export async function getAuditLogsByOrgId(
  organizationId: string,
  limit = 50
): Promise<AdminAuditLog[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as AdminAuditLog[];
}

// ============================================================================
// ADMIN DASHBOARD QUERIES
// ============================================================================

export async function getOrganizationsBilling(
  filter?: AdminOrganizationFilter,
  page = 1,
  pageSize = 100
): Promise<{ data: OrganizationBilling[]; total: number }> {
  const supabase = createClient();

  let query = supabase
    .from('organizations')
    .select(`
      id,
      name,
      created_at,
      subscription_status,
      current_period_end,
      subscriptions!inner (
        id,
        status,
        plan_id,
        current_period_end,
        plans (
          name,
          price_kgs
        )
      ),
      user_profiles!inner (
        full_name,
        email,
        role
      )
    `, { count: 'exact' })
    .eq('user_profiles.role', 'owner')
    .is('deleted_at', null);

  // Apply filters
  if (filter?.status) {
    query = query.eq('subscription_status', filter.status);
  }

  if (filter?.overdue) {
    query = query.lt('current_period_end', new Date().toISOString());
  }

  if (filter?.expiring_days) {
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + filter.expiring_days);
    query = query
      .lte('current_period_end', expiringDate.toISOString())
      .gte('current_period_end', new Date().toISOString());
  }

  if (filter?.search) {
    query = query.or(`name.ilike.%${filter.search}%,user_profiles.email.ilike.%${filter.search}%`);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  // Transform data
  const organizations: OrganizationBilling[] = (data || []).map((org: any) => {
    const owner = org.user_profiles[0];
    const subscription = org.subscriptions[0];
    const plan = subscription?.plans;

    const currentPeriodEnd = subscription?.current_period_end
      ? new Date(subscription.current_period_end)
      : null;

    const daysUntilDue = currentPeriodEnd
      ? Math.ceil((currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      organization_id: org.id,
      organization_name: org.name,
      owner_email: owner?.email || '',
      owner_name: owner?.full_name || '',
      created_at: new Date(org.created_at),
      subscription_status: org.subscription_status,
      plan_name: plan?.name || null,
      plan_price: plan?.price_kgs || null,
      current_period_end: currentPeriodEnd,
      days_until_due: daysUntilDue,
      last_payment_date: null, // TODO: Join with payments
      last_payment_amount: null,
      last_payment_method: null,
      open_invoice_id: null, // TODO: Join with invoices
      open_invoice_amount: null,
      open_invoice_due_date: null,
    };
  });

  return {
    data: organizations,
    total: count || 0,
  };
}

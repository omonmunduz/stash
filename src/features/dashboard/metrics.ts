/**
 * DASHBOARD METRICS (server-only reads)
 *
 * Aggregates for the home screen, spanning customers, sales, inventory, and
 * expenses.
 *
 * Why a dashboard feature rather than calls into six repositories: the home
 * screen's questions ("what am I owed", "what sold this month") cut across
 * features, and most of those repositories are still interfaces with no
 * implementation. A read-only module that owns its own queries can ship now and
 * be refactored onto the repositories as each one lands, without the dashboard
 * blocking on all of them.
 *
 * Every query is scoped by organization_id in addition to RLS, and every one is
 * resilient: a failure returns a null metric rather than throwing, so one broken
 * card cannot blank the whole page.
 */

import { createClient } from '@/lib/supabase/server';
import type { OrganizationId } from '@/lib/types/common';

export interface DashboardMetrics {
  /** Total owed across all customers. null when the query failed. */
  totalReceivable: number | null;
  /** How many customers currently owe money. */
  customersInDebt: number | null;
  /** Total active customers. */
  customerCount: number | null;
  /** The largest debts, for the "chase these" list. */
  topDebtors: Array<{
    id: string;
    name: string;
    business_name: string | null;
    current_balance: number;
    credit_limit: number | null;
  }>;
  /** Completed sales in the current calendar month. */
  salesThisMonth: { count: number; total: number } | null;
  /**
   * Products with zero stock.
   *
   * Not "low stock": the schema has no reorder_level column, so there is no
   * per-product threshold to compare against. Zero is the only stock signal the
   * data actually supports today. A threshold column is Phase 2.
   */
  outOfStockCount: number | null;
  /** Expenses recorded in the current calendar month. */
  expensesThisMonth: number | null;
  /** Row counts used to drive the setup checklist. */
  setup: {
    hasProducts: boolean;
    hasCustomers: boolean;
    hasSales: boolean;
  };
}

/**
 * First day of the current month as a date string.
 *
 * Built from local date parts rather than toISOString(), which would convert to
 * UTC and, for anyone east of Greenwich, shift the first of the month into the
 * previous one.
 */
function startOfMonth(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}-01`;
}

export async function getDashboardMetrics(
  organizationId: OrganizationId
): Promise<DashboardMetrics> {
  const supabase = await createClient();
  const monthStart = startOfMonth();

  // All independent — run concurrently. Promise.all is safe here because every
  // Supabase query resolves with an { data, error } shape rather than rejecting.
  const [
    customersResult,
    topDebtorsResult,
    salesResult,
    inventoryResult,
    expensesResult,
    productCountResult,
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('current_balance')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .eq('is_active', true),

    supabase
      .from('customers')
      .select('id,name,business_name,current_balance,credit_limit')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .gt('current_balance', 0)
      .order('current_balance', { ascending: false })
      .limit(5),

    supabase
      .from('sales')
      .select('total')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .gte('sale_date', monthStart),

    // head:true — only the count matters, so don't ship the rows over the wire.
    //
    // Scoped to rows that count a product. Since 20260803000001 the inventory
    // table also holds non-sellable items (bags, packaging), and this figure is
    // labelled as products out of stock on the home screen — counting an empty box
    // of carrier bags among them would make the number mean nothing.
    supabase
      .from('inventory')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .not('product_id', 'is', null)
      .eq('quantity_on_hand', 0),

    supabase
      .from('expenses')
      .select('amount')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .gte('expense_date', monthStart),

    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null),
  ]);

  const customers = customersResult.error ? null : (customersResult.data ?? []);

  const totalReceivable = customers
    ? customers.reduce((sum, row) => sum + Math.max(0, row.current_balance ?? 0), 0)
    : null;

  const customersInDebt = customers
    ? customers.filter((row) => (row.current_balance ?? 0) > 0).length
    : null;

  const sales = salesResult.error ? null : (salesResult.data ?? []);

  const outOfStockCount = inventoryResult.error ? null : (inventoryResult.count ?? 0);

  const expenses = expensesResult.error ? null : (expensesResult.data ?? []);

  return {
    totalReceivable,
    customersInDebt,
    customerCount: customers?.length ?? null,
    topDebtors: topDebtorsResult.error
      ? []
      : (topDebtorsResult.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          business_name: row.business_name,
          current_balance: row.current_balance ?? 0,
          credit_limit: row.credit_limit,
        })),
    salesThisMonth: sales
      ? {
          count: sales.length,
          total: sales.reduce((sum, row) => sum + (row.total ?? 0), 0),
        }
      : null,
    outOfStockCount,
    expensesThisMonth: expenses
      ? expenses.reduce((sum, row) => sum + (row.amount ?? 0), 0)
      : null,
    setup: {
      hasProducts: (productCountResult.count ?? 0) > 0,
      hasCustomers: (customers?.length ?? 0) > 0,
      hasSales: (sales?.length ?? 0) > 0,
    },
  };
}

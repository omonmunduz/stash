/**
 * CUSTOMER MAPPER
 *
 * Converts between Supabase row types and domain Customer types.
 *
 * Why this exists:
 * - The database returns ISO 8601 strings; the domain uses Date objects
 * - Schema columns are nullable for DB flexibility; domain types are strict
 * - Supabase generated types use `number | null`; Money is just `number`
 * - Branded IDs live only in the domain layer, not in the database types
 *
 * Every repository read passes through here. This is the only place that knows
 * the DB schema diverges from the domain model.
 */

import type { Database } from '@/lib/database.types';
import type { Customer, CustomerDebtSummary } from './types';
import { brandId } from '@/lib/types/common';

type CustomerRow = Database['public']['Tables']['customers']['Row'];

/**
 * Map a database row to a domain Customer.
 *
 * Defensive: applies defaults for nullable columns that should never be null
 * in practice (is_active defaults to true in the schema, current_balance
 * defaults to 0). If they somehow ARE null, the app degrades gracefully rather
 * than crashing on a `.toFixed()` call three layers up.
 */
export function mapCustomer(row: CustomerRow): Customer {
  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    customer_code: row.customer_code,
    name: row.name,
    business_name: row.business_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    credit_limit: row.credit_limit,
    current_balance: row.current_balance ?? 0,
    notes: row.notes,
    is_active: row.is_active ?? true,
    created_at: new Date(row.created_at!),
    updated_at: new Date(row.updated_at!),
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    created_by: row.created_by ? brandId(row.created_by) : null,
  };
}

/**
 * Map a database row with aggregated debt metadata to CustomerDebtSummary.
 *
 * The aggregates come from a separate query — not a join — so the mapper
 * receives both the base row and the computed fields.
 */
export function mapCustomerDebtSummary(
  row: CustomerRow,
  aggregates: {
    open_sales_count: number;
    total_outstanding: number;
    last_sale_date: string | null;
    last_payment_date: string | null;
  }
): CustomerDebtSummary {
  return {
    ...mapCustomer(row),
    open_sales_count: aggregates.open_sales_count,
    total_outstanding: aggregates.total_outstanding,
    last_sale_date: aggregates.last_sale_date ? new Date(aggregates.last_sale_date) : null,
    last_payment_date: aggregates.last_payment_date ? new Date(aggregates.last_payment_date) : null,
  };
}

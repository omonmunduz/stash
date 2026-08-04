/**
 * EXPENSE MAPPER
 *
 * Converts Supabase rows to the domain Expense type.
 *
 * expense_date is a DATE column, so it arrives as 'yyyy-mm-dd'. Passing that
 * string straight to `new Date()` parses it as UTC midnight, which renders as the
 * previous day for anyone west of Greenwich — an expense entered on the 3rd
 * showing up under the 2nd. The parts are split out and handed to the local-time
 * constructor instead.
 */

import type { Database } from '@/lib/database.types';
import type { Expense } from './types';
import type { PaymentMethod } from '@/features/payments/types';
import { brandId } from '@/lib/types/common';

type ExpenseRow = Database['public']['Tables']['expenses']['Row'];

export function mapExpense(row: ExpenseRow): Expense {
  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    expense_number: row.expense_number,
    expense_date: parseDateOnly(row.expense_date),
    category: row.category,
    vendor: row.vendor,
    amount: row.amount,
    payment_method: row.payment_method as PaymentMethod,
    description: row.description,
    receipt_url: row.receipt_url,
    created_at: new Date(row.created_at!),
    updated_at: new Date(row.updated_at!),
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    created_by: row.created_by ? brandId(row.created_by) : null,
  };
}

/** 'yyyy-mm-dd' → local midnight. See the note at the top of this file. */
function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

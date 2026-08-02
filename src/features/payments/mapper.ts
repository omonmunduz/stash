/**
 * PAYMENT MAPPER
 *
 * Converts Supabase rows to domain Payment/PaymentAllocation types.
 */

import type { Database } from '@/lib/database.types';
import type { Payment, PaymentAllocation, PaymentMethod } from './types';
import { brandId } from '@/lib/types/common';

type PaymentRow = Database['public']['Tables']['payments']['Row'];
type AllocationRow = Database['public']['Tables']['payment_allocations']['Row'];

export function mapPayment(row: PaymentRow): Payment {
  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    payment_number: row.payment_number,
    customer_id: brandId(row.customer_id),
    payment_date: new Date(row.payment_date),
    amount: row.amount,
    payment_method: row.payment_method as PaymentMethod,
    reference_number: row.reference_number,
    notes: row.notes,
    created_at: new Date(row.created_at!),
    updated_at: new Date(row.updated_at!),
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    created_by: row.created_by ? brandId(row.created_by) : null,
  };
}

export function mapPaymentAllocation(row: AllocationRow): PaymentAllocation {
  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    payment_id: brandId(row.payment_id),
    sale_id: brandId(row.sale_id),
    amount: row.amount,
    created_at: new Date(row.created_at!),
  };
}

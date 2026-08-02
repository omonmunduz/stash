/**
 * SALE MAPPER
 *
 * Converts Supabase row types to domain Sale/SaleItem types.
 *
 * Same responsibilities as the customer mapper: ISO strings → Date objects,
 * nullable DB columns → strict domain types, branded IDs.
 */

import type { Database } from '@/lib/database.types';
import type { Sale, SaleItem, SaleStatus, SalePaymentStatus } from './types';
import { brandId } from '@/lib/types/common';

type SaleRow = Database['public']['Tables']['sales']['Row'];
type SaleItemRow = Database['public']['Tables']['sale_items']['Row'];

/**
 * Map a database sale row to the domain Sale type.
 *
 * Defensive defaults: subtotal/tax/discount/total/amount_paid/amount_due all
 * default to 0 if somehow null (they have DB defaults, so null should never
 * happen in practice, but runtime safety beats assumptions).
 */
export function mapSale(row: SaleRow): Sale {
  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    sale_number: row.sale_number,
    customer_id: brandId(row.customer_id),
    sale_date: new Date(row.sale_date),
    due_date: row.due_date ? new Date(row.due_date) : null,
    status: row.status as SaleStatus,
    subtotal: row.subtotal ?? 0,
    tax: row.tax ?? 0,
    discount: row.discount ?? 0,
    total: row.total ?? 0,
    amount_paid: row.amount_paid ?? 0,
    amount_due: row.amount_due ?? 0,
    payment_status: row.payment_status as SalePaymentStatus,
    notes: row.notes,
    created_at: new Date(row.created_at!),
    updated_at: new Date(row.updated_at!),
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : null,
    created_by: row.created_by ? brandId(row.created_by) : null,
  };
}

/**
 * Map a sale_items row to the domain SaleItem type.
 */
export function mapSaleItem(row: SaleItemRow): SaleItem {
  return {
    id: brandId(row.id),
    organization_id: brandId(row.organization_id),
    sale_id: brandId(row.sale_id),
    product_id: brandId(row.product_id),
    product_name: row.product_name,
    product_sku: row.product_sku ?? '',
    quantity: row.quantity,
    unit_price: row.unit_price,
    cost_price: row.cost_price ?? 0,
    discount: row.discount ?? 0,
    subtotal: row.subtotal,
    created_at: new Date(row.created_at!),
  };
}

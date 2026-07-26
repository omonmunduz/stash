/**
 * CUSTOMER DOMAIN MODEL
 *
 * Customers are the businesses or individuals who buy products on credit.
 * The most important concept here is the balance — how much a customer
 * currently owes — and the credit limit — how much they are allowed to owe.
 *
 * Design decisions:
 * - credit_limit is nullable: null means no limit is enforced
 * - current_balance is denormalized for performance (updated by DB triggers)
 * - customer_code is a human-readable ID (CUST-0001) for staff use
 * - All contact fields are optional — the minimum to start is just a name
 */

import type {
  CustomerId,
  OrganizationId,
  UserId,
  Timestamps,
  Auditable,
  Money,
} from '@/lib/types/common';

export interface Customer extends Timestamps, Auditable {
  id: CustomerId;
  organization_id: OrganizationId;

  /** Human-readable code like CUST-0001. Unique per organization. */
  customer_code: string;

  /** Person or business name */
  name: string;

  /** Optional trading name (e.g. "Ahmed's Grocery" when name is "Ahmed Hassan") */
  business_name: string | null;

  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;

  /**
   * Maximum amount this customer may owe at one time.
   * null means no limit is enforced.
   */
  credit_limit: Money | null;

  /**
   * Denormalized: total amount currently owed across all unpaid/partial sales.
   * Kept in sync by database triggers. Do NOT update manually.
   */
  current_balance: Money;

  notes: string | null;
  is_active: boolean;
}

/** Input for creating a new customer */
export interface CreateCustomerInput {
  name: string;
  business_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  credit_limit?: Money;
  notes?: string;
  /** Auto-generated if omitted */
  customer_code?: string;
}

/** Input for updating an existing customer */
export interface UpdateCustomerInput {
  name?: string;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  credit_limit?: Money | null;
  notes?: string | null;
  is_active?: boolean;
}

/** Filter parameters for querying customers */
export interface CustomerFilter {
  organization_id: OrganizationId;
  is_active?: boolean;
  /** Filter to customers who have an outstanding balance */
  has_balance?: boolean;
  /** Full-text search across name, business_name, phone */
  search?: string;
}

/** Customer with a summary of their debt situation */
export interface CustomerDebtSummary extends Customer {
  /** Number of sales that are unpaid or partially paid */
  open_sales_count: number;
  /** Total value of all outstanding sales */
  total_outstanding: Money;
  /** Most recent sale date */
  last_sale_date: Date | null;
  /** Most recent payment date */
  last_payment_date: Date | null;
}

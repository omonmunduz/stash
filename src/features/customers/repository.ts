/**
 * CUSTOMER REPOSITORY INTERFACE
 */

import type {
  Customer,
  CustomerDebtSummary,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerFilter,
} from './types';
import type { CustomerId, OrganizationId, Money } from '@/lib/types/common';

export interface CustomerRepository {
  /** Find customer by ID. Returns null if not found or soft-deleted. */
  findById(id: CustomerId): Promise<Customer | null>;

  /** Find customer by their human-readable code (CUST-0001). */
  findByCode(code: string, organizationId: OrganizationId): Promise<Customer | null>;

  /** List all customers in an organization with optional filtering. */
  findAll(filter: CustomerFilter): Promise<Customer[]>;

  /**
   * Find customers with outstanding balances — for accounts receivable report.
   * Returns customers who have current_balance > 0, ordered by balance descending.
   */
  findWithBalance(organizationId: OrganizationId): Promise<CustomerDebtSummary[]>;

  /** Create a new customer. customer_code is auto-generated if not provided. */
  create(organizationId: OrganizationId, input: CreateCustomerInput): Promise<Customer>;

  /** Update customer details. */
  update(id: CustomerId, input: UpdateCustomerInput): Promise<Customer>;

  /** Soft-delete a customer. Fails if customer has open sales (amount_due > 0). */
  delete(id: CustomerId): Promise<void>;

  /**
   * Get the next available sequence number for customer_code generation.
   * Used by business rules to generate CUST-NNNN codes.
   */
  getNextSequenceNumber(organizationId: OrganizationId): Promise<number>;

  /**
   * Directly update a customer's current_balance.
   * Called by server-side logic when triggers are bypassed (e.g. bulk operations).
   * Under normal operation, triggers handle this automatically.
   */
  updateBalance(id: CustomerId, newBalance: Money): Promise<void>;

  /**
   * Search customers by name, business_name, or phone for quick-select dropdowns.
   * Returns lightweight results for performance.
   */
  search(
    organizationId: OrganizationId,
    query: string,
    limit?: number
  ): Promise<Pick<Customer, 'id' | 'customer_code' | 'name' | 'business_name' | 'current_balance' | 'credit_limit'>[]>;
}

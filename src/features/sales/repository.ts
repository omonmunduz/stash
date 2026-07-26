/**
 * SALE REPOSITORY INTERFACE
 *
 * Data access for sales and sale items.
 * Both entities live in the same repository because sale items
 * are always accessed through their parent sale.
 */

import type {
  Sale,
  SaleItem,
  SaleWithItems,
  SaleWithDetails,
  CreateSaleInput,
  AddSaleItemInput,
  UpdateSaleInput,
  SaleFilter,
} from './types';
import type { SaleId, SaleItemId, OrganizationId, Money } from '@/lib/types/common';

export interface SaleRepository {
  /** Find a sale by ID. Returns null if not found or soft-deleted. */
  findById(id: SaleId): Promise<Sale | null>;

  /** Find a sale with all its line items. Most common query. */
  findWithItems(id: SaleId): Promise<SaleWithItems | null>;

  /** Find a sale with items, customer, and all payments. Used for invoice view. */
  findWithDetails(id: SaleId): Promise<SaleWithDetails | null>;

  /** List sales with optional filtering. */
  findAll(filter: SaleFilter): Promise<Sale[]>;

  /**
   * Sum revenue for a period (total of completed sales).
   * Used in financial reports.
   */
  sumRevenueForPeriod(organizationId: OrganizationId, from: Date, to: Date): Promise<Money>;

  /**
   * Create a new sale in 'draft' status.
   * Items are added separately via addItem().
   */
  create(organizationId: OrganizationId, input: CreateSaleInput): Promise<Sale>;

  /** Update sale-level fields (notes, due_date, tax, discount). */
  update(id: SaleId, input: UpdateSaleInput): Promise<Sale>;

  /** Add a line item to a draft sale. Triggers sale total recalculation. */
  addItem(saleId: SaleId, organizationId: OrganizationId, input: AddSaleItemInput): Promise<SaleItem>;

  /** Update a line item's quantity, price, or discount. */
  updateItem(itemId: SaleItemId, updates: Partial<Pick<SaleItem, 'quantity' | 'unit_price' | 'discount'>>): Promise<SaleItem>;

  /** Remove a line item from a draft sale. */
  removeItem(itemId: SaleItemId): Promise<void>;

  /**
   * Mark sale as 'completed'.
   * DB trigger deducts inventory and updates customer balance.
   * Fails if sale has no items or is already completed/cancelled.
   */
  complete(id: SaleId): Promise<Sale>;

  /**
   * Mark sale as 'cancelled'.
   * If sale was completed, DB trigger restores inventory.
   */
  cancel(id: SaleId): Promise<Sale>;

  /** Soft-delete a sale. Only allowed on draft sales. */
  delete(id: SaleId): Promise<void>;

  /** Get the next sequence number for sale_number generation. */
  getNextSequenceNumber(organizationId: OrganizationId, year?: number): Promise<number>;
}

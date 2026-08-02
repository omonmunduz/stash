/**
 * Shared type utilities used across all domain models
 */

/**
 * Result type for operations that can fail
 * Forces explicit error handling instead of throwing exceptions
 */
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Branded type utility for creating nominal types
 * Prevents accidentally mixing IDs of different entities
 */
export type Brand<K, T> = K & { __brand: T };

/**
 * Entity ID types - branded to prevent mixing
 */
export type OrganizationId = Brand<string, 'OrganizationId'>;
export type UserId = Brand<string, 'UserId'>;
export type CustomerId = Brand<string, 'CustomerId'>;
export type ProductId = Brand<string, 'ProductId'>;
export type InventoryId = Brand<string, 'InventoryId'>;
export type SaleId = Brand<string, 'SaleId'>;
export type SaleItemId = Brand<string, 'SaleItemId'>;
export type PaymentId = Brand<string, 'PaymentId'>;
export type PaymentAllocationId = Brand<string, 'PaymentAllocationId'>;
export type ExpenseId = Brand<string, 'ExpenseId'>;

/**
 * Helper to create branded ID
 */
export function brandId<T>(id: string): Brand<string, T> {
  return id as Brand<string, T>;
}

/**
 * Helper to extract raw string from branded ID
 */
export function unbrandId<T>(id: Brand<string, T>): string {
  return id as string;
}

/**
 * Common timestamp fields for all entities
 */
export interface Timestamps {
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * Entities that track who created/updated them
 */
export interface Auditable {
  created_by: UserId | null;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Filter base for all entities
 */
export interface BaseFilter {
  organization_id: OrganizationId;
  include_deleted?: boolean;
}

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Common sort parameters
 */
export interface SortParams {
  field: string;
  direction: SortDirection;
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result with detailed errors
 */
export type ValidationResult = Result<void, ValidationError[]>;

/**
 * Money amount (always in organization's currency)
 * Using number for simplicity, consider decimal.js for production
 */
export type Money = number;

/**
 * Quantity (can be decimal for weight-based products)
 */
export type Quantity = number;

/**
 * Helper to format money
 */
export function formatMoney(amount: Money, currency: string = 'KGS'): string {
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Helper to format quantity
 */
export function formatQuantity(qty: Quantity, decimals: number = 2): string {
  return qty.toFixed(decimals);
}

/**
 * INVENTORY SERVER ACTIONS
 *
 * The write surface for stock. Client components call these; they never import
 * the repository or hold a Supabase client.
 *
 * Same conventions as src/app/actions/products.ts:
 * - Return Result<T> instead of throwing, so forms can render errors inline
 * - redirect() sits outside any try block, because it throws internally
 * - revalidatePath() after every write, since the pages are Server Components
 *
 * Every action here is manager-or-above, matching adjust_inventory's own role
 * check and inventory_items_insert_manager_or_above. The check is repeated
 * client-side of the database purely so the user gets a sentence instead of a
 * raised Postgres exception — the RPC is the boundary that actually holds.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getInventoryService } from '@/features/inventory/server';
import { toSubjectRef } from '@/features/inventory/refs';
import type { SubjectKind } from '@/features/inventory/refs';
import { requireRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import type { Inventory, InventoryItem } from '@/features/inventory/types';
import type { Result } from '@/lib/types/common';
import { brandId } from '@/lib/types/common';

/**
 * Re-exported so client forms can import the kind alongside the actions they call,
 * without reaching into the feature for a one-word type.
 */
export type { SubjectKind } from '@/features/inventory/refs';

/** Fields the adjust form submits. Strings, as they arrive from inputs. */
export interface AdjustStockFormValues {
  kind: SubjectKind;
  id: string;
  /**
   * Unsigned magnitude from the number input. The sign comes from `direction`
   * rather than from the user typing a minus, because "-5" in a quantity box is
   * easy to fumble and impossible to read back with confidence.
   */
  quantity?: string;
  direction: 'in' | 'out';
  reason: string;
  notes?: string;
}

/** Fields the recount form submits. */
export interface SetCountFormValues {
  kind: SubjectKind;
  id: string;
  /** The absolute counted figure. */
  counted?: string;
  notes?: string;
}

/** Fields the item create/edit form submits. */
export interface InventoryItemFormValues {
  name: string;
  /** Blank means "generate one". */
  item_code?: string;
  description?: string;
  category?: string;
  unit_of_measure?: string;
  /** Raw text from number inputs. */
  cost_price?: string;
  /** Blank means no low-stock warning configured, which is not the same as zero. */
  reorder_level?: string;
  /** Opening stock. Create only. */
  initial_quantity?: string;
}

// ── Input normalization ───────────────────────────────────────────────────────

/** Blank text inputs arrive as '' rather than undefined; '' would be stored instead of null. */
function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Parse a number input.
 *
 * NaN is returned rather than thrown so the caller can name the field — Zod's
 * message for a failed coercion is not one a shop owner can act on.
 */
function num(value: string | undefined): number | undefined {
  const trimmed = text(value);
  return trimmed === undefined ? undefined : Number(trimmed);
}

function numericError(label: string, value: number | undefined): string | null {
  return typeof value === 'number' && Number.isNaN(value)
    ? `${label} must be a number.`
    : null;
}

/** Where to send revalidation after a stock change. */
function revalidateStock(kind: SubjectKind, id: string) {
  revalidatePath(ROUTES.inventory.list);
  revalidatePath(ROUTES.inventory.adjust(kind, id));
  // The product list shows quantity_on_hand, so it goes stale too.
  revalidatePath(ROUTES.products.list);
  revalidatePath(ROUTES.dashboard.home);
}

// ── Moving stock ──────────────────────────────────────────────────────────────

/**
 * Apply a signed adjustment: a delivery arriving, damage, a loss, a return.
 *
 * The magnitude and direction are combined into one signed delta here. The
 * database refuses to take stock below zero and names what is actually on the
 * shelf when it does, so no pre-check is attempted — a check followed by a write
 * would be wrong the moment two people adjust at once, which is exactly what the
 * RPC's row lock exists to handle.
 */
export async function adjustStockAction(
  values: AdjustStockFormValues
): Promise<Result<Inventory>> {
  const { service, user } = await getInventoryService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const quantity = num(values.quantity);

  const invalid = numericError('Quantity', quantity);
  if (invalid) return { success: false, error: invalid };

  if (quantity === undefined) {
    return { success: false, error: 'Enter how much stock came in or went out.' };
  }

  if (quantity <= 0) {
    return {
      success: false,
      error: 'Enter a quantity greater than zero, then choose whether it came in or went out.',
    };
  }

  const result = await service.adjust({
    ref: toSubjectRef(values.kind, values.id),
    delta: values.direction === 'out' ? -quantity : quantity,
    reason: values.reason,
    notes: text(values.notes),
  });

  if (!result.success) return result;

  revalidateStock(values.kind, values.id);
  return result;
}

/**
 * Correct stock to a physically counted figure.
 *
 * Separate from adjustStockAction because a recount produces an absolute number,
 * not a delta. Sending the difference from here would mean reading the current
 * quantity in one request and writing in another, silently discarding anything
 * recorded in between; set_inventory_count derives the delta under the row lock
 * that applies it.
 */
export async function setCountAction(
  values: SetCountFormValues
): Promise<Result<Inventory>> {
  const { service, user } = await getInventoryService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const counted = num(values.counted);

  const invalid = numericError('Counted quantity', counted);
  if (invalid) return { success: false, error: invalid };

  if (counted === undefined) {
    return { success: false, error: 'Enter the quantity you counted.' };
  }

  const result = await service.setCount({
    ref: toSubjectRef(values.kind, values.id),
    counted,
    notes: text(values.notes),
  });

  if (!result.success) return result;

  revalidateStock(values.kind, values.id);
  return result;
}

// ── The item catalogue ────────────────────────────────────────────────────────

/** Shared normalization for the item create and edit forms. */
function normalizeItem(values: InventoryItemFormValues) {
  return {
    name: values.name?.trim() ?? '',
    item_code: text(values.item_code),
    description: text(values.description),
    category: text(values.category),
    unit_of_measure: text(values.unit_of_measure) ?? 'unit',
    cost_price: num(values.cost_price),
    reorder_level: num(values.reorder_level),
    initial_quantity: num(values.initial_quantity),
  };
}

const ITEM_NUMERIC_LABELS: Array<[keyof ReturnType<typeof normalizeItem>, string]> = [
  ['cost_price', 'Cost price'],
  ['reorder_level', 'Reorder level'],
  ['initial_quantity', 'Opening stock'],
];

function firstItemNumericError(input: ReturnType<typeof normalizeItem>): string | null {
  for (const [key, label] of ITEM_NUMERIC_LABELS) {
    const invalid = numericError(label, input[key] as number | undefined);
    if (invalid) return invalid;
  }
  return null;
}

/**
 * Create a non-sellable item, then go to the catalogue.
 *
 * A trigger creates its stock row at zero; opening stock is applied as a logged
 * initial_stock adjustment rather than an initial value, so the first quantity
 * has an explanation like every one after it.
 */
export async function createInventoryItemAction(
  values: InventoryItemFormValues
): Promise<Result<InventoryItem>> {
  const { service, user } = await getInventoryService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const input = normalizeItem(values);

  const invalid = firstItemNumericError(input);
  if (invalid) return { success: false, error: invalid };

  const result = await service.createItem(input);
  if (!result.success) return result;

  revalidatePath(ROUTES.inventory.items.list);
  revalidatePath(ROUTES.inventory.list);
  redirect(ROUTES.inventory.items.list);
}

/**
 * Update a non-sellable item.
 *
 * initial_quantity is deliberately not forwarded: changing stock is an
 * adjustment, and letting an edit form overwrite the on-hand count would discard
 * whatever had been used since.
 *
 * reorder_level passes through as null when blank rather than being dropped, so
 * clearing a threshold is possible — the field distinguishes "no warning wanted"
 * from "warn when it hits zero".
 */
export async function updateInventoryItemAction(
  id: string,
  values: InventoryItemFormValues
): Promise<Result<InventoryItem>> {
  const { service, user } = await getInventoryService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const input = normalizeItem(values);

  const invalid = firstItemNumericError(input);
  if (invalid) return { success: false, error: invalid };

  const result = await service.updateItem(brandId<'InventoryItemId'>(id), {
    name: input.name,
    item_code: input.item_code,
    description: input.description ?? null,
    category: input.category ?? null,
    unit_of_measure: input.unit_of_measure,
    cost_price: input.cost_price,
    reorder_level: input.reorder_level ?? null,
  });

  if (!result.success) return result;

  revalidatePath(ROUTES.inventory.items.list);
  revalidatePath(ROUTES.inventory.list);
  redirect(ROUTES.inventory.items.list);
}

/**
 * Activate or deactivate an item.
 *
 * Deactivating keeps it out of the active catalogue while leaving its stock row
 * and adjustment history intact — the right move for something no longer bought.
 */
export async function setInventoryItemActiveAction(
  id: string,
  isActive: boolean
): Promise<Result<InventoryItem>> {
  const { service, user } = await getInventoryService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const result = await service.updateItem(brandId<'InventoryItemId'>(id), {
    is_active: isActive,
  });

  if (!result.success) return result;

  revalidatePath(ROUTES.inventory.items.list);
  revalidatePath(ROUTES.inventory.list);
  return result;
}

/**
 * Remove an item from the catalogue.
 *
 * Soft delete: the adjustment log references the item, and erasing it would take
 * the record of stock movements that genuinely happened with it.
 */
export async function deleteInventoryItemAction(id: string): Promise<Result<void>> {
  const { service, user } = await getInventoryService();

  // Admin rather than manager, matching how products are removed: deactivating is
  // the reversible everyday action, and removal is not.
  const permission = requireRole(user, 'admin');
  if (!permission.success) return permission;

  const result = await service.deleteItem(brandId<'InventoryItemId'>(id));
  if (!result.success) return result;

  revalidatePath(ROUTES.inventory.items.list);
  revalidatePath(ROUTES.inventory.list);
  return result;
}

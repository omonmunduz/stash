/**
 * INVENTORY DISPLAY LABELS
 *
 * The reason values are snake_case database identifiers; these are what a person
 * reads. Kept in one module because the adjust form's reason picker and the
 * history list both render them, and a reason spelled "Damaged" in one place and
 * "Damage" in another looks like two different reasons.
 *
 * Declared as full Records so adding a reason to InventoryAdjustmentReason fails
 * the build here rather than rendering a raw `count_correction` in the UI.
 */

import type { InventoryAdjustmentReason } from './types';

export const ADJUSTMENT_REASON_LABELS: Record<InventoryAdjustmentReason, string> = {
  initial_stock: 'Opening stock',
  purchase: 'Delivery received',
  return: 'Customer return',
  damage: 'Damaged or expired',
  loss: 'Lost or stolen',
  count_correction: 'Count correction',
  other: 'Other',
};

/**
 * The reasons a person picks from, in the order the picker offers them.
 *
 * Deliberately not every reason in the union:
 *
 * - `initial_stock` is written by createItem when opening stock is entered, so
 *   offering it later would let someone log a second "opening" for something that
 *   has been on the shelf for months.
 * - `count_correction` is written by set_inventory_count, which the recount mode
 *   uses. Choosing it by hand alongside a delta would claim a physical count
 *   happened when what actually happened was an estimate.
 *
 * Both still appear in history via ADJUSTMENT_REASON_LABELS — they just are not
 * things to select.
 */
export const SELECTABLE_ADJUSTMENT_REASONS: InventoryAdjustmentReason[] = [
  'purchase',
  'return',
  'damage',
  'loss',
  'other',
];

/**
 * Which direction a reason usually moves stock.
 *
 * Used to preselect the in/out toggle, because picking "Damaged or expired" and
 * then being asked whether that added stock is a question with an obvious answer
 * — and a wrong default here is how a loss gets recorded as a delivery.
 */
export const REASON_DEFAULT_DIRECTION: Record<InventoryAdjustmentReason, 'in' | 'out'> = {
  initial_stock: 'in',
  purchase: 'in',
  return: 'in',
  damage: 'out',
  loss: 'out',
  count_correction: 'in',
  other: 'in',
};

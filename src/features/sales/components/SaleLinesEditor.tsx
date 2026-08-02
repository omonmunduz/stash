/**
 * SALE LINES EDITOR
 *
 * What was taken, and the ability to fix it afterwards.
 *
 * This is the piece the app was missing. The balance said "123.00" and nothing
 * said which biscuits that was. Now every line is visible, and every line is
 * correctable days later — because that is when someone notices the quantity was
 * wrong, not at the counter.
 *
 * Design decisions:
 * - One row is editable at a time. A table of live inputs invites saving the
 *   wrong row, and each save is a real transaction that moves stock and the
 *   customer's balance.
 * - Editing happens in place, in the row itself, so the product and quantity stay
 *   next to the other lines while being changed. No modal: on a phone a modal
 *   covers the very list that gives the number its context.
 * - Fields save together on an explicit Save. Field-level autosave would fire a
 *   stock movement on every keystroke in a quantity box.
 * - Destructive actions confirm; edits do not. Removing a line cannot be undone
 *   from this screen, but a wrong quantity can just be typed again.
 * - The server returns the whole updated sale, but this component renders from
 *   props. The action revalidates the page, so the totals it shows come from the
 *   same read as the customer's balance — they cannot disagree.
 */

'use client';

import { useState, useTransition } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProductPicker, type PickerProduct } from './ProductPicker';
import { removeSaleItemAction, upsertSaleItemAction } from '@/app/actions/sales';
import { formatMoney, formatQuantity } from '@/lib/utils/format';

/**
 * One line as this editor needs it.
 *
 * Structural rather than importing SaleItem: the customer tab loads a reduced
 * projection without cost_price, and widening that read just to satisfy a prop
 * type would put cost data on a page that never shows it.
 */
export interface EditableLine {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  /** Absent in projections that do not select it; treated as 0. */
  discount?: number;
}

interface SaleLinesEditorProps {
  saleId: string;
  lines: EditableLine[];
  /** Active catalog products for the picker. Empty disables adding. */
  products: PickerProduct[];
  /** False renders a read-only list — manager and above may correct a sale. */
  canEdit: boolean;
  /**
   * True when the line-item read failed. The totals elsewhere are still right,
   * so this says the breakdown is missing rather than showing an empty sale.
   */
  unavailable?: boolean;
}

/** The row currently in edit mode: a line id, 'new', or nothing. */
type EditTarget = string | 'new' | null;

interface LineDraft {
  product_id: string;
  quantity: string;
  unit_price: string;
  discount: string;
}

const EMPTY_DRAFT: LineDraft = {
  product_id: '',
  quantity: '',
  unit_price: '',
  discount: '',
};

export function SaleLinesEditor({
  saleId,
  lines,
  products,
  canEdit,
  unavailable,
}: SaleLinesEditorProps) {
  const [target, setTarget] = useState<EditTarget>(null);
  const [draft, setDraft] = useState<LineDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);

  const beginAdd = () => {
    setError(null);
    setDraft(EMPTY_DRAFT);
    setTarget('new');
  };

  const beginEdit = (line: EditableLine) => {
    setError(null);
    setDraft({
      product_id: line.product_id,
      quantity: String(line.quantity),
      unit_price: String(line.unit_price),
      discount: line.discount ? String(line.discount) : '',
    });
    setTarget(line.id);
  };

  const cancel = () => {
    setError(null);
    setTarget(null);
  };

  /**
   * Picking a product fills in its current price, but only while adding.
   * Overwriting the price on an existing line would discard the snapshot of what
   * was actually charged, which is the one number an invoice must not lose.
   */
  const pickProduct = (productId: string) => {
    setDraft((previous) => {
      if (target !== 'new') return { ...previous, product_id: productId };

      const product = products.find((candidate) => candidate.id === productId);

      return {
        ...previous,
        product_id: productId,
        unit_price: product ? String(product.sale_price) : previous.unit_price,
      };
    });
  };

  const save = () => {
    setError(null);

    startTransition(async () => {
      const result = await upsertSaleItemAction(saleId, {
        item_id: target === 'new' ? undefined : (target ?? undefined),
        product_id: draft.product_id,
        quantity: draft.quantity,
        unit_price: draft.unit_price || undefined,
        discount: draft.discount || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setTarget(null);
      setDraft(EMPTY_DRAFT);
    });
  };

  const remove = (line: EditableLine) => {
    const confirmed = window.confirm(
      `Remove ${formatQuantity(line.quantity)} × ${line.product_name} from this sale?\n\n` +
        `The sale total drops by ${formatMoney(line.subtotal)}, the stock goes back on the shelf, ` +
        `and this customer's balance is corrected.`
    );

    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      const result = await removeSaleItemAction(saleId, line.id);
      if (!result.success) setError(result.error);
    });
  };

  if (unavailable) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        The breakdown of this sale could not be loaded. The totals above are still
        correct — refresh to try again.
      </p>
    );
  }

  if (lines.length === 0 && target !== 'new') {
    return (
      <div className="space-y-3 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Nothing on this sale yet.
        </p>
        {canEdit && products.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={beginAdd}>
            <Plus aria-hidden="true" />
            Add a product
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="px-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
            {canEdit && (
              <TableHead className="w-px">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {lines.map((line) =>
            target === line.id ? (
              <DraftRow
                key={line.id}
                draft={draft}
                setDraft={setDraft}
                pickProduct={pickProduct}
                products={products}
                isPending={isPending}
                onSave={save}
                onCancel={cancel}
                canEdit={canEdit}
              />
            ) : (
              <TableRow key={line.id}>
                <TableCell>
                  <span className="font-medium">{line.product_name}</span>
                  {line.product_sku && (
                    <span className="block text-xs text-muted-foreground">
                      {line.product_sku}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(line.quantity)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(line.unit_price)}
                  {line.discount ? (
                    <span className="block text-xs text-muted-foreground">
                      −{formatMoney(line.discount)} off
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(line.subtotal)}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isPending || target !== null}
                        onClick={() => beginEdit(line)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        <span className="sr-only">Edit {line.product_name}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isPending || target !== null}
                        onClick={() => remove(line)}
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                        <span className="sr-only">Remove {line.product_name}</span>
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          )}

          {target === 'new' && (
            <DraftRow
              draft={draft}
              setDraft={setDraft}
              pickProduct={pickProduct}
              products={products}
              isPending={isPending}
              onSave={save}
              onCancel={cancel}
              canEdit={canEdit}
            />
          )}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="text-sm text-muted-foreground">
              Total
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatMoney(total)}
            </TableCell>
            {canEdit && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>

      {canEdit && target === null && (
        <div className="px-4 pb-1">
          {products.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={beginAdd}>
              <Plus aria-hidden="true" />
              Add a product
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add a product to your catalog before adding lines to a sale.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The row being added or corrected.
 *
 * Shares one component between add and edit because they submit the same shape
 * to the same action — the only difference is whether an item id goes with it.
 */
function DraftRow({
  draft,
  setDraft,
  pickProduct,
  products,
  isPending,
  onSave,
  onCancel,
  canEdit,
}: {
  draft: LineDraft;
  setDraft: React.Dispatch<React.SetStateAction<LineDraft>>;
  pickProduct: (productId: string) => void;
  products: PickerProduct[];
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
  canEdit: boolean;
}) {
  const quantity = Number(draft.quantity);
  const price = Number(draft.unit_price);
  const discount = Number(draft.discount || 0);

  const preview =
    draft.quantity !== '' &&
    draft.unit_price !== '' &&
    !Number.isNaN(quantity) &&
    !Number.isNaN(price) &&
    !Number.isNaN(discount)
      ? quantity * price - discount
      : null;

  const canSave = draft.product_id !== '' && draft.quantity !== '' && !isPending;

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell>
        <ProductPicker
          value={draft.product_id}
          onChange={pickProduct}
          products={products}
          disabled={isPending}
          aria-label="Product"
        />
      </TableCell>

      <TableCell>
        <Input
          type="number"
          inputMode="decimal"
          min="0.001"
          step="0.001"
          value={draft.quantity}
          onChange={(event) =>
            setDraft((previous) => ({ ...previous, quantity: event.target.value }))
          }
          disabled={isPending}
          className="w-20 text-right tabular-nums"
          aria-label="Quantity"
          // Autofocus lands on quantity rather than the product select: on an
          // edit, the product is usually right and the number is what is wrong.
          autoFocus
        />
      </TableCell>

      <TableCell>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={draft.unit_price}
          onChange={(event) =>
            setDraft((previous) => ({ ...previous, unit_price: event.target.value }))
          }
          disabled={isPending}
          className="w-24 text-right tabular-nums"
          aria-label="Unit price"
          placeholder="Catalog price"
        />
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={draft.discount}
          onChange={(event) =>
            setDraft((previous) => ({ ...previous, discount: event.target.value }))
          }
          disabled={isPending}
          className="mt-1 w-24 text-right tabular-nums"
          aria-label="Line discount"
          placeholder="Discount"
        />
      </TableCell>

      <TableCell className="text-right align-top font-medium tabular-nums">
        {preview === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span aria-live="polite">{formatMoney(preview)}</span>
        )}
      </TableCell>

      {canEdit && (
        <TableCell className="align-top">
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!canSave}
              onClick={onSave}
            >
              <Check className="size-4" aria-hidden="true" />
              <span className="sr-only">Save line</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isPending}
              onClick={onCancel}
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Cancel</span>
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

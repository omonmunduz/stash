/**
 * SALE FORM
 *
 * Recording what just left the shelf.
 *
 * The shape of this form follows the counter interaction: who is taking it, what
 * they are taking, and how much they are handing over right now. That last field
 * is why this app exists — the answer is often "nothing" or "half", and the rest
 * goes on the tab.
 *
 * Design decisions:
 * - Lines start with one empty row and grow. A trailing blank row is normal, not
 *   an error, so the action drops unfilled lines instead of complaining.
 * - Picking a product fills its catalog price, which stays editable. Wholesale
 *   prices get negotiated per customer, and retyping the price is the common case
 *   rather than an exception.
 * - The running total is always visible. It is what gets read aloud to the
 *   customer, so it cannot be a thing you have to submit to find out.
 * - Amount paid defaults to blank, meaning nothing paid — pure credit. The
 *   alternative default (paid in full) would silently settle tabs whenever
 *   someone tabbed past the field.
 * - Credit warnings appear inline as soon as the total crosses the customer's
 *   limit, but never block. The goods are already gone; refusing to write it down
 *   is how debt stops being tracked.
 */

'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProductPicker, type PickerProduct } from './ProductPicker';
import { createSaleAction } from '@/app/actions/sales';
import type { SaleFormValues, SaleLineValues } from '@/app/actions/sales';
import type { PaymentMethod } from '@/features/payments/types';
import { PAYMENT_METHOD_LABELS } from '@/features/payments/labels';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

/** The little this form needs about a customer. */
export interface SaleFormCustomer {
  id: string;
  name: string;
  business_name: string | null;
  customer_code: string;
  current_balance: number;
  credit_limit: number | null;
}

interface SaleFormProps {
  customers: SaleFormCustomer[];
  products: PickerProduct[];
  /** Preselected when arriving from a customer's page. */
  defaultCustomerId?: string;
}

const EMPTY_LINE: SaleLineValues = {
  product_id: '',
  quantity: '1',
  unit_price: '',
  discount: '',
};

export function SaleForm({ customers, products, defaultCustomerId }: SaleFormProps) {
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? '');
  const [lines, setLines] = useState<SaleLineValues[]>([{ ...EMPTY_LINE }]);
  const [saleDate, setSaleDate] = useState(todayInputValue);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const customer = customers.find((candidate) => candidate.id === customerId);

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        if (!line.product_id) return sum;

        const quantity = Number(line.quantity);
        const price = Number(line.unit_price);
        const discount = Number(line.discount || 0);

        if (Number.isNaN(quantity) || Number.isNaN(price) || Number.isNaN(discount)) {
          return sum;
        }

        return sum + quantity * price - discount;
      }, 0),
    [lines]
  );

  const paid = Number(amountPaid || 0);
  const goingOnTab = Number.isNaN(paid) ? total : Math.max(0, total - paid);

  // Warn on what will still be owed after this sale, not on the sale total: a
  // large order paid for in cash does not touch the tab.
  const projectedBalance = customer ? customer.current_balance + goingOnTab : 0;
  const overLimit =
    customer?.credit_limit != null && projectedBalance > customer.credit_limit;

  const setLine = (index: number, patch: Partial<SaleLineValues>) => {
    setLines((previous) =>
      previous.map((line, position) =>
        position === index ? { ...line, ...patch } : line
      )
    );
  };

  const pickProduct = (index: number, productId: string) => {
    const product = products.find((candidate) => candidate.id === productId);

    setLine(index, {
      product_id: productId,
      unit_price: product ? String(product.sale_price) : '',
    });
  };

  const addLine = () => setLines((previous) => [...previous, { ...EMPTY_LINE }]);

  const removeLine = (index: number) => {
    // No confirmation: nothing is recorded yet, so this only clears an input.
    setLines((previous) =>
      previous.length === 1
        ? [{ ...EMPTY_LINE }]
        : previous.filter((_, position) => position !== index)
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const values: SaleFormValues = {
      customer_id: customerId,
      lines,
      sale_date: saleDate,
      due_date: dueDate,
      notes,
      amount_paid: amountPaid,
      payment_method: paymentMethod,
    };

    startTransition(async () => {
      const result = await createSaleAction(values);

      // Only reached on failure — the action redirects to the new sale.
      if (!result.success) setError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">Who is buying</legend>

        <div className="space-y-2">
          <Label htmlFor="customer">
            Customer <span aria-hidden="true">*</span>
          </Label>
          <select
            id="customer"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            required
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Choose a customer...</option>
            {customers.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.business_name
                  ? `${candidate.business_name} (${candidate.name})`
                  : candidate.name}
              </option>
            ))}
          </select>

          {customer && customer.current_balance > 0 && (
            <p className="text-xs text-muted-foreground">
              Already owes{' '}
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(customer.current_balance)}
              </span>
              {customer.credit_limit != null && (
                <> of a {formatMoney(customer.credit_limit)} limit</>
              )}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-3" disabled={isPending}>
        <legend className="text-sm font-medium">What they are taking</legend>

        <ul className="space-y-3">
          {lines.map((line, index) => (
            <li
              key={index}
              className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_5rem_6rem_auto] sm:items-end"
            >
              <div className="space-y-1">
                <Label htmlFor={`product-${index}`} className="text-xs">
                  Product
                </Label>
                <ProductPicker
                  id={`product-${index}`}
                  value={line.product_id}
                  onChange={(productId) => pickProduct(index, productId)}
                  products={products}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`quantity-${index}`} className="text-xs">
                  Qty
                </Label>
                <Input
                  id={`quantity-${index}`}
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  step="0.001"
                  value={line.quantity}
                  onChange={(event) => setLine(index, { quantity: event.target.value })}
                  className="text-right tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`price-${index}`} className="text-xs">
                  Price
                </Label>
                <Input
                  id={`price-${index}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={line.unit_price}
                  onChange={(event) => setLine(index, { unit_price: event.target.value })}
                  className="text-right tabular-nums"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(index)}
                className="justify-self-end"
              >
                <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                <span className="sr-only">Remove line {index + 1}</span>
              </Button>
            </li>
          ))}
        </ul>

        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus aria-hidden="true" />
          Add another product
        </Button>
      </fieldset>

      <div className="flex items-baseline justify-between rounded-lg bg-muted px-4 py-3">
        <span className="text-sm font-medium">Total</span>
        <span className="text-xl font-semibold tabular-nums" aria-live="polite">
          {formatMoney(total)}
        </span>
      </div>

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">What they paid now</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount-paid">Paid at the counter</Label>
            <Input
              id="amount-paid"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(event) => setAmountPaid(event.target.value)}
              placeholder="0.00"
              className="text-right tabular-nums"
            />
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setAmountPaid(total > 0 ? String(total) : '')}
                className="text-primary underline-offset-4 hover:underline"
              >
                Paid in full
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid('')}
                className="text-primary underline-offset-4 hover:underline"
              >
                All on credit
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sale-payment-method">How they paid</Label>
            <select
              id="sale-payment-method"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_METHOD_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {goingOnTab > 0 && customer && (
          <p className="text-sm" aria-live="polite">
            <span className="text-muted-foreground">Going on the tab: </span>
            <span className="font-medium tabular-nums">{formatMoney(goingOnTab)}</span>
            <span className="text-muted-foreground">
              {' '}
              — they will owe {formatMoney(projectedBalance)}
            </span>
          </p>
        )}

        {overLimit && customer?.credit_limit != null && (
          <Alert>
            <AlertDescription>
              This puts {customer.business_name ?? customer.name} over their{' '}
              {formatMoney(customer.credit_limit)} credit limit, at{' '}
              {formatMoney(projectedBalance)}. The sale will still be recorded —
              this is a heads-up, not a block.
            </AlertDescription>
          </Alert>
        )}
      </fieldset>

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">Details</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sale-date">Date</Label>
            <Input
              id="sale-date"
              type="date"
              value={saleDate}
              onChange={(event) => setSaleDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Pay by</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Used to flag the sale as overdue.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sale-notes">Note</Label>
          <Textarea
            id="sale-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Anything worth remembering about this sale."
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" disabled={isPending} className="sm:w-auto">
          {isPending ? 'Recording...' : 'Record sale'}
        </Button>
        <Button asChild variant="outline" disabled={isPending} className="sm:w-auto">
          <Link href={ROUTES.sales.list}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

/** 'yyyy-mm-dd' for a date input, from local parts so it is not yesterday in UTC. */
function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

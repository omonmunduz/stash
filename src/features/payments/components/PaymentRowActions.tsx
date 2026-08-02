/**
 * PAYMENT ROW ACTIONS
 *
 * Correct or void one recorded payment.
 *
 * Both operations re-run the oldest-debt-first split for the whole customer, so
 * the confirmation text says what actually moves: not just "this payment", but
 * the invoices it was covering. Someone voiding a receipt should know the tab is
 * about to go back up.
 *
 * Editing the amount is a real case, not a loophole. She wrote 50 and it was 30,
 * hours ago, and the honest fix is to correct the figure rather than void a
 * receipt the customer is holding. The RPC behind it rebuilds the allocations, so
 * the invoices follow the corrected money.
 */

'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updatePaymentAction, voidPaymentAction } from '@/app/actions/payments';
import type { PaymentMethod } from '../types';
import { PAYMENT_METHOD_LABELS } from '../labels';
import { formatMoney } from '@/lib/utils/format';

/** What these controls need about the payment they act on. */
export interface EditablePayment {
  id: string;
  payment_number: string;
  amount: number;
  payment_date: Date;
  payment_method: PaymentMethod;
  reference_number: string | null;
}

interface PaymentRowActionsProps {
  payment: EditablePayment;
  customerId: string;
  /** Manager and above. False renders nothing. */
  canEdit: boolean;
}

export function PaymentRowActions({
  payment,
  customerId,
  canEdit,
}: PaymentRowActionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [method, setMethod] = useState<PaymentMethod>(payment.payment_method);
  const [date, setDate] = useState(dateInputValue(payment.payment_date));
  const [reference, setReference] = useState(payment.reference_number ?? '');

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canEdit) return null;

  const cancel = () => {
    setAmount(String(payment.amount));
    setMethod(payment.payment_method);
    setDate(dateInputValue(payment.payment_date));
    setReference(payment.reference_number ?? '');
    setError(null);
    setIsEditing(false);
  };

  const save = () => {
    setError(null);

    const changed = Number(amount) !== payment.amount;

    // Only the amount change moves money, so it is the only one worth stopping
    // for. Fixing a date or a check number does not need a dialog.
    if (changed) {
      const confirmed = window.confirm(
        `Change ${payment.payment_number} from ${formatMoney(payment.amount)} to ${formatMoney(Number(amount))}?\n\n` +
          `This customer's payments will be re-applied to their invoices oldest-first, so which invoices show as paid may change.`
      );

      if (!confirmed) return;
    }

    startTransition(async () => {
      const result = await updatePaymentAction(payment.id, customerId, {
        amount,
        payment_date: date,
        payment_method: method,
        reference_number: reference,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setIsEditing(false);
    });
  };

  const remove = () => {
    const confirmed = window.confirm(
      `Void ${payment.payment_number} for ${formatMoney(payment.amount)}?\n\n` +
        `The invoices it was covering go back to unpaid or part paid, and this customer's balance goes back up by ${formatMoney(payment.amount)}. ` +
        `The record stays on file, marked void.`
    );

    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      const result = await voidPaymentAction(payment.id, customerId);
      if (!result.success) setError(result.error);
    });
  };

  if (!isEditing) {
    return (
      <div className="space-y-2">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="size-4" aria-hidden="true" />
            <span className="sr-only">Edit {payment.payment_number}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={remove}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            <span className="sr-only">Void {payment.payment_number}</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3 text-left">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={isPending}>
        <legend className="sr-only">Correct {payment.payment_number}</legend>

        <div className="space-y-1">
          <Label htmlFor={`amount-${payment.id}`} className="text-xs">
            Amount
          </Label>
          <Input
            id={`amount-${payment.id}`}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="text-right tabular-nums"
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`date-${payment.id}`} className="text-xs">
            Date
          </Label>
          <Input
            id={`date-${payment.id}`}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`method-${payment.id}`} className="text-xs">
            Method
          </Label>
          <select
            id={`method-${payment.id}`}
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => (
              <option key={value} value={value}>
                {PAYMENT_METHOD_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`reference-${payment.id}`} className="text-xs">
            Reference
          </Label>
          <Input
            id={`reference-${payment.id}`}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={100}
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="button" size="sm" disabled={isPending} onClick={save}>
          {isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={cancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** A Date as 'yyyy-mm-dd' for a date input, from local parts. */
function dateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

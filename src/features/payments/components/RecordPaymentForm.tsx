/**
 * RECORD PAYMENT FORM
 *
 * "She just gave me 200." That is the whole interaction, so the form opens on the
 * amount field and everything else has a working default.
 *
 * Design decisions:
 * - Collapsed to a button until used. This sits on the customer detail page,
 *   which is read most of the time and written to occasionally; an always-open
 *   form would push the history below the fold for no reason.
 * - Amount and method only, by default. Date defaults to today and the reference
 *   and note fields hide behind a toggle, because a cash payment has neither.
 * - No invoice selector. The money goes to the oldest debt first, which is what
 *   both sides of the counter already assume. Paying a specific invoice is done
 *   from that invoice's own screen, which passes saleId.
 * - Overpaying is allowed and explained rather than blocked. The customer has
 *   already handed the money over; the surplus becomes account credit and the
 *   form says so.
 */

'use client';

import { useState, useTransition } from 'react';
import { HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { recordPaymentAction } from '@/app/actions/payments';
import type { PaymentFormValues } from '@/app/actions/payments';
import type { PaymentMethod } from '../types';
import { formatMoney } from '@/lib/utils/format';
import { PAYMENT_METHOD_LABELS } from '../labels';

interface RecordPaymentFormProps {
  customerId: string;
  /** What they owe right now. Drives the "pay it all" shortcut. */
  currentBalance: number;
  /** Set when recording from one invoice's screen: that invoice settles first. */
  saleId?: string;
  /** Label for the collapsed trigger. */
  triggerLabel?: string;
}

export function RecordPaymentForm({
  customerId,
  currentBalance,
  saleId,
  triggerLabel = 'Record a payment',
}: RecordPaymentFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(todayInputValue);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const owed = Math.max(0, currentBalance);
  const entered = Number(amount);
  const overpaying =
    amount !== '' && !Number.isNaN(entered) && owed > 0 && entered > owed;

  const reset = () => {
    setAmount('');
    setMethod('cash');
    setDate(todayInputValue());
    setReference('');
    setNotes('');
    setShowDetails(false);
    setError(null);
  };

  const close = () => {
    reset();
    setNotice(null);
    setIsOpen(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const values: PaymentFormValues = {
      customer_id: customerId,
      amount,
      payment_method: method,
      payment_date: date,
      reference_number: reference,
      notes,
      sale_id: saleId,
    };

    startTransition(async () => {
      const result = await recordPaymentAction(values);

      if (!result.success) {
        setError(result.error);
        return;
      }

      // The action revalidates, so the balance above this form is already
      // updating. The form collapses and leaves the receipt number behind as
      // confirmation that something was written.
      const { payment, creditNotice } = result.data;

      setNotice(
        creditNotice
          ? `Recorded ${payment.payment_number}. ${creditNotice}`
          : `Recorded ${payment.payment_number} for ${formatMoney(payment.amount)}.`
      );

      reset();
      setIsOpen(false);
    });
  };

  if (!isOpen) {
    return (
      <div className="space-y-3">
        {notice && (
          <Alert>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        <Button type="button" onClick={() => setIsOpen(true)}>
          <HandCoins aria-hidden="true" />
          {triggerLabel}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border p-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">
          {saleId ? 'Payment for this invoice' : 'Payment received'}
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">
              How much <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="payment-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              autoFocus
              className="text-right tabular-nums"
            />
            {owed > 0 && (
              <button
                type="button"
                onClick={() => setAmount(String(owed))}
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                Paying it all off — {formatMoney(owed)}
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method">How they paid</Label>
            <select
              id="payment-method"
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
        </div>

        {overpaying && (
          <Alert>
            <AlertDescription>
              That is {formatMoney(entered - owed)} more than the {formatMoney(owed)}{' '}
              owed. The extra will sit on the account as credit against their next
              purchase.
            </AlertDescription>
          </Alert>
        )}

        {!showDetails ? (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Change the date, or add a reference or note
          </button>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment-date">Date received</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-reference">Reference</Label>
                <Input
                  id="payment-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={100}
                  placeholder="Check or transfer number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Note</Label>
              <Textarea
                id="payment-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" disabled={isPending} className="sm:w-auto">
          {isPending ? 'Recording...' : 'Record payment'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={close}
          className="sm:w-auto"
        >
          Cancel
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

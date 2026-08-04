/**
 * EXPENSE FORM
 *
 * One component for create and edit, like ProductForm — they differ only in which
 * action they call and what the button says.
 *
 * Field order follows what someone reaching for this form already knows. They are
 * holding a receipt: the amount and what it was for are in hand, the date is
 * today, and the category is a decision. Amount leads and is autofocused; the
 * date sits with the method because it is usually already right.
 *
 * Everything is visible at once rather than behind a "more details" toggle, the
 * way RecordPaymentForm does it. That form is an interruption on someone else's
 * page during a counter transaction, where two fields is the whole job. This is a
 * page of its own, and all five fields matter to the record.
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createExpenseAction, updateExpenseAction } from '@/app/actions/expenses';
import type { ExpenseFormValues } from '@/app/actions/expenses';
import { PAYMENT_METHOD_LABELS } from '@/features/payments/labels';
import type { PaymentMethod } from '@/features/payments/types';
import { EXPENSE_CATEGORY_SUGGESTIONS } from '../categories';
import type { Expense } from '../types';
import { ROUTES } from '@/lib/constants/routes';

interface ExpenseFormProps {
  /** Present when editing; absent when creating. */
  expense?: Expense;
}

export function ExpenseForm({ expense }: ExpenseFormProps) {
  const isEdit = expense !== undefined;

  const [values, setValues] = useState<ExpenseFormValues>({
    amount: expense ? String(expense.amount) : '',
    category: expense?.category ?? '',
    description: expense?.description ?? '',
    payment_method: expense?.payment_method ?? 'cash',
    expense_date: expense ? dateInputValue(expense.expense_date) : todayInputValue(),
    vendor: expense?.vendor ?? '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set =
    (field: keyof ExpenseFormValues) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setValues((previous) => ({ ...previous, [field]: event.target.value }));
    };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateExpenseAction(expense.id, values)
        : await createExpenseAction(values);

      // Only reached on failure — both actions redirect on success.
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
        <legend className="text-sm font-medium">What you spent</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount">
              How much <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={values.amount}
              onChange={set('amount')}
              required
              autoFocus={!isEdit}
              className="text-right tabular-nums"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">
              Category <span aria-hidden="true">*</span>
            </Label>
            {/* An input with a datalist, not a select: the list is a set of
                suggestions, and a business with a cost we did not think of must
                still be able to name it. Tapping a suggestion spells it the same
                way every time, which is what keeps the breakdown from splitting
                "Rent" and "rent" into two lines. */}
            <Input
              id="category"
              list="expense-categories"
              value={values.category}
              onChange={set('category')}
              placeholder="e.g., Transport"
              required
              minLength={2}
              maxLength={50}
            />
            <datalist id="expense-categories">
              {EXPENSE_CATEGORY_SUGGESTIONS.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            What was it for <span aria-hidden="true">*</span>
          </Label>
          <Textarea
            id="description"
            value={values.description}
            onChange={set('description')}
            placeholder="e.g., Fuel for the delivery run to Kariakoo"
            required
            minLength={3}
            maxLength={500}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            Enough that this still makes sense to you in six months.
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">Details</legend>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="expense_date">Date</Label>
            <Input
              id="expense_date"
              type="date"
              value={values.expense_date}
              onChange={set('expense_date')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">How you paid</Label>
            {/* Native select, like the other money forms: on a phone this opens
                the OS picker. */}
            <select
              id="payment_method"
              value={values.payment_method}
              onChange={set('payment_method')}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_METHOD_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor">Paid to</Label>
            <Input
              id="vendor"
              value={values.vendor}
              onChange={set('vendor')}
              placeholder="Optional"
              maxLength={100}
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" disabled={isPending} className="sm:w-auto">
          {isPending
            ? isEdit
              ? 'Saving...'
              : 'Recording...'
            : isEdit
              ? 'Save changes'
              : 'Record expense'}
        </Button>
        <Button asChild variant="outline" disabled={isPending} className="sm:w-auto">
          <Link href={ROUTES.expenses.list}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

// ── Internals ─────────────────────────────────────────────────────────────────

/** 'yyyy-mm-dd' for a date input, from local parts so it is not yesterday in UTC. */
function todayInputValue(): string {
  return dateInputValue(new Date());
}

function dateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

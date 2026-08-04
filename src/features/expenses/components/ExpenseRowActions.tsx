/**
 * EXPENSE ROW ACTIONS
 *
 * Edit or delete one expense.
 *
 * Edit is a link to the edit page rather than an inline form, which is where this
 * differs from PaymentRowActions. That component edits in place because payments
 * appear on a customer's page and there is no payment screen to send anyone to.
 * An expense has its own edit route, and six fields is more than belongs inside a
 * table row.
 *
 * Delete is soft and says so. Nothing downstream depends on an expense — no
 * balance moves, no invoice reopens — so the confirmation only has to cover the
 * one thing that does change: it stops counting against profit.
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { deleteExpenseAction } from '@/app/actions/expenses';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

/** What these controls need about the expense they act on. */
export interface EditableExpense {
  id: string;
  expense_number: string;
  amount: number;
  category: string;
}

interface ExpenseRowActionsProps {
  expense: EditableExpense;
  /** Manager and above. False renders nothing. */
  canEdit: boolean;
}

export function ExpenseRowActions({ expense, canEdit }: ExpenseRowActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canEdit) return null;

  const remove = () => {
    const confirmed = window.confirm(
      `Delete ${expense.expense_number} — ${expense.category}, ${formatMoney(expense.amount)}?\n\n` +
        `It stops counting against your profit. The record stays on file.`
    );

    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      const result = await deleteExpenseAction(expense.id);
      if (!result.success) setError(result.error);
    });
  };

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end gap-1">
        <Button asChild variant="ghost" size="icon" disabled={isPending}>
          <Link href={ROUTES.expenses.edit(expense.id)}>
            <Pencil className="size-4" aria-hidden="true" />
            <span className="sr-only">Edit {expense.expense_number}</span>
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isPending}
          onClick={remove}
        >
          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          <span className="sr-only">Delete {expense.expense_number}</span>
        </Button>
      </div>
    </div>
  );
}

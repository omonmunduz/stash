/**
 * EXPENSE LIST
 *
 * Money out, newest first. Cards on phones, a table above, matching PaymentList
 * and CustomerList — the primary user is on a phone, and a horizontally
 * scrolling table hides the column that matters most.
 *
 * Amounts are deliberately not coloured. PaymentList renders its figures in
 * emerald because every row there is money arriving, and CustomerList renders
 * balances in red because a balance is a problem to chase. An expense is
 * neither: buying packaging is the business working normally, and a page of red
 * numbers would read as a page of warnings. The one place colour appears is the
 * period total on the page above, and only as emphasis.
 *
 * Category is a Badge rather than plain text so the eye can group a column of
 * repeated words without reading each one. Secondary variant because a category
 * is a label, not a status — Badge's success/warning/destructive variants carry
 * financial meaning elsewhere in the app and borrowing them here would imply a
 * judgement about the spend.
 *
 * A Server Component: it receives loaded expenses and holds no state.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExpenseRowActions } from './ExpenseRowActions';
import type { Expense } from '../types';
import { PAYMENT_METHOD_LABELS } from '@/features/payments/labels';
import { formatMoney, formatDate } from '@/lib/utils/format';

interface ExpenseListProps {
  expenses: Expense[];
  /** Manager and above. Controls the edit/delete column. */
  canEdit: boolean;
}

export function ExpenseList({ expenses, canEdit }: ExpenseListProps) {
  return (
    <>
      {/* Phone layout. */}
      <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
        {expenses.map((expense) => (
          <li key={expense.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0">
                    {expense.category}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm">{expense.description}</p>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {expense.expense_number} · {formatDate(expense.expense_date)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-medium tabular-nums">
                  {formatMoney(expense.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[expense.payment_method]}
                </p>
              </div>
            </div>

            {expense.vendor && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Paid to {expense.vendor}
              </p>
            )}

            {canEdit && (
              <div className="mt-2">
                <ExpenseRowActions expense={expense} canEdit={canEdit} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Tablet and up. */}
      <div className="hidden rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>What for</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {canEdit && <TableHead className="w-px" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="align-top font-medium tabular-nums">
                  {expense.expense_number}
                </TableCell>

                <TableCell className="align-top text-sm text-muted-foreground">
                  {formatDate(expense.expense_date)}
                </TableCell>

                <TableCell className="align-top">
                  <Badge variant="secondary">{expense.category}</Badge>
                </TableCell>

                <TableCell className="align-top text-sm">
                  {expense.description}
                  {expense.vendor && (
                    <span className="block text-xs text-muted-foreground">
                      Paid to {expense.vendor}
                    </span>
                  )}
                </TableCell>

                <TableCell className="align-top text-sm text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[expense.payment_method]}
                </TableCell>

                <TableCell className="align-top text-right font-medium tabular-nums">
                  {formatMoney(expense.amount)}
                </TableCell>

                {canEdit && (
                  <TableCell className="align-top">
                    <ExpenseRowActions expense={expense} canEdit={canEdit} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

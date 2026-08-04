/**
 * EXPENSES LIST
 *
 * Money out, newest first. The counterpart to the payments day book: that page
 * answers what came back through the door, this one answers what left.
 *
 * Defaults to this month rather than everything, and to a longer window than
 * payments does — see the note in categories.ts. Costs arrive in ones and twos
 * where takings arrive daily, so a week of expenses is often an empty page.
 *
 * Filter state comes from searchParams so this stays a Server Component that
 * queries once per navigation, matching the customers and payments lists.
 *
 * Two queries, not one. The list is filtered; the category dropdown's options are
 * not, because options that vanish when you use them are a dropdown you cannot
 * back out of. See findDistinctCategories in the repository.
 */

import Link from 'next/link';
import { Suspense } from 'react';
import { PieChart, Plus, Receipt, Tag, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { MetricCard } from '@/features/dashboard/components/MetricCard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExpenseList } from '@/features/expenses/components/ExpenseList';
import { ExpenseFilters } from '@/features/expenses/components/ExpenseFilters';
import {
  DEFAULT_EXPENSE_PERIOD,
  EXPENSE_PERIODS,
  expensePeriodStart,
  parseExpensePeriod,
} from '@/features/expenses/categories';
import { summarizeByCategory } from '@/features/expenses/business-rules';
import { getExpenseService } from '@/features/expenses/server';
import { hasRole } from '@/features/auth/roles';
import { PAYMENT_METHOD_LABELS } from '@/features/payments/labels';
import type { PaymentMethod } from '@/features/payments/types';
import type { Expense } from '@/features/expenses/types';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

export const metadata = {
  title: 'Expenses',
};

interface ExpensesPageProps {
  searchParams: Promise<{
    period?: string;
    category?: string;
    method?: string;
    q?: string;
  }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;

  const period = parseExpensePeriod(params.period);
  const category = params.category?.trim() || undefined;
  const method = parseMethod(params.method);
  const search = params.q?.trim() || undefined;

  const { service, user } = await getExpenseService();

  // Run together: neither depends on the other, and the dropdown should not wait
  // on the table.
  //
  // categories() returns a bare array rather than a Result — a failed category
  // read is not worth failing the page over. The filter loses its dropdown; the
  // list still answers the question the user came with.
  const [result, categories] = await Promise.all([
    service.list({
      dateFrom: expensePeriodStart(period),
      category,
      method,
      search,
    }),
    service.categories(),
  ]);

  // Editing and deleting are manager work, matching
  // expenses_update_manager_or_above. Recording is not — the button above is open
  // to everyone, matching expenses_insert_any_role.
  //
  // The same check gates the breakdown link, because that report puts the whole
  // business's takings next to its costs and is guarded at manager on its own
  // route. Showing a link that redirects would be worse than not showing it.
  const isManager = hasRole(user, 'manager');

  const isFiltered =
    period !== DEFAULT_EXPENSE_PERIOD ||
    category !== undefined ||
    method !== undefined ||
    search !== undefined;

  const periodLabel =
    EXPENSE_PERIODS.find((entry) => entry.value === period)?.label ?? '';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Expenses"
        description="What you spent, and what on."
        action={
          <>
            {isManager && (
              <Button asChild variant="outline">
                <Link href={ROUTES.reports.expenses}>
                  <PieChart aria-hidden="true" />
                  Breakdown
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link href={ROUTES.expenses.new}>
                <Plus aria-hidden="true" />
                Add expense
              </Link>
            </Button>
          </>
        }
      />

      {!result.success ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* useSearchParams() suspends while prerendering, so the filters need a
              boundary or the whole route is forced dynamic. */}
          <Suspense fallback={<div className="h-32" />}>
            <ExpenseFilters categories={categories} />
          </Suspense>

          {result.data.length === 0 ? (
            isFiltered ? (
              <EmptyState
                title="Nothing here"
                description="No expenses match what you are looking at. Try a longer period, or clear the filters."
                icon={<Receipt className="size-6" aria-hidden="true" />}
                action={
                  <Button asChild variant="outline">
                    <Link href={ROUTES.expenses.list}>Clear filters</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No expenses yet"
                description="Rent, transport, packaging, wages. Write down what you spend and you will know what the business actually costs to run."
                icon={<Receipt className="size-6" aria-hidden="true" />}
                action={
                  <Button asChild>
                    <Link href={ROUTES.expenses.new}>
                      <Plus aria-hidden="true" />
                      Record your first expense
                    </Link>
                  </Button>
                }
              />
            )
          ) : (
            <>
              <PeriodSummary
                expenses={result.data}
                periodLabel={periodLabel}
                isFiltered={isFiltered}
              />
              <ExpenseList expenses={result.data} canEdit={isManager} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The total for what is currently on screen, plus the category taking the biggest
 * share of it.
 *
 * Summed from the loaded rows rather than queried separately, like the payments
 * and customers lists: a filtered table under an unfiltered total reads as the
 * wrong answer to the question that was asked. sumForPeriod exists on the service
 * for reports, which ask about a date range and nothing else — here the figure has
 * to agree with the category and search filters too.
 *
 * The heading says which period it covers, because "12,400.00" means nothing
 * without it and the presets above are easy to forget having tapped.
 */
function PeriodSummary({
  expenses,
  periodLabel,
  isFiltered,
}: {
  expenses: Expense[];
  periodLabel: string;
  isFiltered: boolean;
}) {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const breakdown = summarizeByCategory(expenses);
  const biggest = breakdown[0];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard
        label="Total spent"
        value={formatMoney(total)}
        // The period is named here rather than in the label so the figure is never
        // read without knowing what it covers, and so a filtered view says it is
        // filtered instead of quietly claiming to be the whole month.
        detail={isFiltered ? 'Matching your filters' : periodLabel}
        icon={Wallet}
        tone="warning"
      />

      <MetricCard
        label="Expenses"
        value={String(expenses.length)}
        detail={expenses.length === 1 ? 'record' : 'records'}
        icon={Receipt}
      />

      <MetricCard
        label="Biggest category"
        value={biggest ? biggest.category : '—'}
        detail={
          biggest
            ? `${formatMoney(biggest.total)} · ${Math.round(biggest.percentage_of_total)}% of the total`
            : undefined
        }
        icon={Tag}
      />
    </div>
  );
}

/**
 * Narrow ?method= to a real payment method.
 *
 * Keyed off the labels record so adding a method to the enum needs no change
 * here, and an unrecognised value falls through to no filter rather than an empty
 * page.
 */
function parseMethod(value: string | undefined): PaymentMethod | undefined {
  return value && value in PAYMENT_METHOD_LABELS
    ? (value as PaymentMethod)
    : undefined;
}

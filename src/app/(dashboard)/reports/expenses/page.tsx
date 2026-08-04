/**
 * EXPENSE BREAKDOWN REPORT
 *
 * Where the money went, and how it compares to what came in. The expenses list
 * answers "what did I spend"; this answers "on what, and could I afford it".
 *
 * Manager and above. Not because the numbers are more sensitive than the list —
 * an employee who can log an expense can already see the list — but because this
 * page puts revenue next to costs, and the whole business's takings is owner and
 * manager information. Matches the Reports nav item's minimumRole.
 *
 * Reuses the expenses period presets rather than defining report periods. A
 * breakdown of "this month" has to mean the same month the list means, or the two
 * screens disagree about the same question.
 *
 * Deliberately NOT called profit. Revenue minus expenses ignores what the stock
 * cost, so it overstates what the business actually made — see the same note on
 * the dashboard's MonthSummary. Real gross profit needs sale_items.cost_price,
 * which is a different query and its own report.
 */

import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { MetricCard } from '@/features/dashboard/components/MetricCard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CategoryBreakdown } from '@/features/expenses/components/CategoryBreakdown';
import { ExpenseReportPeriods } from '@/features/expenses/components/ExpenseReportPeriods';
import {
  EXPENSE_PERIODS,
  expensePeriodStart,
  parseExpensePeriod,
} from '@/features/expenses/categories';
import { summarizeByCategory } from '@/features/expenses/business-rules';
import { getExpenseService } from '@/features/expenses/server';
import { getSaleService } from '@/features/sales/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

export const metadata = {
  title: 'Expense breakdown',
};

interface ExpenseReportPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function ExpenseReportPage({
  searchParams,
}: ExpenseReportPageProps) {
  await requireMinimumRole('manager');

  const params = await searchParams;
  const period = parseExpensePeriod(params.period);
  const from = expensePeriodStart(period);

  const [{ service: expenseService }, { service: saleService }] = await Promise.all([
    getExpenseService(),
    getSaleService(),
  ]);

  // Expenses come back as rows rather than as a pre-summed total because the
  // breakdown needs the categories anyway, and summarizing them here means the
  // headline figure and the bars are computed from one dataset. Two queries would
  // let them disagree.
  const [expensesResult, revenueResult] = await Promise.all([
    expenseService.list({ dateFrom: from }),
    saleService.revenueForPeriod(from),
  ]);

  const periodLabel =
    EXPENSE_PERIODS.find((entry) => entry.value === period)?.label ?? '';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.expenses.list}>
          <ArrowLeft aria-hidden="true" />
          Expenses
        </Link>
      </Button>

      <PageHeader
        title="Expense breakdown"
        description="What you spent it on, and how it sits against what came in."
      />

      <Suspense fallback={<div className="h-10" />}>
        <ExpenseReportPeriods />
      </Suspense>

      {!expensesResult.success ? (
        <Alert variant="destructive">
          <AlertDescription>{expensesResult.error}</AlertDescription>
        </Alert>
      ) : expensesResult.data.length === 0 ? (
        <EmptyState
          title="Nothing to break down"
          description={`No expenses recorded ${periodLabel.toLowerCase()}. Try a longer period, or record what you have spent.`}
          icon={<Receipt className="size-6" aria-hidden="true" />}
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.expenses.new}>Record an expense</Link>
            </Button>
          }
        />
      ) : (
        <>
          <InOutSummary
            spent={expensesResult.data.reduce((sum, e) => sum + e.amount, 0)}
            // null rather than 0 when the read failed: "no sales" and "we could
            // not load your sales" are different answers, and MetricCard already
            // renders null as a dash with an explanation.
            earned={revenueResult.success ? revenueResult.data : null}
            periodLabel={periodLabel}
          />

          <CategoryBreakdown summary={summarizeByCategory(expensesResult.data)} />
        </>
      )}
    </div>
  );
}

/**
 * Money in, money out, and the gap between them.
 *
 * The gap is labelled "Difference" and captioned, not "Profit". See the note at
 * the top of this file — calling it profit would hand the owner a number that
 * looks like earnings but ignores what the goods cost, and they might price
 * against it.
 */
function InOutSummary({
  spent,
  earned,
  periodLabel,
}: {
  spent: number;
  earned: number | null;
  periodLabel: string;
}) {
  const difference = earned === null ? null : earned - spent;

  return (
    <section aria-label="Money in and out" className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Money in"
          value={earned === null ? null : formatMoney(earned)}
          detail={`Sales, ${periodLabel.toLowerCase()}`}
          icon={TrendingUp}
          tone="positive"
        />

        <MetricCard
          label="Money out"
          value={formatMoney(spent)}
          detail={`Expenses, ${periodLabel.toLowerCase()}`}
          icon={TrendingDown}
          tone="warning"
        />

        <MetricCard
          label="Difference"
          value={difference === null ? null : formatMoney(difference)}
          detail={
            difference === null
              ? undefined
              : difference < 0
                ? 'You spent more than you took'
                : 'Before stock costs'
          }
          icon={Wallet}
          tone={difference !== null && difference < 0 ? 'debt' : 'default'}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        This is not profit. It counts what you invoiced against what you spent, and
        ignores what the stock itself cost you.
      </p>
    </section>
  );
}

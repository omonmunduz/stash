/**
 * Dashboard home.
 *
 * The first screen after sign-in, and for the target user the only one they may
 * look at on a slow day. It answers three questions in order of how often they
 * are asked: what am I owed, who owes it, and what happened this month.
 *
 * Receivables come first because the first customer's business runs on credit —
 * "how much is out there" is the number they currently track in a paper notebook.
 *
 * No guard here: the (dashboard) layout already ran requireActiveUser(), so
 * reaching this component means an active, onboarded user. requireActiveUser() is
 * called again rather than passed down because layouts cannot pass props to
 * pages — the second call hits the same request-scoped Supabase session, not a
 * second round of auth.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Receipt, TrendingUp, Users, Wallet, PackageX } from 'lucide-react';

import { requireActiveUser } from '@/features/auth/guards';
import { getDashboardMetrics } from '@/features/dashboard/metrics';
import { MetricCard } from '@/features/dashboard/components/MetricCard';
import { TopDebtors } from '@/features/dashboard/components/TopDebtors';
import { SetupChecklist } from '@/features/dashboard/components/SetupChecklist';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';
import type { OrganizationId } from '@/lib/types/common';

export const metadata = {
  title: 'Dashboard',
  description: 'Business overview',
};

/** First name only. "Welcome back, Maria" reads better than the full legal name. */
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function monthLabel(): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
}

export default async function DashboardPage() {
  const user = await requireActiveUser();

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Welcome back, {firstName(user.fullName)}
        </h1>
        <p className="text-sm text-muted-foreground">{user.organization.name}</p>
      </header>

      {/*
        Streamed: the header and quick actions paint immediately while the six
        aggregate queries run. On a phone connection that is the difference
        between a usable screen and a blank one.
      */}
      <Suspense fallback={<MetricsSkeleton />}>
        <DashboardContent organizationId={user.organizationId} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ organizationId }: { organizationId: OrganizationId }) {
  const metrics = await getDashboardMetrics(organizationId);

  return (
    <div className="space-y-6">
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Owed to you"
          value={metrics.totalReceivable === null ? null : formatMoney(metrics.totalReceivable)}
          detail={
            metrics.customersInDebt === null
              ? undefined
              : `across ${metrics.customersInDebt} ${
                  metrics.customersInDebt === 1 ? 'customer' : 'customers'
                }`
          }
          icon={Wallet}
          tone={metrics.totalReceivable && metrics.totalReceivable > 0 ? 'debt' : 'positive'}
          href={`${ROUTES.customers.list}?debt=1`}
        />

        <MetricCard
          label={`Sales in ${monthLabel()}`}
          value={
            metrics.salesThisMonth === null ? null : formatMoney(metrics.salesThisMonth.total)
          }
          detail={
            metrics.salesThisMonth === null
              ? undefined
              : `${metrics.salesThisMonth.count} ${
                  metrics.salesThisMonth.count === 1 ? 'sale' : 'sales'
                }`
          }
          icon={TrendingUp}
        />

        <MetricCard
          label="Customers"
          value={metrics.customerCount === null ? null : String(metrics.customerCount)}
          detail="active"
          icon={Users}
          href={ROUTES.customers.list}
        />

        <MetricCard
          label="Out of stock"
          value={metrics.outOfStockCount === null ? null : String(metrics.outOfStockCount)}
          detail={metrics.outOfStockCount === 0 ? 'everything in stock' : 'products at zero'}
          icon={PackageX}
          tone={metrics.outOfStockCount && metrics.outOfStockCount > 0 ? 'warning' : 'default'}
        />
      </section>

      <QuickActions />

      <div className="grid gap-4 lg:grid-cols-2">
        <TopDebtors debtors={metrics.topDebtors} totalInDebt={metrics.customersInDebt} />

        <div className="space-y-4">
          <SetupChecklist
            hasProducts={metrics.setup.hasProducts}
            hasCustomers={metrics.setup.hasCustomers}
            hasSales={metrics.setup.hasSales}
          />

          <MonthSummary
            sales={metrics.salesThisMonth?.total ?? null}
            expenses={metrics.expensesThisMonth}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The two things done most often, one tap from the home screen.
 *
 * Recording a sale is the more frequent action but is not built yet, so only the
 * customer action is live. Both stay visible so the layout does not shift when
 * sales lands.
 */
function QuickActions() {
  return (
    <section aria-label="Quick actions" className="flex flex-wrap gap-2">
      <Button asChild>
        <Link href={ROUTES.customers.new}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New customer
        </Link>
      </Button>
      <Button variant="outline" disabled>
        <Receipt className="mr-2 h-4 w-4" aria-hidden="true" />
        Record sale (soon)
      </Button>
    </section>
  );
}

/**
 * Money in vs money out for the current month.
 *
 * Deliberately not called "profit": sales revenue minus expenses is not profit
 * (it ignores cost of goods sold), and mislabelling it would give the owner a
 * number they might act on. Real profit reporting comes with the reports feature,
 * which can join sale_items.cost_price.
 */
function MonthSummary({
  sales,
  expenses,
}: {
  sales: number | null;
  expenses: number | null;
}) {
  const rows = [
    { label: 'Sales', value: sales, tone: 'text-success' },
    { label: 'Expenses', value: expenses, tone: 'text-destructive' },
  ];

  return (
    <section
      aria-labelledby="month-summary-heading"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <h2 id="month-summary-heading" className="text-sm font-semibold">
        {monthLabel()} so far
      </h2>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className={`text-sm font-medium tabular-nums ${row.tone}`}>
              {row.value === null ? '—' : formatMoney(row.value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Money in and out. Profit needs product costs, which comes with reports.
      </p>
    </section>
  );
}

function MetricsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[104px] animate-pulse rounded-lg border border-border bg-card"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    </div>
  );
}

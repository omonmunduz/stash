/**
 * TOP DEBTORS
 *
 * The "who to chase" list. This is the single most valuable thing on the home
 * screen for the first customer: the business runs on credit, and the daily
 * question is which five people owe the most.
 *
 * Each row links straight to the customer, because seeing a name here is
 * usually followed by wanting to call them or record a payment.
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

interface Debtor {
  id: string;
  name: string;
  business_name: string | null;
  current_balance: number;
  credit_limit: number | null;
}

interface TopDebtorsProps {
  debtors: Debtor[];
  /** Total number of customers who owe, so the footer can say "and N more". */
  totalInDebt: number | null;
}

export function TopDebtors({ debtors, totalInDebt }: TopDebtorsProps) {
  const remaining = totalInDebt === null ? 0 : Math.max(0, totalInDebt - debtors.length);

  return (
    <section
      aria-labelledby="top-debtors-heading"
      className="rounded-lg border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 id="top-debtors-heading" className="text-sm font-semibold">
            Who owes the most
          </h2>
          <p className="text-xs text-muted-foreground">Largest outstanding balances</p>
        </div>
        <Link
          href={`${ROUTES.customers.list}?debt=1`}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          See all
        </Link>
      </div>

      {debtors.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Nobody owes you anything right now.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {debtors.map((debtor) => {
            const overLimit =
              debtor.credit_limit !== null &&
              debtor.credit_limit > 0 &&
              debtor.current_balance > debtor.credit_limit;

            return (
              <li key={debtor.id}>
                <Link
                  href={ROUTES.customers.detail(debtor.id)}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {debtor.business_name ?? debtor.name}
                    </span>
                    {debtor.business_name ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {debtor.name}
                      </span>
                    ) : null}
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-right">
                      <span className="block text-sm font-semibold tabular-nums text-destructive">
                        {formatMoney(debtor.current_balance)}
                      </span>
                      {overLimit ? (
                        <span className="block text-xs font-medium text-amber-600">
                          Over limit
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {remaining > 0 ? (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          and {remaining} more {remaining === 1 ? 'customer' : 'customers'} with a balance
        </p>
      ) : null}
    </section>
  );
}

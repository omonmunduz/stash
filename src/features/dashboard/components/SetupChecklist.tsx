/**
 * SETUP CHECKLIST
 *
 * Shown only while the organization is still empty. Its state comes from real
 * row counts, not from a stored "onboarding_step" column — the checklist can
 * therefore never disagree with the data, and a user who imports rows another
 * way sees the step tick itself off.
 *
 * It disappears on its own once all three steps are done, which is why there is
 * no dismiss button: nothing to dismiss for long, and a dismissed checklist that
 * hides real setup gaps is worse than one that lingers a day.
 */

import Link from 'next/link';
import { Check, Circle, Clock } from 'lucide-react';

import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';

interface SetupChecklistProps {
  hasProducts: boolean;
  hasCustomers: boolean;
  hasSales: boolean;
}

export function SetupChecklist({
  hasProducts,
  hasCustomers,
  hasSales,
}: SetupChecklistProps) {
  const steps = [
    {
      label: 'Add your customers',
      detail: 'The people who buy from you, with their credit limits.',
      done: hasCustomers,
      href: ROUTES.customers.new,
      cta: 'Add a customer',
      ready: true,
    },
    {
      label: 'Add your products',
      detail: 'What you sell, with cost and sale price.',
      done: hasProducts,
      href: ROUTES.products.new,
      cta: 'Add a product',
      // Products CRUD is not built yet. Showing the step without a working link
      // is honest about the order of work rather than pointing at a 404.
      ready: false,
    },
    {
      label: 'Record your first sale',
      detail: 'Cash or on credit. Balances update themselves.',
      done: hasSales,
      href: ROUTES.sales.new,
      cta: 'Record a sale',
      ready: false,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section
      aria-labelledby="setup-heading"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="setup-heading" className="text-sm font-semibold">
          Get set up
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {doneCount} of {steps.length}
        </span>
      </div>

      <ol className="mt-3 space-y-3">
        {steps.map((step) => (
          <li key={step.label} className="flex gap-3">
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              {step.done ? (
                <Check className="h-4 w-4 text-success" />
              ) : step.ready ? (
                <Circle className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-sm font-medium',
                  step.done && 'text-muted-foreground line-through'
                )}
              >
                {step.label}
              </span>

              {!step.done ? (
                <>
                  <span className="block text-xs text-muted-foreground">
                    {step.detail}
                  </span>
                  {step.ready ? (
                    <Link
                      href={step.href}
                      className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      {step.cta}
                    </Link>
                  ) : (
                    <span className="mt-1 inline-block text-xs text-muted-foreground">
                      Coming soon
                    </span>
                  )}
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

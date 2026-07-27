/**
 * BALANCE PRESENTATION
 *
 * Small display components shared by the list and detail views, so "how a
 * balance looks" is decided once.
 *
 * The rule they encode: a balance is only alarming relative to the customer's
 * credit limit. 500 owed against a 5,000 limit is routine; 500 against a 400
 * limit needs attention. A customer with no limit set is never shown as
 * over-limit, because there is nothing to be over.
 */

import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/utils/format';
import { availableCredit } from '../business-rules';
import type { Customer } from '../types';
import { cn } from '@/lib/utils/cn';

/** Where a customer sits against their credit limit. */
export type CreditStanding = 'settled' | 'in_credit' | 'ok' | 'near_limit' | 'over_limit';

/**
 * Classify a customer's credit position.
 *
 * near_limit fires at 80% of the limit — early enough to act on before the next
 * order is refused, late enough not to cry wolf.
 */
export function getCreditStanding(customer: Customer): CreditStanding {
  if (customer.current_balance < 0) return 'in_credit';
  if (customer.current_balance === 0) return 'settled';
  if (customer.credit_limit === null) return 'ok';
  if (customer.current_balance > customer.credit_limit) return 'over_limit';
  if (customer.current_balance >= customer.credit_limit * 0.8) return 'near_limit';
  return 'ok';
}

/**
 * A customer's balance as a coloured number.
 *
 * Red is reserved for over-limit rather than for any debt at all. Most
 * customers of a wholesale business carry a balance most of the time — colouring
 * that red would make the whole list look like a problem.
 */
export function BalanceAmount({
  customer,
  className,
}: {
  customer: Customer;
  className?: string;
}) {
  const standing = getCreditStanding(customer);

  const tone =
    standing === 'over_limit'
      ? 'text-destructive'
      : standing === 'near_limit'
        ? 'text-amber-700'
        : standing === 'settled'
          ? 'text-muted-foreground'
          : 'text-foreground';

  return (
    <span className={cn('font-medium tabular-nums', tone, className)}>
      {formatMoney(customer.current_balance)}
    </span>
  );
}

/**
 * Badge summarizing the credit position. Text carries the meaning; colour only
 * reinforces it.
 */
export function CreditStandingBadge({ customer }: { customer: Customer }) {
  const standing = getCreditStanding(customer);

  switch (standing) {
    case 'settled':
      return <Badge variant="success">Settled</Badge>;
    case 'in_credit':
      return <Badge variant="secondary">In credit</Badge>;
    case 'over_limit':
      return <Badge variant="destructive">Over limit</Badge>;
    case 'near_limit':
      return <Badge variant="warning">Near limit</Badge>;
    case 'ok':
      return <Badge variant="outline">Owes</Badge>;
  }
}

/**
 * One-line credit summary for the detail page.
 * Reuses availableCredit() from business-rules rather than recomputing.
 */
export function CreditSummary({ customer }: { customer: Customer }) {
  if (customer.credit_limit === null) {
    return (
      <p className="text-sm text-muted-foreground">
        No credit limit set — this customer can buy on credit without a cap.
      </p>
    );
  }

  const available = availableCredit(customer);
  const over = customer.current_balance > customer.credit_limit;

  return (
    <p className="text-sm text-muted-foreground">
      {over ? (
        <>
          Over their {formatMoney(customer.credit_limit)} limit by{' '}
          <span className="font-medium text-destructive">
            {formatMoney(customer.current_balance - customer.credit_limit)}
          </span>
        </>
      ) : (
        <>
          <span className="font-medium text-foreground">{formatMoney(available)}</span> of{' '}
          {formatMoney(customer.credit_limit)} credit still available
        </>
      )}
    </p>
  );
}

/**
 * SALE ACTIONS
 *
 * Cancel or delete one transaction, from its own page.
 *
 * The two are deliberately different operations at different permission levels:
 *
 * - Cancel (manager+) reverses the sale but leaves it visible. Stock goes back,
 *   the debt comes off the tab, and the row still reads "cancelled" on every
 *   list. This is the honest record of "we took this back".
 * - Delete (admin+) cancels and then hides it. For a sale entered against the
 *   wrong customer, where leaving a cancelled row on that customer's tab would
 *   be its own kind of wrong.
 *
 * Both confirm, and both spell out what moves — the stock, the balance, and any
 * payments that were covering it. A number changing on another screen after a
 * click is how people lose trust in a ledger.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cancelSaleAction, voidSaleAction } from '@/app/actions/sales';
import type { SaleStatus } from '../types';
import { ROUTES } from '@/lib/constants/routes';

interface SaleActionsProps {
  saleId: string;
  customerId: string;
  status: SaleStatus;
  /** Manager and above: may cancel. */
  canEdit: boolean;
  /** Admin and above: may delete outright. */
  canDelete: boolean;
}

export function SaleActions({
  saleId,
  customerId,
  status,
  canEdit,
  canDelete,
}: SaleActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCancelled = status === 'cancelled';

  if (!canEdit && !canDelete) return null;

  const cancel = () => {
    const confirmed = window.confirm(
      'Cancel this sale?\n\n' +
        'The stock goes back on the shelf and the debt comes off the customer’s tab. ' +
        'Any payments that were covering it become credit on their account.\n\n' +
        'The sale stays visible, marked cancelled.'
    );

    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      const result = await cancelSaleAction(saleId);
      if (!result.success) setError(result.error);
    });
  };

  const remove = () => {
    const confirmed = window.confirm(
      'Delete this transaction?\n\n' +
        'It is cancelled and then hidden from every list. The stock goes back, the tab is ' +
        'corrected, and any payments covering it become account credit.\n\n' +
        'Use this for a sale recorded against the wrong customer. This cannot be undone here.'
    );

    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      const result = await voidSaleAction(saleId, customerId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      // The sale no longer appears anywhere, so staying on its page would show a
      // record that has left every list. The customer's tab is where the
      // corrected balance is, which is what someone doing this wants to see.
      router.push(ROUTES.customers.detail(customerId));
    });
  };

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        {canEdit && !isCancelled && (
          <Button type="button" variant="outline" disabled={isPending} onClick={cancel}>
            <Ban aria-hidden="true" />
            Cancel sale
          </Button>
        )}

        {canDelete && (
          <Button type="button" variant="outline" disabled={isPending} onClick={remove}>
            <Trash2 className="text-destructive" aria-hidden="true" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

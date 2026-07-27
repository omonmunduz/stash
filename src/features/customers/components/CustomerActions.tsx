/**
 * CUSTOMER ACTIONS
 *
 * Deactivate / reactivate / delete for the detail page.
 *
 * Deactivate is the prominent action and delete is tucked behind a confirm,
 * because deactivating is what the user almost always wants: it stops new sales
 * while keeping the history that proves what was owed. Deletion is only ever
 * valid for a customer entered by mistake, and the service refuses it outright
 * while a balance is outstanding.
 *
 * window.confirm rather than a modal: no dialog primitive exists in the project
 * yet, and inventing one here to guard a rare action would be the wrong place to
 * introduce it. It is accessible and it blocks — both of which matter more than
 * how it looks.
 */

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { deleteCustomerAction, setCustomerActiveAction } from '@/app/actions/customers';
import type { Customer } from '../types';

interface CustomerActionsProps {
  customer: Customer;
  /** Whether the viewer may edit — manager and above. */
  canEdit: boolean;
  /** Whether the viewer may delete — admin and above. */
  canDelete: boolean;
}

export function CustomerActions({ customer, canEdit, canDelete }: CustomerActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canEdit && !canDelete) return null;

  const handleToggleActive = () => {
    setError(null);
    startTransition(async () => {
      const result = await setCustomerActiveAction(customer.id, !customer.is_active);
      if (!result.success) setError(result.error);
    });
  };

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Delete ${customer.name}? Their sales history stays on record, but they will no longer appear anywhere in the app. Deactivate instead if they might come back.`
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteCustomerAction(customer.id);
      // Only reached on failure — the action redirects to the list on success.
      if (!result.success) setError(result.error);
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={isPending}>
            {isPending
              ? 'Working...'
              : customer.is_active
                ? 'Deactivate'
                : 'Reactivate'}
          </Button>
        )}

        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * APPOINTMENT ACTIONS
 *
 * Action buttons for appointment status changes.
 * Shows different actions based on current status.
 */

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  confirmAppointmentAction,
  completeAppointmentAction,
  cancelAppointmentAction,
  markNoShowAction,
} from '@/app/actions/appointments';
import type { AppointmentWithDetails } from '../types';
import { CheckCircle, XCircle, X, AlertCircle } from 'lucide-react';

interface AppointmentActionsProps {
  appointment: AppointmentWithDetails;
}

export function AppointmentActions({ appointment }: AppointmentActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAction = async (
    action: () => Promise<{ success: true } | { success: false; error: string }>,
    successMessage: string
  ) => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await action();
      if (result.success) {
        setSuccess(successMessage);
      } else {
        setError(result.error);
      }
    });
  };

  // Don't show actions for completed, cancelled, or no-show appointments
  if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
    return (
      <p className="text-sm text-muted-foreground">
        {appointment.status === 'completed'
          ? 'This appointment has been completed.'
          : appointment.status === 'cancelled'
            ? 'This appointment was cancelled.'
            : 'Customer did not show up.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {appointment.status === 'pending' && (
          <Button
            size="sm"
            onClick={() =>
              handleAction(
                () => confirmAppointmentAction(appointment.id),
                'Appointment confirmed'
              )
            }
            disabled={isPending}
          >
            <CheckCircle className="size-4" aria-hidden="true" />
            Confirm
          </Button>
        )}

        {appointment.status === 'confirmed' && (
          <>
            <Button
              size="sm"
              onClick={() =>
                handleAction(
                  () => completeAppointmentAction(appointment.id),
                  'Appointment marked as completed'
                )
              }
              disabled={isPending}
            >
              <CheckCircle className="size-4" aria-hidden="true" />
              Complete
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleAction(
                  () => markNoShowAction(appointment.id),
                  'Marked as no-show'
                )
              }
              disabled={isPending}
            >
              <AlertCircle className="size-4" aria-hidden="true" />
              No-show
            </Button>
          </>
        )}

        <Button
          size="sm"
          variant="destructive"
          onClick={() =>
            handleAction(
              () => cancelAppointmentAction(appointment.id),
              'Appointment cancelled'
            )
          }
          disabled={isPending}
        >
          <X className="size-4" aria-hidden="true" />
          Cancel
        </Button>
      </div>

      {appointment.status === 'completed' && (
        <p className="text-sm text-muted-foreground">
          💡 Tip: You can convert this to a sale to record the payment.
        </p>
      )}
    </div>
  );
}

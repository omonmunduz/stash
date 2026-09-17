/**
 * DELETE EMPLOYEE BUTTON
 *
 * Confirmation button for deleting an employee.
 * Soft delete (sets deleted_at) - does not remove from database.
 */

'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { deleteEmployeeAction } from '@/app/actions/employees';
import type { EmployeeId } from '../types';

interface DeleteEmployeeButtonProps {
  employeeId: EmployeeId;
  employeeName: string;
}

export function DeleteEmployeeButton({
  employeeId,
  employeeName,
}: DeleteEmployeeButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${employeeName}?\n\nThis will:\n• Remove the employee from the active list\n• Keep historical records and past appointments\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setError(null);

    startTransition(async () => {
      const result = await deleteEmployeeAction(employeeId);

      if (!result.success) {
        setError(result.error);
      }
      // On success, the action redirects automatically
    });
  };

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {isPending ? 'Deleting...' : 'Delete Employee'}
      </Button>
    </div>
  );
}

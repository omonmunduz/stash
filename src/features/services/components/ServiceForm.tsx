/**
 * SERVICE FORM
 *
 * One component for create and edit. Handles:
 * - Name (required)
 * - Description
 * - Duration in minutes (required)
 * - Price (required)
 * - Which employees can perform this service (multi-select)
 * - Active status
 */

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createServiceAction, updateServiceAction } from '@/app/actions/services';
import type { ServiceFormValues } from '@/app/actions/services';
import type { ServiceWithProviders } from '../types';
import type { EmployeeLookup } from '@/features/employees/types';

interface ServiceFormProps {
  service?: ServiceWithProviders;
  employees: EmployeeLookup[];
}

export function ServiceForm({ service, employees }: ServiceFormProps) {
  const isEdit = service !== undefined;

  const [values, setValues] = useState<ServiceFormValues>({
    name: service?.name ?? '',
    description: service?.description ?? '',
    duration_minutes: service ? String(service.duration_minutes) : '',
    price: service ? String(service.price) : '',
    provider_employee_ids: service?.providers.map((p) => p.employee_id) ?? [],
    is_active: service?.is_active ?? true,
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (field: keyof ServiceFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const toggleProvider = (employeeId: string) => {
    setValues((prev) => ({
      ...prev,
      provider_employee_ids: prev.provider_employee_ids.includes(employeeId)
        ? prev.provider_employee_ids.filter((id) => id !== employeeId)
        : [...prev.provider_employee_ids, employeeId],
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateServiceAction(service.id, values)
        : await createServiceAction(values);

      if (!result.success) setError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">Service details</legend>

        <div className="space-y-2">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={set('name')}
            placeholder="Haircut"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={values.description}
            onChange={set('description')}
            placeholder="Classic cut and style"
            rows={2}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="duration_minutes">
              Duration (minutes) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="duration_minutes"
              type="number"
              min="1"
              step="1"
              value={values.duration_minutes}
              onChange={set('duration_minutes')}
              placeholder="30"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">
              Price <span className="text-destructive">*</span>
            </Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={values.price}
              onChange={set('price')}
              placeholder="25.00"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Who can perform this service?</Label>
          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No employees yet. Add employees first to assign them to services.
            </p>
          ) : (
            <div className="space-y-2 rounded-lg border border-border p-3">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`provider-${employee.id}`}
                    checked={values.provider_employee_ids.includes(employee.id)}
                    onCheckedChange={() => toggleProvider(employee.id)}
                  />
                  <Label
                    htmlFor={`provider-${employee.id}`}
                    className="cursor-pointer font-normal"
                  >
                    {employee.display_name}
                  </Label>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Customers can book this service with any selected employee
          </p>
        </div>

        {isEdit && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={values.is_active}
              onCheckedChange={(checked) =>
                setValues((prev) => ({ ...prev, is_active: checked === true }))
              }
            />
            <Label htmlFor="is_active" className="cursor-pointer font-normal">
              Active (available for booking)
            </Label>
          </div>
        )}
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isEdit ? 'Save changes' : 'Create service'}
        </Button>
      </div>
    </form>
  );
}

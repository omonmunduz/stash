/**
 * APPOINTMENT FORM
 *
 * Create staff-initiated appointments for customers.
 * Form fields: customer, service, employee, date, time, notes.
 *
 * Employee list is filtered based on selected service - only shows
 * employees who can perform that service (via service_providers table).
 */

'use client';

import { useState, useTransition, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createAppointmentAction } from '@/app/actions/appointments';
import type { AppointmentFormValues } from '@/app/actions/appointments';
import type { CustomerId } from '@/lib/types/common';
import type { ServiceId } from '@/features/services/types';
import type { EmployeeId } from '@/features/employees/types';

interface AppointmentFormProps {
  customers: Array<{ id: CustomerId; name: string; customer_code: string }>;
  services: Array<{
    id: ServiceId;
    name: string;
    duration_minutes: number;
    provider_employee_ids: EmployeeId[];
  }>;
  employees: Array<{ id: EmployeeId; display_name: string }>;
}

export function AppointmentForm({ customers, services, employees }: AppointmentFormProps) {
  const t = useTranslations('appointments.form');
  const tCommon = useTranslations('common.actions');

  const [values, setValues] = useState<AppointmentFormValues>({
    customer_id: '',
    service_id: '',
    employee_id: '',
    appointment_date: '',
    start_time: '',
    notes: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (field: keyof AppointmentFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setValues((previous) => {
      const updated = { ...previous, [field]: event.target.value };

      // Reset employee when service changes
      if (field === 'service_id') {
        updated.employee_id = '';
      }

      return updated;
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createAppointmentAction(values);
      if (!result.success) setError(result.error);
      // On success, the action redirects
    });
  };

  // Get selected service
  const selectedService = services.find((s) => s.id === values.service_id);
  const durationMinutes = selectedService?.duration_minutes || 0;

  // Filter employees based on selected service
  const availableEmployees = useMemo(() => {
    if (!values.service_id) {
      return employees;
    }

    const service = services.find((s) => s.id === values.service_id);
    if (!service) {
      return [];
    }

    // Only show employees who can perform this service
    return employees.filter((emp) => service.provider_employee_ids.includes(emp.id));
  }, [values.service_id, services, employees]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-4" disabled={isPending}>
        {/* Customer selection */}
        <div className="space-y-2">
          <Label htmlFor="customer_id">
            {t('customer')} <span className="text-destructive">*</span>
          </Label>
          <select
            id="customer_id"
            value={values.customer_id}
            onChange={set('customer_id')}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{t('selectCustomer')}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.customer_code})
              </option>
            ))}
          </select>
        </div>

        {/* Service selection */}
        <div className="space-y-2">
          <Label htmlFor="service_id">
            {t('service')} <span className="text-destructive">*</span>
          </Label>
          <select
            id="service_id"
            value={values.service_id}
            onChange={set('service_id')}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{t('selectService')}</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.duration_minutes} {t('minutes')})
              </option>
            ))}
          </select>
          {durationMinutes > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('duration', { minutes: durationMinutes })}
            </p>
          )}
        </div>

        {/* Employee selection */}
        <div className="space-y-2">
          <Label htmlFor="employee_id">
            {t('employee')} <span className="text-destructive">*</span>
          </Label>
          <select
            id="employee_id"
            value={values.employee_id}
            onChange={set('employee_id')}
            required
            disabled={!values.service_id}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              {!values.service_id
                ? t('selectServiceFirst')
                : availableEmployees.length === 0
                  ? t('noEmployeesAvailable')
                  : t('selectEmployee')}
            </option>
            {availableEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.display_name}
              </option>
            ))}
          </select>
          {values.service_id && availableEmployees.length === 0 && (
            <p className="text-xs text-destructive">
              {t('noEmployeesAssigned')}
            </p>
          )}
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="appointment_date">
            {t('date')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="appointment_date"
            type="date"
            value={values.appointment_date}
            onChange={set('appointment_date')}
            required
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Time */}
        <div className="space-y-2">
          <Label htmlFor="start_time">
            {t('startTime')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="start_time"
            type="time"
            value={values.start_time}
            onChange={set('start_time')}
            required
          />
          <p className="text-xs text-muted-foreground">
            {t('timeSlotHelp')}
          </p>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">{t('notes')}</Label>
          <Textarea
            id="notes"
            value={values.notes}
            onChange={set('notes')}
            placeholder={t('notesPlaceholder')}
            rows={3}
          />
        </div>
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('scheduling') : t('scheduleAppointment')}
        </Button>
      </div>
    </form>
  );
}

/**
 * NEW APPOINTMENT PAGE
 *
 * Create a new appointment for a customer.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppointmentForm } from '@/features/appointments/components/AppointmentForm';
import { getCustomerService } from '@/features/customers/server';
import { getServiceService } from '@/features/services/server';
import { getEmployeeService } from '@/features/employees/server';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'New Appointment',
};

export default async function NewAppointmentPage() {
  // Fetch required data for the form
  const [customersResult, servicesResult, employeesResult] = await Promise.all([
    (await getCustomerService()).service.list({ status: 'active' }),
    (await getServiceService()).service.listWithProviders({ is_active: true }),
    (await getEmployeeService()).service.list({ is_active: true }),
  ]);

  const hasError = !customersResult.success || !servicesResult.success || !employeesResult.success;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.appointments.list}>
          <ArrowLeft aria-hidden="true" />
          Appointments
        </Link>
      </Button>

      <PageHeader
        title="New Appointment"
        description="Schedule an appointment for a customer"
      />

      {hasError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {!customersResult.success
              ? customersResult.error
              : !servicesResult.success
                ? servicesResult.error
                : !employeesResult.success
                  ? employeesResult.error
                  : 'Failed to load data'}
          </AlertDescription>
        </Alert>
      ) : customersResult.data.length === 0 ? (
        <Alert>
          <AlertDescription>
            You need to add customers before scheduling appointments.{' '}
            <Link href={ROUTES.customers.new} className="underline">
              Add a customer
            </Link>
          </AlertDescription>
        </Alert>
      ) : servicesResult.data.length === 0 ? (
        <Alert>
          <AlertDescription>
            You need to add services before scheduling appointments.{' '}
            <Link href={ROUTES.services.new} className="underline">
              Add a service
            </Link>
          </AlertDescription>
        </Alert>
      ) : employeesResult.data.length === 0 ? (
        <Alert>
          <AlertDescription>
            You need to add employees before scheduling appointments.{' '}
            <Link href={ROUTES.employees.new} className="underline">
              Add an employee
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6">
          <AppointmentForm
            customers={customersResult.data.map((c) => ({
              id: c.id,
              name: c.name,
              customer_code: c.customer_code,
            }))}
            services={servicesResult.data.map((s) => ({
              id: s.id,
              name: s.name,
              duration_minutes: s.duration_minutes,
              provider_employee_ids: s.providers.map((p) => p.employee_id),
            }))}
            employees={employeesResult.data.map((e) => ({
              id: e.id,
              display_name: e.display_name,
            }))}
          />
        </div>
      )}
    </div>
  );
}

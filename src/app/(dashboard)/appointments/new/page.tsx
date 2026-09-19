/**
 * NEW APPOINTMENT PAGE
 *
 * Create a new appointment for a customer.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('appointments.new');

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
          {t('backToAppointments')}
        </Link>
      </Button>

      <PageHeader
        title={t('title')}
        description={t('description')}
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
                  : t('failedToLoad')}
          </AlertDescription>
        </Alert>
      ) : customersResult.data.length === 0 ? (
        <Alert>
          <AlertDescription>
            {t('needCustomers')}{' '}
            <Link href={ROUTES.customers.new} className="underline">
              {t('addCustomer')}
            </Link>
          </AlertDescription>
        </Alert>
      ) : servicesResult.data.length === 0 ? (
        <Alert>
          <AlertDescription>
            {t('needServices')}{' '}
            <Link href={ROUTES.services.new} className="underline">
              {t('addService')}
            </Link>
          </AlertDescription>
        </Alert>
      ) : employeesResult.data.length === 0 ? (
        <Alert>
          <AlertDescription>
            {t('needEmployees')}{' '}
            <Link href={ROUTES.employees.new} className="underline">
              {t('addEmployee')}
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

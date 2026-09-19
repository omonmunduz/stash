/**
 * EMPLOYEES LIST PAGE
 *
 * Manage staff who perform services. Admin-only access.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, UserCog } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmployeeList } from '@/features/employees/components/EmployeeList';
import { getEmployeeService } from '@/features/employees/server';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Employees',
};

export default async function EmployeesPage() {
  const { service } = await getEmployeeService();
  const t = await getTranslations('employees');

  const result = await service.list({ is_active: true });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <Button asChild>
            <Link href={ROUTES.employees.new}>
              <Plus aria-hidden="true" />
              {t('addEmployee')}
            </Link>
          </Button>
        }
      />

      {!result.success ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        <EmptyState
          title={t('list.empty.title')}
          description={t('list.empty.description')}
          icon={<UserCog className="size-6" aria-hidden="true" />}
          action={
            <Button asChild>
              <Link href={ROUTES.employees.new}>
                <Plus aria-hidden="true" />
                {t('addFirstEmployee')}
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t('list.count', { count: result.data.length })}
          </p>
          <EmployeeList employees={result.data} />
        </>
      )}
    </div>
  );
}

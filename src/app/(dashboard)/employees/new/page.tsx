/**
 * ADD EMPLOYEE PAGE
 *
 * Admin-only access.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmployeeForm } from '@/features/employees/components/EmployeeForm';
import { requireMinimumRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Add employee',
};

export default async function NewEmployeePage() {
  await requireMinimumRole('admin');
  const t = await getTranslations('employees.new');

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.employees.list}>
          <ArrowLeft aria-hidden="true" />
          {t('backToEmployees')}
        </Link>
      </Button>

      <PageHeader
        title={t('title')}
        description={t('description')}
      />

      <Card>
        <CardContent className="pt-6">
          <EmployeeForm />
        </CardContent>
      </Card>
    </div>
  );
}

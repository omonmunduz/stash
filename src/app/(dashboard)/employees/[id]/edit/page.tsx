/**
 * EDIT EMPLOYEE PAGE
 *
 * Admin-only access.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmployeeForm } from '@/features/employees/components/EmployeeForm';
import { getEmployeeService } from '@/features/employees/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import type { EmployeeId } from '@/features/employees/types';

export const metadata = {
  title: 'Edit employee',
};

interface EditEmployeePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  await requireMinimumRole('admin');

  const { id } = await params;
  const t = await getTranslations('employees.edit');
  const { service } = await getEmployeeService();

  const result = await service.getById(id as EmployeeId);

  if (!result.success) {
    if (result.error.includes('not found')) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </div>
    );
  }

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
        description={result.data.display_name}
      />

      <Card>
        <CardContent className="pt-6">
          <EmployeeForm employee={result.data} />
        </CardContent>
      </Card>
    </div>
  );
}

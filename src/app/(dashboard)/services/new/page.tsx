/**
 * ADD SERVICE PAGE
 *
 * Manager-only access.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ServiceForm } from '@/features/services/components/ServiceForm';
import { getEmployeeService } from '@/features/employees/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Add service',
};

export default async function NewServicePage() {
  await requireMinimumRole('manager');

  // Load employees for provider assignment
  const { service: employeeService } = await getEmployeeService();
  const employeesResult = await employeeService.getLookups();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.services.list}>
          <ArrowLeft aria-hidden="true" />
          Services
        </Link>
      </Button>

      <PageHeader
        title="Add service"
        description="A service your business offers with duration and pricing."
      />

      <Card>
        <CardContent className="pt-6">
          <ServiceForm employees={employeesResult.success ? employeesResult.data : []} />
        </CardContent>
      </Card>
    </div>
  );
}

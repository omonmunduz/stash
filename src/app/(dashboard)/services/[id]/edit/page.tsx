/**
 * EDIT SERVICE PAGE
 *
 * Manager-only access.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ServiceForm } from '@/features/services/components/ServiceForm';
import { getServiceService } from '@/features/services/server';
import { getEmployeeService } from '@/features/employees/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { getSignedUrl } from '@/lib/supabase/storage';
import { ROUTES } from '@/lib/constants/routes';
import type { ServiceId } from '@/features/services/types';

export const metadata = {
  title: 'Edit service',
};

interface EditServicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  await requireMinimumRole('manager');

  const { id } = await params;
  const t = await getTranslations('services.edit');
  const { service: serviceService } = await getServiceService();
  const { service: employeeService } = await getEmployeeService();

  const [result, employeesResult] = await Promise.all([
    serviceService.getWithProviders(id as ServiceId),
    employeeService.getLookups(),
  ]);

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

  // Get signed URL for existing image if present
  let imageUrl: string | null = null;
  if (result.data.image_url) {
    const signedUrlResult = await getSignedUrl('service-images', result.data.image_url);
    if (signedUrlResult.success) {
      imageUrl = signedUrlResult.data.signedUrl;
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.services.list}>
          <ArrowLeft aria-hidden="true" />
          {t('backToServices')}
        </Link>
      </Button>

      <PageHeader
        title={t('title')}
        description={result.data.name}
      />

      <Card>
        <CardContent className="pt-6">
          <ServiceForm
            service={result.data}
            employees={employeesResult.success ? employeesResult.data : []}
            currentImageUrl={imageUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}

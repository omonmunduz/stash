/**
 * SERVICES LIST PAGE
 *
 * Manage services offered by the business. Manager+ access.
 */

import Link from 'next/link';
import { Plus, Scissors } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ServiceList } from '@/features/services/components/ServiceList';
import { getServiceService } from '@/features/services/server';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Services',
};

export default async function ServicesPage() {
  const { service } = await getServiceService();

  const result = await service.list({ is_active: true });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Services"
        description="What you offer: haircuts, styling, treatments."
        action={
          <Button asChild>
            <Link href={ROUTES.services.new}>
              <Plus aria-hidden="true" />
              Add service
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
          title="No services yet"
          description="Add the services your business offers. Each service has a duration and price."
          icon={<Scissors className="size-6" aria-hidden="true" />}
          action={
            <Button asChild>
              <Link href={ROUTES.services.new}>
                <Plus aria-hidden="true" />
                Add your first service
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {result.data.length} {result.data.length === 1 ? 'service' : 'services'}
          </p>
          <ServiceList services={result.data} />
        </>
      )}
    </div>
  );
}

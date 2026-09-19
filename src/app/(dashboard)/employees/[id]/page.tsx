import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Edit } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { getEmployeeService } from '@/features/employees/server';
import { getWorkingHoursService } from '@/features/working-hours/server';
import { Button } from '@/components/ui/button';
import { DeleteEmployeeButton } from '@/features/employees/components/DeleteEmployeeButton';
import { DAY_NAMES } from '@/features/working-hours/types';
import type { EmployeeId } from '@/features/employees/types';

interface EmployeeDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EmployeeDetailPage({
  params,
}: EmployeeDetailPageProps) {
  await requireMinimumRole('manager');

  const { id } = await params;
  const t = await getTranslations('employees.detail');

  const { service: employeeService } = await getEmployeeService();
  const workingHoursService = await getWorkingHoursService();

  const employeeResult = await employeeService.getById(id as EmployeeId);
  if (!employeeResult.success) {
    notFound();
  }

  const employee = employeeResult.data;

  // Get schedule
  const scheduleResult = await workingHoursService.getEmployeeSchedule(
    id
  );
  const schedule = scheduleResult.success ? scheduleResult.data : null;

  const workingDays = schedule?.days.filter((d) => d.is_working) || [];
  const hasSchedule = workingDays.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/employees"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToEmployees')}
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {employee.photo_url ? (
            <img
              src={employee.photo_url}
              alt={employee.display_name}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl font-semibold">
              {employee.display_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {employee.display_name}
            </h1>
            <p className="text-muted-foreground">
              {employee.is_active ? (
                <span className="text-green-600">{t('active')}</span>
              ) : (
                <span className="text-red-600">{t('inactive')}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/employees/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              {t('edit')}
            </Link>
          </Button>
          <DeleteEmployeeButton
            employeeId={employee.id}
            employeeName={employee.display_name}
          />
        </div>
      </div>

      {/* Bio */}
      {employee.bio && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold">{t('about')}</h2>
          <p className="text-muted-foreground">{employee.bio}</p>
        </div>
      )}

      {/* Schedule Section */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('workingHours')}</h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/employees/${id}/schedule`}>
              {hasSchedule ? t('editSchedule') : t('setSchedule')}
            </Link>
          </Button>
        </div>

        <div className="p-6">
          {hasSchedule ? (
            <div className="space-y-2">
              {workingDays.map((day) => (
                <div
                  key={day.day_of_week}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="font-medium">
                    {DAY_NAMES[day.day_of_week]}
                  </span>
                  <span className="text-muted-foreground">
                    {day.start_time} - {day.end_time}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">{t('noSchedule')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('noScheduleDescription')}
              </p>
              <Button asChild className="mt-4">
                <Link href={`/employees/${id}/schedule`}>
                  {t('setSchedule')}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Booking Link */}
      {employee.is_active && hasSchedule && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 text-sm font-medium text-blue-900">
            {t('publicBookingLink')}
          </h3>
          <p className="mb-3 text-sm text-blue-800">
            {t('bookingLinkDescription', { name: employee.display_name })}
          </p>
          <code className="block rounded bg-blue-100 p-2 text-sm text-blue-900">
            {typeof window !== 'undefined'
              ? `${window.location.origin}/book/{'{'}organization-slug{'}'}`
              : '/book/{organization-slug}'}
          </code>
          <p className="mt-2 text-xs text-blue-700">
            {t('replaceSlug')}
          </p>
        </div>
      )}
    </div>
  );
}

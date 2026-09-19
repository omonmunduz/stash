/**
 * APPOINTMENTS LIST PAGE
 *
 * Weekly calendar view of scheduled appointments.
 * Access depends on role:
 * - Admins/Managers: see all appointments
 * - Employees: see only their own (enforced by RLS)
 *
 * The calendar grid always renders, with or without appointments.
 */

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WeeklyCalendar } from '@/features/appointments/components/WeeklyCalendar';
import { getAppointmentService } from '@/features/appointments/server';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Appointments',
};

interface AppointmentsPageProps {
  searchParams: Promise<{ week?: string }>;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust when day is Sunday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSunday(monday: Date): Date {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const params = await searchParams;
  const { service } = await getAppointmentService();
  const t = await getTranslations('appointments');

  // Determine which week to show
  const weekStart = params.week ? new Date(params.week) : getMonday(new Date());
  const weekEnd = getSunday(weekStart);

  // Fetch appointments for the visible week only
  const result = await service.list({
    date_from: weekStart,
    date_to: weekEnd,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <Button asChild>
            <Link href={ROUTES.appointments.new}>
              <Plus aria-hidden="true" />
              {t('newAppointment')}
            </Link>
          </Button>
        }
      />

      {!result.success ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Calendar grid always renders, regardless of appointment count */}
      <WeeklyCalendar
        initialAppointments={result.success ? result.data : []}
        initialWeekStart={weekStart}
      />
    </div>
  );
}

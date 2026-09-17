import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireMinimumRole } from '@/features/auth/guards';
import { getEmployeeService } from '@/features/employees/server';
import { getWorkingHoursService } from '@/features/working-hours/server';
import { WeekScheduleForm } from '@/features/working-hours/components/WeekScheduleForm';
import type { EmployeeId } from '@/features/employees/types';

interface EmployeeSchedulePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EmployeeSchedulePage({
  params,
}: EmployeeSchedulePageProps) {
  // Managers can edit their own schedule, admins can edit any schedule
  await requireMinimumRole('manager');

  const { id } = await params;

  const { service: employeeService } = await getEmployeeService();
  const workingHoursService = await getWorkingHoursService();

  // Get employee details
  const employeeResult = await employeeService.getById(id as EmployeeId);
  if (!employeeResult.success) {
    notFound();
  }

  const employee = employeeResult.data;

  // Get current schedule
  const scheduleResult = await workingHoursService.getEmployeeSchedule(
    id
  );
  if (!scheduleResult.success) {
    throw new Error('Failed to load schedule');
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/employees/${id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {employee.display_name}
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {employee.display_name}&apos;s Schedule
        </h1>
        <p className="text-muted-foreground">
          Set weekly working hours for appointment availability
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <WeekScheduleForm
            initialSchedule={scheduleResult.data}
            employeeName={employee.display_name}
          />
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-2 text-sm font-medium text-blue-900">
          How schedules work
        </h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Check the days this employee is available to work</li>
          <li>• Set start and end times for each working day</li>
          <li>
            • Use &quot;Copy to all&quot; to apply times to all checked days
          </li>
          <li>
            • Use &quot;Mon-Fri 9-5&quot; for a standard business week preset
          </li>
          <li>
            • This schedule controls what appointment times are available on the
            booking page
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * APPOINTMENT LIST
 *
 * Displays appointments with customer, service, employee, date/time, and status.
 */

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AppointmentWithDetails, AppointmentStatus } from '../types';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';
import { Calendar, Clock, User } from 'lucide-react';

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const variants: Record<AppointmentStatus, { variant: any; label: string }> = {
    pending: { variant: 'secondary', label: 'Pending' },
    confirmed: { variant: 'default', label: 'Confirmed' },
    completed: { variant: 'outline', label: 'Completed' },
    cancelled: { variant: 'secondary', label: 'Cancelled' },
    no_show: { variant: 'destructive', label: 'No Show' },
  };

  const { variant, label } = variants[status];
  return <Badge variant={variant as any}>{label}</Badge>;
}

export function AppointmentList({ appointments }: { appointments: AppointmentWithDetails[] }) {
  return (
    <>
      {/* Phone layout */}
      <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
        {appointments.map((appointment) => (
          <li key={appointment.id} className="px-4 py-3">
            <Link
              href={ROUTES.appointments.detail(appointment.id)}
              className="block hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">{appointment.service_name}</p>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="size-3" aria-hidden="true" />
                    <span>{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                    <Clock className="size-3" aria-hidden="true" />
                    <span>{appointment.start_time.slice(0, 5)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="size-3" aria-hidden="true" />
                    <span>{appointment.customer_name}</span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    with {appointment.employee_name}
                  </p>
                </div>

                <StatusBadge status={appointment.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet and up */}
      <div className="hidden rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((appointment) => (
              <TableRow key={appointment.id}>
                <TableCell>
                  <Link
                    href={ROUTES.appointments.detail(appointment.id)}
                    className="block font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {new Date(appointment.appointment_date).toLocaleDateString()}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}
                  </p>
                </TableCell>
                <TableCell>
                  <Link
                    href={ROUTES.customers.detail(appointment.customer_id)}
                    className="hover:underline"
                  >
                    {appointment.customer_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {appointment.customer_code}
                  </p>
                </TableCell>
                <TableCell>
                  {appointment.service_name}
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(appointment.service_price)}
                  </p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {appointment.employee_name}
                </TableCell>
                <TableCell>
                  <StatusBadge status={appointment.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

/**
 * APPOINTMENT DETAIL PAGE
 *
 * View appointment details and take actions (confirm, complete, cancel, no-show).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, User, Phone, MapPin, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppointmentActions } from '@/features/appointments/components/AppointmentActions';
import { getAppointmentService } from '@/features/appointments/server';
import { ROUTES } from '@/lib/constants/routes';
import type { AppointmentId } from '@/features/appointments/types';
import { formatMoney } from '@/lib/utils/format';

export const metadata = {
  title: 'Appointment details',
};

interface AppointmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AppointmentDetailPage({ params }: AppointmentDetailPageProps) {
  const { id } = await params;
  const { service } = await getAppointmentService();

  const result = await service.getWithDetails(id as AppointmentId);

  if (!result.success) {
    if (result.error.includes('not found')) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const appointment = result.data;
  const appointmentDate = new Date(appointment.appointment_date);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.appointments.list}>
          <ArrowLeft aria-hidden="true" />
          Appointments
        </Link>
      </Button>

      <PageHeader
        title="Appointment details"
        description={`${appointment.service_name} with ${appointment.employee_name}`}
      />

      {/* Status and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Status</CardTitle>
            <Badge
              variant={
                appointment.status === 'confirmed'
                  ? 'default'
                  : appointment.status === 'completed'
                    ? 'outline'
                    : appointment.status === 'cancelled' || appointment.status === 'no_show'
                      ? 'secondary'
                      : 'secondary'
              }
            >
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <AppointmentActions appointment={appointment} />
        </CardContent>
      </Card>

      {/* Appointment Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Date</p>
                <p className="text-sm text-muted-foreground">
                  {appointmentDate.toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Time</p>
                <p className="text-sm text-muted-foreground">
                  {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Customer</p>
                <Link
                  href={ROUTES.customers.detail(appointment.customer_id)}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  {appointment.customer_name}
                </Link>
                <p className="text-xs text-muted-foreground">{appointment.customer_code}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">{appointment.customer_phone}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Service</p>
                <p className="text-sm text-muted-foreground">{appointment.service_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <DollarSign className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Price</p>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(appointment.service_price)}
                </p>
              </div>
            </div>
          </div>

          {appointment.notes && (
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium">Notes</p>
              <p className="mt-1 text-sm text-muted-foreground">{appointment.notes}</p>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Booked {appointment.source === 'public_booking' ? 'online' : 'by staff'} on{' '}
              {new Date(appointment.created_at).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

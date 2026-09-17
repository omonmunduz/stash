/**
 * WEEKLY CALENDAR VIEW
 *
 * Displays appointments in a 7-day week grid (Mon-Sun).
 * Color-coded by employee with navigation controls.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AppointmentWithDetails } from '../types';
import { ROUTES } from '@/lib/constants/routes';

interface WeeklyCalendarProps {
  initialAppointments: AppointmentWithDetails[];
  initialWeekStart: Date;
}

// Deterministic color palette for employees (8 colors)
const EMPLOYEE_COLORS = [
  'bg-blue-100 border-blue-300 text-blue-900',
  'bg-green-100 border-green-300 text-green-900',
  'bg-purple-100 border-purple-300 text-purple-900',
  'bg-orange-100 border-orange-300 text-orange-900',
  'bg-pink-100 border-pink-300 text-pink-900',
  'bg-teal-100 border-teal-300 text-teal-900',
  'bg-indigo-100 border-indigo-300 text-indigo-900',
  'bg-amber-100 border-amber-300 text-amber-900',
];

function hashEmployeeId(employeeId: string): number {
  let hash = 0;
  for (let i = 0; i < employeeId.length; i++) {
    hash = (hash << 5) - hash + employeeId.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % EMPLOYEE_COLORS.length;
}

function getEmployeeColor(employeeId: string): string {
  return EMPLOYEE_COLORS[hashEmployeeId(employeeId)];
}

function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust when day is Sunday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(time: string): string {
  return time.slice(0, 5); // HH:mm:ss -> HH:mm
}

function isSameDay(date1: Date, date2: Date): boolean {
  return formatDate(date1) === formatDate(date2);
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function WeeklyCalendar({ initialAppointments, initialWeekStart }: WeeklyCalendarProps) {
  const [weekStart] = useState(initialWeekStart);

  const weekDates = getWeekDates(weekStart);
  const today = new Date();

  // Group appointments by date
  const appointmentsByDate = new Map<string, AppointmentWithDetails[]>();
  initialAppointments.forEach((apt) => {
    const dateKey = formatDate(apt.appointment_date);
    if (!appointmentsByDate.has(dateKey)) {
      appointmentsByDate.set(dateKey, []);
    }
    appointmentsByDate.get(dateKey)!.push(apt);
  });

  // Sort appointments within each day by start time
  appointmentsByDate.forEach((apts) => {
    apts.sort((a, b) => a.start_time.localeCompare(b.start_time));
  });

  const handlePrevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    window.location.href = `${ROUTES.appointments.list}?week=${formatDate(prev)}`;
  };

  const handleNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    window.location.href = `${ROUTES.appointments.list}?week=${formatDate(next)}`;
  };

  const handleToday = () => {
    window.location.href = ROUTES.appointments.list;
  };

  const weekLabel = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{weekLabel}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleToday}>
          Today
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-7">
        {weekDates.map((date) => {
          const dateKey = formatDate(date);
          const dayAppointments = appointmentsByDate.get(dateKey) || [];
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNumber = date.getDate();
          const isTodayDate = isToday(date);

          return (
            <div key={dateKey} className="flex flex-col">
              {/* Day header */}
              <div
                className={`mb-2 rounded-lg border p-2 text-center ${
                  isTodayDate ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="text-xs font-medium text-muted-foreground">{dayName}</div>
                <div className={`text-lg font-semibold ${isTodayDate ? 'text-primary' : ''}`}>
                  {dayNumber}
                </div>
              </div>

              {/* Appointments for this day */}
              <div className="min-h-[200px] space-y-2 rounded-lg border border-border bg-muted/20 p-2">
                {dayAppointments.length === 0 ? (
                  <div className="flex h-[150px] items-center justify-center">
                    <p className="text-xs text-muted-foreground">No appointments</p>
                  </div>
                ) : (
                  dayAppointments.map((apt) => (
                    <Link
                      key={apt.id}
                      href={ROUTES.appointments.detail(apt.id)}
                      className={`block rounded-lg border-l-4 p-2 text-xs hover:shadow-md ${getEmployeeColor(apt.employee_id)}`}
                    >
                      <div className="font-medium">
                        {formatTime(apt.start_time)} - {formatTime(apt.end_time)}
                      </div>
                      <div className="mt-1 font-semibold">{apt.customer_name}</div>
                      <div className="text-xs opacity-90">{apt.service_name}</div>
                      <div className="mt-1 text-xs opacity-75">{apt.employee_name}</div>
                      {apt.status !== 'confirmed' && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {apt.status}
                        </Badge>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {initialAppointments.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Employees</div>
          <div className="flex flex-wrap gap-2">
            {Array.from(
              new Map(
                initialAppointments.map((apt) => [apt.employee_id, apt.employee_name])
              ).entries()
            ).map(([employeeId, employeeName]) => (
              <div
                key={employeeId}
                className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${getEmployeeColor(employeeId)}`}
              >
                {employeeName}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

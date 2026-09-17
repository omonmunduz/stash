'use client';

import { useState, useTransition } from 'react';
import { WeekSchedule, DAY_NAMES } from '../types';
import { setEmployeeScheduleAction } from '@/app/actions/working-hours';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface WeekScheduleFormProps {
  initialSchedule: WeekSchedule;
  employeeName: string;
  onSuccess?: () => void;
}

export function WeekScheduleForm({
  initialSchedule,
  employeeName,
  onSuccess,
}: WeekScheduleFormProps) {
  const [schedule, setSchedule] = useState<WeekSchedule>(initialSchedule);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleToggleDay = (dayIndex: number) => {
    setSchedule((prev) => ({
      ...prev,
      days: prev.days.map((day, index) =>
        index === dayIndex ? { ...day, is_working: !day.is_working } : day
      ),
    }));
  };

  const handleTimeChange = (
    dayIndex: number,
    field: 'start_time' | 'end_time',
    value: string
  ) => {
    setSchedule((prev) => ({
      ...prev,
      days: prev.days.map((day, index) =>
        index === dayIndex ? { ...day, [field]: value } : day
      ),
    }));
  };

  const handleCopyToAll = (dayIndex: number) => {
    const sourcDay = schedule.days[dayIndex];
    setSchedule((prev) => ({
      ...prev,
      days: prev.days.map((day) =>
        day.is_working
          ? {
              ...day,
              start_time: sourcDay.start_time,
              end_time: sourcDay.end_time,
            }
          : day
      ),
    }));
  };

  const handleSetBusinessDays = () => {
    setSchedule((prev) => ({
      ...prev,
      days: prev.days.map((day, index) => ({
        ...day,
        is_working: index >= 1 && index <= 5, // Monday-Friday
        start_time: '09:00',
        end_time: '17:00',
      })),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await setEmployeeScheduleAction(schedule);

      if (!result.success) {
        setError(result.error || 'Failed to save schedule');
      } else {
        setSuccessMessage('Schedule saved successfully');
        if (onSuccess) {
          onSuccess();
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Weekly Schedule</h3>
          <p className="text-sm text-muted-foreground">
            Set working hours for {employeeName}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSetBusinessDays}
          disabled={isPending}
        >
          Mon-Fri 9-5
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      <div className="space-y-4">
        {schedule.days.map((day, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
          >
            <div className="flex items-center space-x-3 sm:w-32">
              <Checkbox
                id={`day-${index}`}
                checked={day.is_working}
                onCheckedChange={() => handleToggleDay(index)}
                disabled={isPending}
              />
              <Label
                htmlFor={`day-${index}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {DAY_NAMES[index]}
              </Label>
            </div>

            {day.is_working && (
              <>
                <div className="flex items-center gap-2 sm:flex-1">
                  <div className="flex-1">
                    <Label
                      htmlFor={`start-${index}`}
                      className="mb-1 block text-xs text-muted-foreground"
                    >
                      Start
                    </Label>
                    <input
                      id={`start-${index}`}
                      type="time"
                      value={day.start_time}
                      onChange={(e) =>
                        handleTimeChange(index, 'start_time', e.target.value)
                      }
                      disabled={isPending}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <span className="mt-5 text-muted-foreground">to</span>

                  <div className="flex-1">
                    <Label
                      htmlFor={`end-${index}`}
                      className="mb-1 block text-xs text-muted-foreground"
                    >
                      End
                    </Label>
                    <input
                      id={`end-${index}`}
                      type="time"
                      value={day.end_time}
                      onChange={(e) =>
                        handleTimeChange(index, 'end_time', e.target.value)
                      }
                      disabled={isPending}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyToAll(index)}
                  disabled={isPending}
                  className="sm:ml-2"
                >
                  Copy to all
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Schedule'}
        </Button>
      </div>
    </form>
  );
}

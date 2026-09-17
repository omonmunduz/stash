import { Result } from '@/lib/types/common';
import {
  IWorkingHoursRepository,
  SupabaseWorkingHoursRepository,
} from './repository';
import {
  WorkingHours,
  CreateWorkingHoursInput,
  UpdateWorkingHoursInput,
  WeekSchedule,
  DaySchedule,
} from './types';

export class WorkingHoursService {
  constructor(private repository: IWorkingHoursRepository) {}

  async getEmployeeSchedule(employeeId: string): Promise<Result<WeekSchedule>> {
    const result = await this.repository.findByEmployeeId(employeeId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Convert database rows to week schedule format
    const days: DaySchedule[] = [];

    // Initialize all 7 days as non-working
    for (let i = 0; i < 7; i++) {
      const existingHours = result.data.find((wh) => wh.day_of_week === i);

      if (existingHours) {
        days.push({
          day_of_week: i,
          start_time: existingHours.start_time,
          end_time: existingHours.end_time,
          is_working: true,
        });
      } else {
        days.push({
          day_of_week: i,
          start_time: '09:00',
          end_time: '17:00',
          is_working: false,
        });
      }
    }

    return { success: true, data: {
      employee_id: employeeId,
      days,
    } };
  }

  async setEmployeeSchedule(
    schedule: WeekSchedule
  ): Promise<Result<WorkingHours[]>> {
    // Validate times
    for (const day of schedule.days) {
      if (day.is_working) {
        if (day.start_time >= day.end_time) {
          return { success: false, error: 'Start time must be before end time' };
        }

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(day.start_time) || !timeRegex.test(day.end_time)) {
          return { success: false, error: 'Invalid time format. Use HH:MM (e.g., 09:00)' };
        }
      }
    }

    return this.repository.setWeekSchedule(schedule);
  }

  async createWorkingHours(
    input: CreateWorkingHoursInput
  ): Promise<Result<WorkingHours>> {
    // Validate day of week
    if (input.day_of_week < 0 || input.day_of_week > 6) {
      return { success: false, error: 'Invalid day of week. Must be 0-6 (Sunday-Saturday)' };
    }

    // Validate times
    if (input.start_time >= input.end_time) {
      return { success: false, error: 'Start time must be before end time' };
    }

    return this.repository.create(input);
  }

  async updateWorkingHours(
    input: UpdateWorkingHoursInput
  ): Promise<Result<WorkingHours>> {
    // Validate times
    if (input.start_time >= input.end_time) {
      return { success: false, error: 'Start time must be before end time' };
    }

    return this.repository.update(input);
  }

  async deleteWorkingHours(id: string): Promise<Result<void>> {
    return this.repository.delete(id);
  }

  async getOrganizationSchedules(
    organizationId: string
  ): Promise<Result<WorkingHours[]>> {
    return this.repository.findByOrganization(organizationId);
  }
}

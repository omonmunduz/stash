'use server';

import { revalidatePath } from 'next/cache';
import { getWorkingHoursService } from '@/features/working-hours/server';
import { WeekSchedule } from '@/features/working-hours/types';

export async function setEmployeeScheduleAction(schedule: WeekSchedule) {
  try {
    const service = await getWorkingHoursService();
    const result = await service.setEmployeeSchedule(schedule);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath(`/employees/${schedule.employee_id}`);
    revalidatePath('/employees');

    return { success: true, data: result.data };
  } catch (error) {
    console.error('Failed to set employee schedule:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set schedule',
    };
  }
}

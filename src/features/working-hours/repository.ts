import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { Result } from '@/lib/types/common';
import {
  WorkingHours,
  CreateWorkingHoursInput,
  UpdateWorkingHoursInput,
  WeekSchedule,
} from './types';

export interface IWorkingHoursRepository {
  findByEmployeeId(employeeId: string): Promise<Result<WorkingHours[]>>;
  findByOrganization(organizationId: string): Promise<Result<WorkingHours[]>>;
  create(input: CreateWorkingHoursInput): Promise<Result<WorkingHours>>;
  update(input: UpdateWorkingHoursInput): Promise<Result<WorkingHours>>;
  delete(id: string): Promise<Result<void>>;
  setWeekSchedule(schedule: WeekSchedule): Promise<Result<WorkingHours[]>>;
}

export class SupabaseWorkingHoursRepository implements IWorkingHoursRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private organizationId: string
  ) {}

  async findByEmployeeId(employeeId: string): Promise<Result<WorkingHours[]>> {
    const { data, error } = await this.supabase
      .from('working_hours')
      .select('*')
      .eq('organization_id', this.organizationId)
      .eq('employee_id', employeeId)
      .order('day_of_week', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as WorkingHours[] };
  }

  async findByOrganization(
    organizationId: string
  ): Promise<Result<WorkingHours[]>> {
    const { data, error } = await this.supabase
      .from('working_hours')
      .select(
        `
        *,
        employee:employees!inner(id, display_name)
      `
      )
      .eq('organization_id', organizationId)
      .order('employee_id')
      .order('day_of_week', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as WorkingHours[] };
  }

  async create(input: CreateWorkingHoursInput): Promise<Result<WorkingHours>> {
    const { data, error } = await this.supabase
      .from('working_hours')
      .insert({
        organization_id: this.organizationId,
        employee_id: input.employee_id,
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as WorkingHours };
  }

  async update(input: UpdateWorkingHoursInput): Promise<Result<WorkingHours>> {
    const { data, error } = await this.supabase
      .from('working_hours')
      .update({
        start_time: input.start_time,
        end_time: input.end_time,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .eq('organization_id', this.organizationId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as WorkingHours };
  }

  async delete(id: string): Promise<Result<void>> {
    const { error } = await this.supabase
      .from('working_hours')
      .delete()
      .eq('id', id)
      .eq('organization_id', this.organizationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: undefined };
  }

  async setWeekSchedule(
    schedule: WeekSchedule
  ): Promise<Result<WorkingHours[]>> {
    // Delete existing schedule for this employee
    const { error: deleteError } = await this.supabase
      .from('working_hours')
      .delete()
      .eq('organization_id', this.organizationId)
      .eq('employee_id', schedule.employee_id);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Insert new schedule (only days that are marked as working)
    const workingDays = schedule.days.filter((day) => day.is_working);

    if (workingDays.length === 0) {
      // No working days - return empty array
      return { success: true, data: [] };
    }

    const { data, error } = await this.supabase
      .from('working_hours')
      .insert(
        workingDays.map((day) => ({
          organization_id: this.organizationId,
          employee_id: schedule.employee_id,
          day_of_week: day.day_of_week,
          start_time: day.start_time,
          end_time: day.end_time,
        }))
      )
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as WorkingHours[] };
  }
}

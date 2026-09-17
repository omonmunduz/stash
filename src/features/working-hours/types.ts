export interface WorkingHours {
  id: string;
  organization_id: string;
  employee_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  created_at: string;
  updated_at: string;
}

export interface WorkingHoursWithEmployee extends WorkingHours {
  employee: {
    id: string;
    display_name: string;
  };
}

export interface DaySchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
}

export interface WeekSchedule {
  employee_id: string;
  days: DaySchedule[];
}

export interface CreateWorkingHoursInput {
  employee_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface UpdateWorkingHoursInput {
  id: string;
  start_time: string;
  end_time: string;
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const BUSINESS_DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

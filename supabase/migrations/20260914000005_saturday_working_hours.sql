-- ============================================================================
-- ADD SATURDAY WORKING HOURS FOR EXISTING EMPLOYEES
-- ============================================================================
-- The user was able to book an appointment for Saturday Sep 19, but then
-- the system shows "No availability on this date" for subsequent bookings.
-- This is because default working hours only cover Monday-Friday (1-5).
-- This migration adds Saturday (day_of_week = 6) working hours.
-- ============================================================================

INSERT INTO working_hours (organization_id, employee_id, day_of_week, start_time, end_time)
SELECT
  e.organization_id,
  e.id,
  6,  -- Saturday
  '09:00:00'::TIME,
  '17:00:00'::TIME
FROM employees e
WHERE e.deleted_at IS NULL
  AND e.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM working_hours wh
    WHERE wh.employee_id = e.id
      AND wh.day_of_week = 6
  );

COMMENT ON TABLE working_hours IS
  'Employee working schedules. New employees get default Mon-Fri 9am-5pm hours. Saturday hours added for existing employees.';

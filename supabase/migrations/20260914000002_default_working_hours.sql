-- ============================================================================
-- ADD DEFAULT WORKING HOURS FOR EXISTING EMPLOYEES
-- ============================================================================
-- Employees need working hours for the booking system to show available slots.
-- This migration adds default Monday-Friday 9am-5pm hours for any employee
-- who doesn't have working hours configured yet.
-- ============================================================================

INSERT INTO working_hours (organization_id, employee_id, day_of_week, start_time, end_time)
SELECT
  e.organization_id,
  e.id,
  day_num,
  '09:00:00'::TIME,
  '17:00:00'::TIME
FROM employees e
CROSS JOIN generate_series(1, 5) AS day_num  -- Monday (1) to Friday (5)
WHERE e.deleted_at IS NULL
  AND e.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM working_hours wh
    WHERE wh.employee_id = e.id
      AND wh.day_of_week = day_num
  );

COMMENT ON TABLE working_hours IS
  'Employee working schedules. New employees get default Mon-Fri 9am-5pm hours.';

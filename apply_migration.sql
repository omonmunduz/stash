-- ADD SATURDAY WORKING HOURS FOR EXISTING EMPLOYEES
INSERT INTO working_hours (organization_id, employee_id, day_of_week, start_time, end_time)
SELECT
  e.organization_id,
  e.id,
  6,
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

-- ============================================================================
-- FIX get_available_slots: generate_series with TIME (v2)
-- ============================================================================
-- Fix the casting issue: DATE + TIME requires proper casting to TIMESTAMP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_organization_id UUID,
  p_service_id UUID,
  p_date DATE,
  p_employee_id UUID DEFAULT NULL -- NULL = any employee who offers this service
)
RETURNS TABLE(
  employee_id UUID,
  employee_name TEXT,
  available_times TIME[]
) AS $$
DECLARE
  v_service RECORD;
  v_day_of_week INTEGER;
BEGIN
  -- Load service
  SELECT id, duration_minutes INTO v_service
  FROM services
  WHERE id = p_service_id
    AND organization_id = p_organization_id
    AND is_active = TRUE
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found or inactive.';
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- For each employee who offers this service, calculate their available slots
  RETURN QUERY
  WITH service_employees AS (
    SELECT e.id, e.display_name
    FROM employees e
    INNER JOIN service_providers sp ON sp.employee_id = e.id
    WHERE e.organization_id = p_organization_id
      AND e.is_active = TRUE
      AND e.deleted_at IS NULL
      AND sp.service_id = p_service_id
      AND (p_employee_id IS NULL OR e.id = p_employee_id)
  ),
  employee_hours AS (
    SELECT
      se.id AS emp_id,
      se.display_name AS emp_name,
      COALESCE(ae.start_time, wh.start_time) AS day_start,
      COALESCE(ae.end_time, wh.end_time) AS day_end,
      COALESCE(ae.is_available, TRUE) AS is_working
    FROM service_employees se
    LEFT JOIN working_hours wh ON wh.employee_id = se.id AND wh.day_of_week = v_day_of_week
    LEFT JOIN availability_exceptions ae ON ae.employee_id = se.id AND ae.exception_date = p_date
    WHERE (ae.is_available = TRUE OR (ae.is_available IS NULL AND wh.start_time IS NOT NULL))
      OR (ae.is_available = FALSE AND FALSE) -- exclude days off
  ),
  all_slots AS (
    SELECT
      eh.emp_id,
      eh.emp_name,
      gs.slot_time::TIME AS slot_start
    FROM employee_hours eh
    CROSS JOIN LATERAL generate_series(
      (p_date + eh.day_start)::TIMESTAMP,
      (p_date + eh.day_end - (v_service.duration_minutes || ' minutes')::INTERVAL)::TIMESTAMP,
      (v_service.duration_minutes || ' minutes')::INTERVAL
    ) AS gs(slot_time)
    WHERE eh.is_working = TRUE
  ),
  available_slots AS (
    SELECT
      s.emp_id,
      s.emp_name,
      s.slot_start
    FROM all_slots s
    WHERE NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.employee_id = s.emp_id
        AND a.appointment_date = p_date
        AND a.deleted_at IS NULL
        AND a.status NOT IN ('cancelled', 'no_show')
        AND tsrange(
          (a.appointment_date::timestamp + a.start_time),
          (a.appointment_date::timestamp + a.end_time),
          '[)'
        ) && tsrange(
          (p_date::timestamp + s.slot_start),
          (p_date::timestamp + s.slot_start + (v_service.duration_minutes || ' minutes')::INTERVAL),
          '[)'
        )
    )
  )
  SELECT
    avail.emp_id,
    avail.emp_name,
    array_agg(avail.slot_start ORDER BY avail.slot_start) AS available_times
  FROM available_slots avail
  GROUP BY avail.emp_id, avail.emp_name
  ORDER BY avail.emp_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.get_available_slots IS
  'Returns available time slots for a service on a date. One row per employee
   with an array of available start times. Used by the booking UI.';

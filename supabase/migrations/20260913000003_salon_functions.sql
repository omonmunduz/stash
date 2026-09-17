-- ============================================================================
-- BUSINESS LOGIC: SALON & BARBERSHOP EXTENSION
-- ============================================================================
-- RPCs and helper functions for:
-- - Public booking (guest checkout with name + phone)
-- - Available slot calculation
-- - Appointment creation with conflict detection
-- - Employee slug generation
-- ============================================================================

-- ============================================================================
-- HELPER: Generate unique employee slug
-- ============================================================================
-- Generates a URL-safe slug from display_name, with a counter suffix if needed.
CREATE OR REPLACE FUNCTION public.generate_employee_slug(
  p_organization_id UUID,
  p_display_name TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_base_slug TEXT;
  v_slug TEXT;
  v_counter INTEGER := 1;
BEGIN
  -- Normalize: lowercase, replace spaces with hyphens, strip non-alphanumeric
  v_base_slug := lower(regexp_replace(trim(p_display_name), '[^a-zA-Z0-9\s-]', '', 'g'));
  v_base_slug := regexp_replace(v_base_slug, '\s+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);

  -- Fallback if the name is all non-alphanumeric
  IF v_base_slug = '' THEN
    v_base_slug := 'employee';
  END IF;

  v_slug := v_base_slug;

  -- Find first available slug
  WHILE EXISTS (
    SELECT 1 FROM employees
    WHERE organization_id = p_organization_id
      AND slug = v_slug
      AND deleted_at IS NULL
  ) LOOP
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  END LOOP;

  RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_employee_slug IS
  'Generate URL-safe slug from employee name. Adds -2, -3, etc. for duplicates.';

-- ============================================================================
-- RPC: Find or create customer by phone
-- ============================================================================
-- Public bookings need a customer record. If one exists with this phone,
-- return it; otherwise create a minimal record with just name and phone.
CREATE OR REPLACE FUNCTION public.find_or_create_customer_by_phone(
  p_organization_id UUID,
  p_name TEXT,
  p_phone TEXT
)
RETURNS UUID AS $$
DECLARE
  v_customer_id UUID;
  v_customer_code TEXT;
BEGIN
  -- Normalize phone: strip spaces and common separators
  p_phone := regexp_replace(p_phone, '[^\d+]', '', 'g');

  IF p_phone = '' THEN
    RAISE EXCEPTION 'Phone number is required.';
  END IF;

  -- Look for existing customer with this phone
  SELECT id INTO v_customer_id
  FROM customers
  WHERE organization_id = p_organization_id
    AND phone = p_phone
    AND deleted_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    RETURN v_customer_id;
  END IF;

  -- Create new customer
  v_customer_code := public.generate_customer_code(p_organization_id);

  INSERT INTO customers (
    organization_id, customer_code, name, phone, is_active
  ) VALUES (
    p_organization_id, v_customer_code, p_name, p_phone, TRUE
  )
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.find_or_create_customer_by_phone IS
  'Find customer by phone or create minimal record for public bookings.';

-- ============================================================================
-- RPC: Book appointment (public or staff-created)
-- ============================================================================
-- Public booking flow: find/create customer, resolve employee, check for
-- conflicts, insert appointment.
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_organization_id UUID,
  p_service_id UUID,
  p_employee_id UUID, -- NULL for "any available"
  p_appointment_date DATE,
  p_start_time TIME,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_notes TEXT DEFAULT NULL,
  p_source appointment_source DEFAULT 'public_booking'
)
RETURNS UUID AS $$
DECLARE
  v_customer_id UUID;
  v_employee_id UUID;
  v_service RECORD;
  v_end_time TIME;
  v_appointment_id UUID;
  v_conflict_count INTEGER;
BEGIN
  -- Load service to get duration
  SELECT id, duration_minutes, is_active INTO v_service
  FROM services
  WHERE id = p_service_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found.';
  END IF;

  IF v_service.is_active = FALSE THEN
    RAISE EXCEPTION 'This service is no longer available.';
  END IF;

  -- Calculate end time
  v_end_time := p_start_time + (v_service.duration_minutes || ' minutes')::INTERVAL;

  -- Find or create customer
  v_customer_id := public.find_or_create_customer_by_phone(
    p_organization_id, p_customer_name, p_customer_phone
  );

  -- Resolve employee
  IF p_employee_id IS NOT NULL THEN
    -- Specific employee requested
    SELECT id INTO v_employee_id
    FROM employees
    WHERE id = p_employee_id
      AND organization_id = p_organization_id
      AND is_active = TRUE
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Employee not found or inactive.';
    END IF;

    -- Check if this employee can perform this service
    IF NOT EXISTS (
      SELECT 1 FROM service_providers
      WHERE service_id = p_service_id
        AND employee_id = p_employee_id
    ) THEN
      RAISE EXCEPTION 'This employee does not offer this service.';
    END IF;
  ELSE
    -- "Any available": find first employee who can do this service and is free
    SELECT e.id INTO v_employee_id
    FROM employees e
    INNER JOIN service_providers sp ON sp.employee_id = e.id
    WHERE e.organization_id = p_organization_id
      AND e.is_active = TRUE
      AND e.deleted_at IS NULL
      AND sp.service_id = p_service_id
      AND NOT EXISTS (
        -- No conflicting appointments
        SELECT 1 FROM appointments a
        WHERE a.employee_id = e.id
          AND a.appointment_date = p_appointment_date
          AND a.deleted_at IS NULL
          AND a.status NOT IN ('cancelled', 'no_show')
          AND tsrange(
            (a.appointment_date::timestamp + a.start_time),
            (a.appointment_date::timestamp + a.end_time),
            '[)'
          ) && tsrange(
            (p_appointment_date::timestamp + p_start_time),
            (p_appointment_date::timestamp + v_end_time),
            '[)'
          )
      )
    ORDER BY e.display_name
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No employees available for this time slot.';
    END IF;
  END IF;

  -- Final conflict check (belt-and-suspenders: the exclusion constraint is
  -- the real guard, but this gives a friendlier error message)
  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments
  WHERE employee_id = v_employee_id
    AND appointment_date = p_appointment_date
    AND deleted_at IS NULL
    AND status NOT IN ('cancelled', 'no_show')
    AND tsrange(
      (appointment_date::timestamp + start_time),
      (appointment_date::timestamp + end_time),
      '[)'
    ) && tsrange(
      (p_appointment_date::timestamp + p_start_time),
      (p_appointment_date::timestamp + v_end_time),
      '[)'
    );

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'This time slot is no longer available.';
  END IF;

  -- Insert appointment
  INSERT INTO appointments (
    organization_id, customer_id, service_id, employee_id,
    appointment_date, start_time, end_time, status, source,
    customer_name, customer_phone, notes,
    created_by
  ) VALUES (
    p_organization_id, v_customer_id, p_service_id, v_employee_id,
    p_appointment_date, p_start_time, v_end_time, 'pending', p_source,
    p_customer_name, p_customer_phone, p_notes,
    CASE WHEN p_source = 'staff_created' THEN auth.uid() ELSE NULL END
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.book_appointment IS
  'Book appointment with conflict detection. p_employee_id NULL = any available.
   Returns appointment id. Used by both public booking and staff-created bookings.';

-- ============================================================================
-- RPC: Get available time slots for a service
-- ============================================================================
-- Returns array of available start times on a given date for a service,
-- optionally filtered to one employee. Used by the booking UI.
--
-- Slot calculation:
-- 1. Load employee working hours for that day of week
-- 2. Load availability exceptions for that date (override working hours)
-- 3. Generate all possible slots at service.duration_minutes intervals
-- 4. Filter out slots that conflict with existing appointments
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
      generate_series(
        eh.day_start,
        eh.day_end - (v_service.duration_minutes || ' minutes')::INTERVAL,
        (v_service.duration_minutes || ' minutes')::INTERVAL
      )::TIME AS slot_start
    FROM employee_hours eh
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

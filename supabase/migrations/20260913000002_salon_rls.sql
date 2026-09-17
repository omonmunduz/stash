-- ============================================================================
-- ROW LEVEL SECURITY: SALON & BARBERSHOP EXTENSION
-- ============================================================================
-- RLS policies for employees, services, appointments, and related tables.
--
-- Employee visibility model:
-- - Admins/managers: see everything in the org
-- - Employees (with user_profile_id): see only their own appointments and sales
-- - Everyone: can see the employee roster (needed for booking UI)
-- ============================================================================

-- ============================================================================
-- EMPLOYEES
-- ============================================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Everyone in the org can see who works there (needed for booking UI and
-- staff attribution on sales).
CREATE POLICY "employees_select_same_org"
ON employees FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Only admins can manage the employee roster.
CREATE POLICY "employees_insert_admin_or_above"
ON employees FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('admin')
);

CREATE POLICY "employees_update_admin_or_above"
ON employees FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('admin'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('admin'));

-- ============================================================================
-- SERVICES
-- ============================================================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Everyone can see the service menu.
CREATE POLICY "services_select_same_org"
ON services FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Managers and above can manage services (same access level as products).
CREATE POLICY "services_insert_manager_or_above"
ON services FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "services_update_manager_or_above"
ON services FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- SERVICE PROVIDERS
-- ============================================================================
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;

-- Everyone can see which employees perform which services.
CREATE POLICY "service_providers_select_same_org"
ON service_providers FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Managers and above can assign services to employees.
CREATE POLICY "service_providers_insert_manager_or_above"
ON service_providers FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "service_providers_delete_manager_or_above"
ON service_providers FOR DELETE TO authenticated
USING (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- WORKING HOURS
-- ============================================================================
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;

-- Everyone can see working hours (needed for public booking slot calculation).
CREATE POLICY "working_hours_select_same_org"
ON working_hours FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Managers and above can set working hours.
CREATE POLICY "working_hours_insert_manager_or_above"
ON working_hours FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "working_hours_update_manager_or_above"
ON working_hours FOR UPDATE TO authenticated
USING      (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'))
WITH CHECK (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

CREATE POLICY "working_hours_delete_manager_or_above"
ON working_hours FOR DELETE TO authenticated
USING (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- AVAILABILITY EXCEPTIONS
-- ============================================================================
ALTER TABLE availability_exceptions ENABLE ROW LEVEL SECURITY;

-- Everyone can see availability exceptions (needed for booking slot calculation).
CREATE POLICY "availability_exceptions_select_same_org"
ON availability_exceptions FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id());

-- Managers and above can create exceptions.
CREATE POLICY "availability_exceptions_insert_manager_or_above"
ON availability_exceptions FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_organization_id()
  AND public.has_role_or_above('manager')
);

CREATE POLICY "availability_exceptions_delete_manager_or_above"
ON availability_exceptions FOR DELETE TO authenticated
USING (organization_id = public.current_organization_id() AND public.has_role_or_above('manager'));

-- ============================================================================
-- APPOINTMENTS
-- ============================================================================
-- Access model:
-- - Admins/managers: see all appointments
-- - Employees: see only their own appointments
-- - Any role can create (for staff-created bookings)
-- - Managers+ or the assigned employee can update status
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select_scoped_by_role"
ON appointments FOR SELECT TO authenticated
USING (
  organization_id = public.current_organization_id()
  AND (
    public.has_role_or_above('manager')
    OR employee_id IN (
      SELECT id FROM employees
      WHERE user_profile_id = auth.uid()
        AND deleted_at IS NULL
    )
  )
);

-- Any role can create appointments (for walk-ins recorded by counter staff).
-- Public bookings go through an RPC, not this policy.
CREATE POLICY "appointments_insert_any_role"
ON appointments FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_organization_id());

-- Managers or the assigned employee can update (for status changes like
-- completed, no-show).
CREATE POLICY "appointments_update_scoped_by_role"
ON appointments FOR UPDATE TO authenticated
USING (
  organization_id = public.current_organization_id()
  AND (
    public.has_role_or_above('manager')
    OR employee_id IN (
      SELECT id FROM employees
      WHERE user_profile_id = auth.uid()
        AND deleted_at IS NULL
    )
  )
)
WITH CHECK (
  organization_id = public.current_organization_id()
  AND (
    public.has_role_or_above('manager')
    OR employee_id IN (
      SELECT id FROM employees
      WHERE user_profile_id = auth.uid()
        AND deleted_at IS NULL
    )
  )
);

COMMENT ON POLICY "appointments_select_scoped_by_role" ON appointments IS
  'Admins/managers see all appointments; employees see only their own.';

-- ============================================================================
-- SALON & BARBERSHOP EXTENSION
-- ============================================================================
-- Adds: employees (staff who perform services), services menu, appointments,
-- working hours, availability exceptions, and public booking capability.
--
-- Extends: sales/sale_items to handle services alongside products, preserving
-- the existing running-balance system for customer credit/tabs.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE appointment_source AS ENUM ('public_booking', 'staff_created');

-- ============================================================================
-- EMPLOYEES
-- ============================================================================
-- Staff who perform services. Separate from user_profiles.role='employee'
-- because a stylist may take appointments without needing app login, and a
-- counter employee may record sales without performing services.
CREATE TABLE employees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    display_name    TEXT NOT NULL,
    slug            TEXT NOT NULL,
    bio             TEXT,
    photo_url       TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE(organization_id, slug)
);

CREATE INDEX idx_employees_org     ON employees(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_user    ON employees(user_profile_id) WHERE user_profile_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_employees_slug    ON employees(organization_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_active  ON employees(organization_id, is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE employees IS
  'Staff who perform services. user_profile_id is nullable: a stylist can take
   bookings without app login. Slug is for /book/[org-slug]/[employee-slug].';

-- ============================================================================
-- SERVICES
-- ============================================================================
CREATE TABLE services (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    description      TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price            DECIMAL(15, 2) NOT NULL CHECK (price >= 0),
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_services_org    ON services(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_active ON services(organization_id, is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE services IS 'What the business offers: haircuts, manicures, etc.';
COMMENT ON COLUMN services.duration_minutes IS 'Slot length for booking calculations.';

-- ============================================================================
-- SERVICE PROVIDERS
-- ============================================================================
-- Which employees can perform which services. Many-to-many: a haircut can be
-- performed by several stylists, and one stylist offers several services.
CREATE TABLE service_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, employee_id)
);

CREATE INDEX idx_service_providers_service  ON service_providers(service_id);
CREATE INDEX idx_service_providers_employee ON service_providers(employee_id);

COMMENT ON TABLE service_providers IS
  'Many-to-many: which employees can perform which services.';

-- ============================================================================
-- WORKING HOURS
-- ============================================================================
-- Regular weekly schedule per employee. One row per day-of-week they work.
CREATE TABLE working_hours (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, day_of_week),
    CHECK (end_time > start_time)
);

CREATE INDEX idx_working_hours_employee ON working_hours(employee_id);

COMMENT ON TABLE working_hours IS
  'Regular weekly availability. day_of_week: 0=Sunday, 6=Saturday.';

-- ============================================================================
-- AVAILABILITY EXCEPTIONS
-- ============================================================================
-- Days off, holidays, or custom hours that override working_hours.
CREATE TABLE availability_exceptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    exception_date  DATE NOT NULL,
    is_available    BOOLEAN NOT NULL,
    start_time      TIME,
    end_time        TIME,
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        (is_available = FALSE AND start_time IS NULL AND end_time IS NULL)
        OR (is_available = TRUE AND start_time IS NOT NULL AND end_time IS NOT NULL)
    ),
    CHECK (end_time IS NULL OR end_time > start_time)
);

CREATE INDEX idx_availability_exceptions_employee ON availability_exceptions(employee_id);
CREATE INDEX idx_availability_exceptions_date     ON availability_exceptions(employee_id, exception_date);

COMMENT ON TABLE availability_exceptions IS
  'Override working_hours for a specific date. is_available=false means day off;
   is_available=true with times means custom hours for that day.';

-- ============================================================================
-- APPOINTMENTS
-- ============================================================================
-- Scheduled bookings. employee_id is always resolved at booking time, even
-- for "any available" public bookings.
CREATE TABLE appointments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    service_id       UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    start_time       TIME NOT NULL,
    end_time         TIME NOT NULL,
    status           appointment_status DEFAULT 'pending',
    source           appointment_source NOT NULL,
    customer_name    TEXT NOT NULL,
    customer_phone   TEXT NOT NULL,
    notes            TEXT,
    created_by       UUID REFERENCES user_profiles(id),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ,
    CHECK (end_time > start_time)
);

CREATE INDEX idx_appointments_org      ON appointments(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_customer ON appointments(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_employee ON appointments(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_date     ON appointments(organization_id, appointment_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_status   ON appointments(organization_id, status) WHERE deleted_at IS NULL;

COMMENT ON TABLE appointments IS
  'Scheduled bookings. customer_name/phone are snapshots so a public booking
   shows what was entered even if the customer record is later edited.';
COMMENT ON COLUMN appointments.employee_id IS
  'Always resolved at booking time. "Any available" is resolved to a specific
   employee by the booking RPC before insert.';
COMMENT ON COLUMN appointments.created_by IS
  'NULL for public bookings, user id for staff-created appointments.';

-- ============================================================================
-- APPOINTMENTS: EXCLUSION CONSTRAINT (PREVENT DOUBLE-BOOKING)
-- ============================================================================
-- An employee cannot have overlapping appointments. Uses btree_gist to compare
-- time ranges. Excludes cancelled/no-show appointments and soft-deleted rows.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
EXCLUDE USING GIST (
  organization_id WITH =,
  employee_id WITH =,
  tsrange(
    (appointment_date::timestamp + start_time),
    (appointment_date::timestamp + end_time),
    '[)'
  ) WITH &&
)
WHERE (deleted_at IS NULL AND status NOT IN ('cancelled', 'no_show'));

COMMENT ON CONSTRAINT appointments_no_overlap ON appointments IS
  'Prevent double-booking the same employee for overlapping times. Cancelled
   and no-show appointments do not block the slot.';

-- ============================================================================
-- EXTEND: organizations.slug
-- ============================================================================
-- The base schema already defines slug as TEXT UNIQUE NOT NULL, but ensure it
-- exists and has the index for public booking lookups.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'slug'
  ) THEN
    ALTER TABLE organizations ADD COLUMN slug TEXT UNIQUE NOT NULL;
  END IF;
END $$;

-- Ensure the index exists (the base schema creates it, but re-running is safe).
CREATE INDEX IF NOT EXISTS idx_organizations_slug
  ON organizations(slug) WHERE deleted_at IS NULL;

COMMENT ON COLUMN organizations.slug IS
  'URL-safe identifier for public booking: /book/[slug]. Immutable after creation.';

-- ============================================================================
-- EXTEND: sales.employee_id
-- ============================================================================
-- Attribute a sale to the employee who performed it, for commission and reports.
ALTER TABLE sales ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX idx_sales_employee ON sales(organization_id, employee_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN sales.employee_id IS
  'Employee who performed this sale or service. NULL for product-only sales
   recorded before this feature existed, or when no specific employee is tracked.';

-- ============================================================================
-- EXTEND: sale_items (MAKE POLYMORPHIC: PRODUCT OR SERVICE)
-- ============================================================================
-- A line item counts either a product or a service, never both. Existing rows
-- have product_id set; new service lines will have service_id set instead.

ALTER TABLE sale_items
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
  ADD COLUMN service_name TEXT,
  ADD COLUMN duration_minutes INTEGER,
  ADD CONSTRAINT sale_items_product_or_service CHECK (
    (product_id IS NOT NULL AND service_id IS NULL)
    OR (product_id IS NULL AND service_id IS NOT NULL)
  );

CREATE INDEX idx_sale_items_service ON sale_items(organization_id, service_id);

COMMENT ON CONSTRAINT sale_items_product_or_service ON sale_items IS
  'Exactly one of product_id or service_id must be set. A line item is either
   a product or a service, never both.';
COMMENT ON COLUMN sale_items.service_name IS
  'Snapshot of service name at sale time, same as product_name for products.';
COMMENT ON COLUMN sale_items.duration_minutes IS
  'Snapshot of service duration. NULL for product lines.';

-- ============================================================================
-- updated_at TRIGGERS FOR NEW TABLES
-- ============================================================================
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_working_hours_updated_at BEFORE UPDATE ON working_hours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

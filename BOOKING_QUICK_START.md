# Quick Start: Using the Salon/Barbershop Features

## Setup Checklist

### 1. Ensure your organization has a slug
```typescript
// Check in your database or set one:
UPDATE organizations 
SET slug = 'your-business-name' 
WHERE id = 'your-org-id';
```

### 2. Create your first employee
```typescript
import { SupabaseEmployeeRepository } from '@/features/employees/repository';

const repo = new SupabaseEmployeeRepository(supabase);
const employee = await repo.create(organizationId, {
  display_name: 'Jane Smith',
  // slug auto-generates as 'jane-smith'
  bio: 'Senior stylist with 10 years experience',
});
```

### 3. Create services
```typescript
import { SupabaseServiceRepository } from '@/features/services/repository';

const serviceRepo = new SupabaseServiceRepository(supabase);
const haircut = await serviceRepo.create(organizationId, {
  name: 'Haircut',
  description: 'Classic cut and style',
  duration_minutes: 30,
  price: 25.00,
  provider_employee_ids: [employee.id], // This employee can perform this service
});
```

### 4. Set working hours
```typescript
// Direct SQL for now (UI to come later)
INSERT INTO working_hours (organization_id, employee_id, day_of_week, start_time, end_time)
VALUES 
  ('org-id', 'employee-id', 1, '09:00', '17:00'),  -- Monday
  ('org-id', 'employee-id', 2, '09:00', '17:00'),  -- Tuesday
  ('org-id', 'employee-id', 3, '09:00', '17:00'),  -- Wednesday
  ('org-id', 'employee-id', 4, '09:00', '17:00'),  -- Thursday
  ('org-id', 'employee-id', 5, '09:00', '17:00'); -- Friday
```

### 5. Test the public booking page
Visit: `http://localhost:3000/book/your-business-name`

Or for a specific employee: `http://localhost:3000/book/your-business-name?employee=jane-smith`

---

## Repository Usage Examples

### Employees

```typescript
import { SupabaseEmployeeRepository } from '@/features/employees/repository';

const repo = new SupabaseEmployeeRepository(supabase);

// List all active employees
const employees = await repo.findAll({
  organization_id: orgId,
  is_active: true,
});

// Get employee by slug (for booking URL)
const employee = await repo.findBySlug('jane-smith', orgId);

// Update employee
await repo.update(employeeId, {
  bio: 'Updated bio text',
  is_active: false,
});

// Get lightweight lookups for dropdowns
const lookups = await repo.findLookups(orgId);
```

### Services

```typescript
import { SupabaseServiceRepository } from '@/features/services/repository';

const serviceRepo = new SupabaseServiceRepository(supabase);

// List services
const services = await serviceRepo.findAll({
  organization_id: orgId,
  is_active: true,
});

// Get service with its providers (employees who can perform it)
const withProviders = await serviceRepo.findWithProviders(serviceId);
// Returns: { ...service, providers: [{ employee_id, employee_name }] }

// Get services an employee can perform
const employeeServices = await serviceRepo.findByEmployee(employeeId, orgId);

// Update service providers
await serviceRepo.setProviders(serviceId, [employee1Id, employee2Id]);
```

### Appointments

```typescript
import { SupabaseAppointmentRepository } from '@/features/appointments/repository';

const apptRepo = new SupabaseAppointmentRepository(supabase);

// Staff-created appointment
const appointment = await apptRepo.create(orgId, {
  customer_id: customerId,
  service_id: serviceId,
  employee_id: employeeId,
  appointment_date: new Date('2024-09-15'),
  start_time: '10:00',
  notes: 'Customer prefers scissors over clippers',
  source: 'staff_created',
});

// Get available slots
const slots = await apptRepo.getAvailableSlots(
  orgId,
  serviceId,
  new Date('2024-09-15'),
  employeeId // optional: omit for "any available"
);
// Returns: [{ employee_id, employee_name, available_times: ['09:00', '09:30', ...] }]

// List appointments with details
const appointments = await apptRepo.findAllWithDetails({
  organization_id: orgId,
  employee_id: employeeId, // optional filter
  status: 'pending', // optional filter
  date_from: new Date('2024-09-01'),
  date_to: new Date('2024-09-30'),
});

// Update appointment status
await apptRepo.update(appointmentId, {
  status: 'completed',
});
```

---

## Public Booking API

### Get Available Slots
```typescript
POST /api/booking/available-slots
{
  "organizationSlug": "your-business",
  "serviceId": "service-uuid",
  "date": "2024-09-15",
  "employeeId": "employee-uuid" // optional
}

Response:
{
  "slots": [
    {
      "employee_id": "uuid",
      "employee_name": "Jane Smith",
      "available_times": ["09:00:00", "09:30:00", "10:00:00"]
    }
  ]
}
```

### Book Appointment
```typescript
POST /api/booking/book
{
  "organizationSlug": "your-business",
  "serviceId": "service-uuid",
  "employeeId": "employee-uuid", // optional: omit for "any available"
  "date": "2024-09-15",
  "time": "10:00",
  "customerName": "John Doe",
  "customerPhone": "555-123-4567",
  "notes": "First time customer"
}

Response:
{
  "success": true,
  "appointmentId": "uuid"
}
```

---

## RLS Behavior

### Employees
- **Everyone** can view employees in their org (needed for booking UI)
- **Admins+** can create/edit/delete employees

### Services
- **Everyone** can view services
- **Managers+** can create/edit/delete services and assign providers

### Appointments
- **Admins/Managers** see all appointments
- **Employees** (linked via `user_profile_id`) see only their own appointments
- **Anyone** can create staff appointments
- **Managers+ OR assigned employee** can update appointments

---

## Converting Appointments to Sales

When a service is completed, you can create a sale with a service line item:

```typescript
import { SupabaseSaleRepository } from '@/features/sales/repository';

const saleRepo = new SupabaseSaleRepository(supabase);

// Note: You'll need to extend the sale creation RPC to support service items
// For now, this is the pattern (RPC extension needed):
const sale = await saleRepo.createWithItems(orgId, {
  customer_id: appointment.customer_id,
  items: [
    {
      service_id: appointment.service_id, // NEW: instead of product_id
      quantity: 1,
      unit_price: servicePrice,
      discount: 0,
    }
  ],
  sale_date: new Date(),
  employee_id: appointment.employee_id, // NEW: attribute to employee
});
```

**Note**: The `create_sale_with_items` RPC currently only handles products. You'll need to extend it to handle service items, or create a separate `create_service_sale` RPC.

---

## Testing Checklist

- [ ] Create organization slug
- [ ] Create at least one employee
- [ ] Create at least one service
- [ ] Link employee to service (service_providers)
- [ ] Set working hours for employee
- [ ] Visit `/book/[your-slug]`
- [ ] Select service → date → time
- [ ] Complete booking with name + phone
- [ ] Verify appointment appears in `appointments` table
- [ ] Verify customer was created in `customers` table

---

## Common Issues

### "No availability on this date"
- Check that the employee has `working_hours` set for that day of week
- Check that there are no `availability_exceptions` blocking that date
- Verify the employee is linked to the service via `service_providers`

### "This time slot is no longer available"
- Another booking was created between checking slots and confirming
- This is expected behavior (race condition protection)
- User should select a different time

### Employee can't see their appointments
- Verify the employee has `user_profile_id` set (links them to app login)
- Check that the logged-in user's profile is linked to the employee record

### Public booking returns 404
- Verify the organization slug exists and matches the URL
- Check that `organizations.deleted_at IS NULL`

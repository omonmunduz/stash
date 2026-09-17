# Appointment Form Fix - Service-Employee Validation

## Problem

When creating an appointment, the error occurred:
```
Failed to create appointment: This employee does not offer this service.
```

## Root Cause

The `book_appointment` RPC validates that the selected employee must be linked to the selected service via the `service_providers` table (many-to-many relationship). The form was showing **all employees** regardless of whether they could perform the selected service.

### Database Validation (from `20260913000003_salon_functions.sql:170-176`)
```sql
-- Check if this employee can perform this service
IF NOT EXISTS (
  SELECT 1 FROM service_providers
  WHERE service_id = p_service_id
    AND employee_id = p_employee_id
) THEN
  RAISE EXCEPTION 'This employee does not offer this service.';
END IF;
```

## Solution

Implemented **dynamic employee filtering** based on the selected service.

### Changes Made

**1. Updated AppointmentForm Component** (`src/features/appointments/components/AppointmentForm.tsx`)

**Added:**
- `provider_employee_ids` array to service props
- `useMemo` hook to filter employees based on selected service
- Employee dropdown now:
  - Disabled until service is selected
  - Only shows employees who can perform the selected service
  - Shows helpful message when no employees are available
  - Resets employee selection when service changes

**Key Logic:**
```typescript
const availableEmployees = useMemo(() => {
  if (!values.service_id) {
    return employees;
  }

  const service = services.find((s) => s.id === values.service_id);
  if (!service) {
    return [];
  }

  // Only show employees who can perform this service
  return employees.filter((emp) => 
    service.provider_employee_ids.includes(emp.id)
  );
}, [values.service_id, services, employees]);
```

**2. Added Service Method** (`src/features/services/service.ts`)

**New method:** `listWithProviders()`
- Fetches all services with their provider relationships
- Returns `ServiceWithProviders[]` instead of `Service[]`
- Each service includes `providers` array with employee IDs and names

**3. Updated New Appointment Page** (`src/app/(dashboard)/appointments/new/page.tsx`)

**Changed:**
- Now calls `service.listWithProviders()` instead of `service.list()`
- Maps provider data to `provider_employee_ids` array
- Passes filtered employee IDs to form component

## User Experience Improvements

**Before Fix:**
1. User selects any service
2. User selects any employee
3. Submit → Error: "This employee does not offer this service"
4. User confused - which employees work?

**After Fix:**
1. User selects service
2. Employee dropdown shows ONLY employees who can perform that service
3. If no employees available → Clear error message with instructions
4. Submit → Success (validation already passed client-side)

## UI States

**No service selected:**
- Employee dropdown disabled
- Placeholder: "Select a service first"

**Service selected, employees available:**
- Employee dropdown enabled
- Shows only matching employees

**Service selected, no employees available:**
- Employee dropdown disabled
- Placeholder: "No employees available for this service"
- Error message: "No employees are assigned to perform this service. Please assign employees to the service first."

## Data Flow

```
Page Load
↓
Fetch services WITH provider relationships
↓
Pass to form: services with provider_employee_ids[]
↓
User selects service
↓
useMemo filters employees based on provider_employee_ids
↓
Dropdown updates to show only valid employees
↓
User selects employee (guaranteed to be valid)
↓
Submit → Success
```

## Database Schema Context

The `service_providers` table creates the many-to-many relationship:
- One service can be performed by multiple employees
- One employee can perform multiple services
- Form now respects this relationship at the UI level

## Files Modified

1. **`src/features/appointments/components/AppointmentForm.tsx`**
   - Added dynamic employee filtering
   - Added service selection change handler (resets employee)
   - Added helpful UI states and error messages

2. **`src/features/services/service.ts`**
   - Added `listWithProviders()` method

3. **`src/app/(dashboard)/appointments/new/page.tsx`**
   - Changed to fetch services with providers
   - Map provider data for form

## Testing

✅ Build successful  
✅ TypeScript compiles with no errors  
✅ Employee list dynamically updates when service changes  
✅ Prevents invalid service-employee combinations  
✅ Clear user feedback when no employees available  

## Prevention

This fix prevents the error **before** submission by:
1. Only showing valid employee options
2. Providing clear feedback when no options exist
3. Guiding user to assign employees to services

The form now enforces the same constraint that the database validates, providing better UX and preventing unnecessary failed submissions.

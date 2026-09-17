# Appointment New Route Fix

## Problem

When trying to create a new appointment by navigating to `/appointments/new`, the application threw an error:

```
Failed to load appointment details: invalid input syntax for type uuid: "new"
```

## Root Cause

The appointments directory structure was missing a dedicated `new` folder:

```
src/app/(dashboard)/appointments/
├── page.tsx           (list page)
└── [id]/
    └── page.tsx       (detail page)
```

When navigating to `/appointments/new`, Next.js's dynamic routing treated "new" as an `[id]` parameter and passed it to the appointment detail page, which tried to parse it as a UUID.

## Solution

Created a dedicated `new` folder with its own page to handle appointment creation:

```
src/app/(dashboard)/appointments/
├── page.tsx           (list page)
├── new/
│   └── page.tsx       (NEW - creation form)
└── [id]/
    └── page.tsx       (detail page)
```

### Route Priority in Next.js

Next.js prioritizes static routes over dynamic routes:
- `/appointments/new` → matches `new/page.tsx` (static segment)
- `/appointments/abc-123` → matches `[id]/page.tsx` (dynamic segment)

This ensures "new" is never treated as a UUID.

## Implementation

**File Created:** `src/app/(dashboard)/appointments/new/page.tsx`

Current implementation:
- Basic page structure with header and back button
- Placeholder message: "Appointment creation form coming soon"
- Note directing users to the public booking page

**Future Enhancement:**
The page is ready to receive an appointment form component when implemented.

## Verification

Build succeeded with new route visible:
```
✓ /appointments/new    171 B    106 kB
```

The route is now accessible without errors.

## Files Modified

- **New:** `src/app/(dashboard)/appointments/new/page.tsx`

## Related Routes Pattern

This same pattern is used throughout the application:
- `/customers/new` vs `/customers/[id]`
- `/products/new` vs `/products/[id]`
- `/employees/new` vs `/employees/[id]`
- `/services/new` vs `/services/[id]`

The appointments route now follows this consistent pattern.

## Next Steps

To complete appointment creation functionality:

1. Create an `AppointmentForm` component in `src/features/appointments/components/`
2. Add server action in `src/app/actions/appointments.ts`
3. Import and use the form in the new page
4. Add validation and error handling
5. Implement customer, employee, and service selection
6. Add date/time picker with availability checking

For now, customers can book appointments through the public booking flow at `/book/[slug]`.

# Employee User Creation Feature

## Overview

Implemented the ability for admins to create employee accounts with email/password during employee creation. When an employee account is created, they can sign in and will be automatically assigned to the organization that created their user.

## Implementation Summary

### 1. New Service: `user-creation-service.ts`

Created a new service that handles employee account creation using Supabase Auth Admin API:

**Location:** `src/features/employees/user-creation-service.ts`

**Key Features:**
- Uses admin client (service role) to bypass RLS
- Creates user in `auth.users` with email/password
- Creates `user_profiles` record linking user to organization
- Updates `auth.users.app_metadata` with organization_id and role
- Creates `employees` record linked to the user profile
- Transaction-like rollback on failure

**Security:**
- Password validation (minimum 8 characters)
- Email verification is skipped (admin-created accounts are pre-verified)
- Users are assigned 'employee' role by default
- All users are automatically linked to the creating organization

### 2. Updated Server Action: `employees.ts`

Extended the `createEmployeeAction` to support two modes:

**Standard Mode:** Creates employee without user account (existing behavior)
**User Account Mode:** Creates both employee and user account together

**Form Values Added:**
- `create_user_account?: boolean` - Toggle for user account creation
- `email?: string` - Employee email for sign-in
- `password?: string` - Initial password set by admin

### 3. Updated Form: `EmployeeForm.tsx`

Added a new section to the employee creation form:

**UI Changes:**
- Checkbox: "Create user account for this employee"
- Conditional fields (shown when checkbox is checked):
  - Email field (required)
  - Password field (required, minimum 8 characters)
- Inline validation and helper text

**User Experience:**
- Only shown during employee creation (not edit mode)
- Fields are conditionally required based on checkbox state
- Clear visual grouping with border and padding

### 4. Updated Server Factory: `server.ts`

Extended the return type to include `organizationId` so the action can pass it to the user creation service.

## Database Flow

```
Admin creates employee with account
↓
1. Supabase Auth creates user in auth.users
↓
2. Insert into user_profiles (links user to organization)
↓
3. Update auth.users.app_metadata (organization_id, role='employee')
↓
4. Generate slug for employee
↓
5. Insert into employees table (with user_profile_id reference)
↓
Employee can now sign in with email/password
```

## Security Considerations

1. **Permission Check:** Only authenticated users with admin/owner role can access employee creation
2. **Password Strength:** Minimum 8 characters enforced at form and service level
3. **Email Verification:** Skipped for MVP (admin-created accounts are trusted)
4. **Role Assignment:** Always defaults to 'employee' role
5. **Admin Client Usage:** Uses service role only in server-side code, never exposed to client

## Testing

The implementation builds successfully with TypeScript strict mode.

**To Test:**
1. Sign in as an admin/owner
2. Navigate to Employees > New Employee
3. Fill in employee details
4. Check "Create user account for this employee"
5. Enter email and password
6. Submit form
7. Employee should be created with a user account
8. Employee can sign in using the provided email/password

## Files Modified

- `src/features/employees/user-creation-service.ts` (new)
- `src/app/actions/employees.ts`
- `src/features/employees/components/EmployeeForm.tsx`
- `src/features/employees/server.ts`

## Future Enhancements

- Add "Send password reset email" option instead of setting password
- Support linking existing employees to user accounts (edit mode)
- Role selection (currently fixed to 'employee')
- Password strength indicator in UI
- Bulk employee import with auto-account creation

## Notes

- Email verification is intentionally skipped per requirements
- Password is set by admin during creation (not sent via email)
- Both employee record and user account are created atomically
- Rollback logic ensures no orphaned records on failure

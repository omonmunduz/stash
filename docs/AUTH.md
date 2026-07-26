# Authentication Architecture

## Overview

The authentication system uses **Supabase Auth** with **multi-tenant isolation** through Row Level Security (RLS). Every user belongs to exactly one organization, and can only access data within their organization.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  User enters email/password                                         │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Supabase Auth validates credentials                                │
│  - Checks bcrypt hash                                               │
│  - Issues JWT with user_id                                          │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  JWT includes custom claims from app_metadata:                      │
│  {                                                                   │
│    sub: "user-uuid",                                                │
│    email: "user@example.com",                                       │
│    app_metadata: {                                                  │
│      organization_id: "org-uuid",      ← Added during onboarding   │
│      role: "owner"                     ← User's role in org        │
│    }                                                                 │
│  }                                                                   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Every database query automatically filtered by RLS:                │
│  - RLS reads organization_id from JWT                               │
│  - Only returns rows where organization_id matches                  │
│  - Zero-trust: even if app has a bug, DB enforces isolation        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Complete Login Flow

### 1. User Signup

```
User fills form → AuthService.signUp()
    ↓
Creates auth.users record
    ↓
Sends verification email
    ↓
Returns { userId, needsVerification: true }
    ↓
Redirect to "Check your email" page
```

**Important:** At this point, the user has NO organization and NO user_profile. The JWT contains ONLY the user ID and email.

### 2. Email Verification

```
User clicks link in email
    ↓
Supabase redirects to /auth/callback?code=xxx&type=signup
    ↓
Callback route exchanges code for session
    ↓
Middleware detects: user authenticated BUT no organization
    ↓
Redirect to /onboarding/setup
```

### 3. Onboarding (Organization Creation)

```
User enters organization name
    ↓
Server Action (with service role client):
    ├─ Create organizations record
    ├─ Create user_profiles record (role='owner')
    └─ Update auth.users.raw_app_meta_data:
         {
           organization_id: "org-uuid",
           role: "owner"
         }
    ↓
Force session refresh → new JWT includes org context
    ↓
Redirect to /onboarding/preferences
```

**Critical:** After organization creation, the JWT is refreshed and now contains `organization_id` and `role` in `app_metadata`.

### 4. Subsequent Login

```
User enters email/password
    ↓
Supabase Auth validates
    ↓
JWT issued with embedded claims:
    {
      sub: "user-id",
      app_metadata: {
        organization_id: "org-uuid",
        role: "owner"
      }
    }
    ↓
Middleware reads JWT → user authenticated with org
    ↓
RLS policies use JWT claims → data automatically filtered
    ↓
Dashboard loads with organization data
```

---

## JWT Custom Claims Strategy

### Why Store organization_id in JWT?

**Without JWT claims (slow):**
```sql
-- Every RLS policy check requires this query
CREATE FUNCTION auth.organization_id() RETURNS UUID AS $$
  SELECT organization_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql;
-- Result: 1 extra DB query per RLS evaluation = SLOW
```

**With JWT claims (fast):**
```sql
-- Read directly from JWT (no DB query)
CREATE FUNCTION auth.organization_id() RETURNS UUID AS $$
  SELECT (auth.jwt()->'app_metadata'->>'organization_id')::uuid;
$$ LANGUAGE sql;
-- Result: Zero DB queries = FAST
```

### How JWT Claims Are Set

**During onboarding (Server Action with service role):**
```typescript
const supabaseAdmin = createAdminClient()

// Update user's app_metadata (requires service role)
await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: {
    organization_id: orgId,
    role: 'owner',
  },
})

// Force session refresh to get new JWT
await supabase.auth.refreshSession()
```

**On every subsequent login:**
Supabase automatically includes `app_metadata` in the JWT. No extra work needed.

---

## Row Level Security (RLS) Integration

### Helper Functions

```sql
-- Get organization_id from JWT (fast) or fallback to DB (slow)
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->>'organization_id')::uuid,
    (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get user role from JWT (fast) or fallback to DB (slow)
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->>'role')::user_role,
    (SELECT role FROM user_profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Fallback strategy:** If JWT doesn't have claims (older session), query the DB. This ensures no data leaks during migration/updates.

### RLS Policy Example

```sql
-- Customers table: users can only see customers in their organization
CREATE POLICY "Users can view customers in their organization"
ON customers FOR SELECT
USING (organization_id = auth.organization_id());

-- No explicit WHERE clause in application queries needed
-- RLS automatically filters at the database level
```

---

## Role Hierarchy

```
owner (level 4)
    ↓
admin (level 3)
    ↓
manager (level 2)
    ↓
employee (level 1)
```

### Permission Matrix

| Action | Owner | Admin | Manager | Employee |
|--------|-------|-------|---------|----------|
| Manage organization settings | ✅ | ❌ | ❌ | ❌ |
| Invite/remove users | ✅ | ✅ | ❌ | ❌ |
| Manage products | ✅ | ✅ | ✅ | ❌ (view only) |
| Create sales | ✅ | ✅ | ✅ | ✅ |
| Edit any sale | ✅ | ✅ | ✅ | ❌ (own only) |
| Record payments | ✅ | ✅ | ✅ | ✅ |
| Manage expenses | ✅ | ✅ | ✅ | ❌ |
| View reports | ✅ | ✅ | ✅ | ✅ (limited) |

**Implemented via:**
- RLS policies in the database
- Permission checks in `src/features/users/business-rules.ts`
- Route guards in `src/features/auth/guards.ts`

---

## Session Management

### Session Lifecycle

```
Login
    ↓
JWT issued (expires in 1 hour)
    ↓
Refresh token stored in httpOnly cookie (expires in 30 days)
    ↓
Middleware refreshes JWT before expiration
    ↓
User stays logged in for 30 days (or until logout)
```

### Server-Side Session Access

```typescript
// In Server Components, Server Actions, API Routes
import { getCurrentUser } from '@/lib/supabase/session'

const user = await getCurrentUser()
if (!user) redirect(ROUTES.auth.login)

// user.organizationId is available
// RLS automatically filters queries
```

### Client-Side Session Access

```typescript
// In Client Components
import { useAuth } from '@/features/auth/hooks'

const { user, isLoading } = useAuth()

if (isLoading) return <LoadingSpinner />
if (!user) return <LoginPrompt />

return <Dashboard user={user} />
```

---

## Multi-Tenant Data Isolation

### Three Layers of Protection

**1. Application Layer (defensive)**
```typescript
// Service always requires organization_id
const customers = await customerRepo.findAll({
  organization_id: user.organizationId, // Explicit filter
})
```

**2. RLS Layer (enforcement)**
```sql
-- Database enforces isolation even if app has a bug
CREATE POLICY "..." ON customers
USING (organization_id = auth.organization_id());
```

**3. JWT Claims (zero-query performance)**
```
JWT contains organization_id → RLS reads from JWT → no extra query
```

**Result:** Even if the application has a bug and forgets to filter by organization_id, RLS prevents data leaks.

---

## Handling Role Changes

When an admin changes a user's role:

```typescript
// 1. Update database
await supabase
  .from('user_profiles')
  .update({ role: 'manager' })
  .eq('id', targetUserId)

// 2. Update JWT claims (service role required)
const supabaseAdmin = createAdminClient()
await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
  app_metadata: { role: 'manager' },
})

// 3. User must refresh session to get new JWT
// Option A: Force logout (user logs back in with new role)
// Option B: Auto-refresh (call refreshSession on their behalf)
```

**Trade-off:** JWT claims are cached for the session duration. Role changes don't take effect until the JWT is refreshed.

---

## Auth Flow State Machine

```
┌─────────────────┐
│  UNAUTHENTICATED │
│                 │
│  /login         │
│  /signup        │
└────────┬────────┘
         │ sign up
         ▼
┌─────────────────┐
│  AUTHENTICATED  │
│  NO ORGANIZATION│
│                 │
│  /onboarding/*  │
└────────┬────────┘
         │ create org
         ▼
┌─────────────────┐
│  AUTHENTICATED  │
│  HAS ORGANIZATION│
│                 │
│  /dashboard/*   │
│  /customers/*   │
│  /sales/*       │
└─────────────────┘
```

### State Transitions

| Current State | Event | Next State | Redirect To |
|---------------|-------|------------|-------------|
| Unauthenticated | Sign up | Authenticated, no org | /onboarding/setup |
| Unauthenticated | Log in (has org) | Authenticated, has org | /dashboard |
| Unauthenticated | Log in (no org) | Authenticated, no org | /onboarding/setup |
| Authenticated, no org | Create org | Authenticated, has org | /onboarding/preferences |
| Authenticated, has org | Log out | Unauthenticated | /login |

---

## Security Considerations

### ✅ What We Do

1. **Password requirements:** Min 8 chars, enforced by Supabase
2. **Email verification:** Required before full access
3. **JWT expiration:** 1 hour access token, 30 day refresh
4. **httpOnly cookies:** Tokens not accessible to JavaScript
5. **RLS enforcement:** Database-level data isolation
6. **Service role protection:** Admin API key never exposed to browser
7. **CSRF protection:** Supabase handles this automatically

### ⚠️ What We DON'T Do (Yet)

1. **2FA/MFA:** Not in MVP (add in Phase 2)
2. **OAuth providers:** Not in MVP (Google/GitHub login in Phase 2)
3. **Session device tracking:** Not in MVP
4. **Password breach detection:** Not in MVP (use haveibeenpwned API in Phase 2)
5. **Rate limiting:** Supabase provides basic limits; advanced rate limiting in Phase 2

---

## Testing Auth

### Manual Test Flow

**1. Create Account**
```
1. Go to /signup
2. Enter name, email, password
3. Verify email is sent
4. Click verification link → redirected to /onboarding/setup
```

**2. Onboarding**
```
1. Enter organization name
2. Complete preferences
3. Add first product (optional)
4. Redirected to /dashboard
```

**3. Login Again**
```
1. Sign out
2. Go to /login
3. Enter credentials
4. Redirected to /dashboard (already has org)
```

**4. Multi-Tenant Test**
```
1. Create 2 accounts with different orgs
2. Log in as user 1 → create customer "Alice"
3. Log in as user 2 → search for "Alice" → should NOT find it
4. Verify: each user sees only their organization's data
```

---

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Provider** | Supabase Auth |
| **Session Storage** | httpOnly cookies (managed by Supabase) |
| **JWT Claims** | `app_metadata: { organization_id, role }` |
| **Data Isolation** | Row Level Security (RLS) on every table |
| **Roles** | owner, admin, manager, employee (hierarchy) |
| **Multi-Tenant Model** | One organization per account (org created during onboarding) |
| **Permission Checks** | RLS (DB) + Guards (app) + Business Rules (domain) |
| **Session Duration** | 1 hour access, 30 day refresh |

The architecture ensures **data can never leak across organizations** even if the application has bugs, because the database enforces isolation via RLS.

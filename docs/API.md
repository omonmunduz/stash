# API Design & Conventions

## Overview

This application uses **Server Actions** as the primary API pattern (Next.js 15 App Router). Traditional REST API routes exist but are secondary (webhooks, external integrations).

**Architecture:**
```
UI Component
    ↓ calls
Server Action (src/app/actions/*.ts)
    ↓ validates & calls
Service Layer (src/features/*/service.ts)
    ↓ calls
Repository Layer
    ↓
Database
```
$env:ANTHROPIC_BASE_URL="https://api.gateyourway.com"
$env:ANTHROPIC_AUTH_TOKEN="gyw-sk-ef7acc344be008016d394ad4a5014a02e9601498908f335478a3ee4c040d156f"
$env:ANTHROPIC_MODEL="claude-opus-5"



---

## Server Actions Pattern

### Location

`src/app/actions/` — grouped by domain:

```
src/app/actions/
├── customers.ts      # Customer CRUD
├── products.ts       # Product CRUD
├── sales.ts          # Sale creation, completion, cancellation
├── payments.ts       # Payment recording
├── inventory.ts      # Manual adjustments
├── expenses.ts       # Expense tracking
└── auth.ts           # Login, signup, password reset
```

### Anatomy of a Server Action

```typescript
// app/actions/customers.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireServerUser } from '@/lib/supabase/session'
import { SupabaseCustomerRepository } from '@/features/customers/repository'
import { CustomerService } from '@/features/customers/service'
import { createCustomerSchema } from '@/features/customers/validation'
import type { CreateCustomerInput } from '@/features/customers/types'
import type { Result } from '@/lib/types/common'

export async function createCustomerAction(
  input: CreateCustomerInput
): Promise<Result<{ id: string }>> {
  try {
    // 1. Authentication
    const user = await requireServerUser()
    
    // 2. Validation
    const parsed = createCustomerSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0].message
      }
    }
    
    // 3. Business Logic
    const supabase = await createClient()
    const repo = new SupabaseCustomerRepository(supabase)
    const service = new CustomerService(repo, user.organizationId)
    
    const result = await service.createCustomer(parsed.data)
    
    if (!result.success) {
      return result
    }
    
    // 4. Cache Invalidation
    revalidatePath('/customers')
    
    // 5. Return
    return {
      success: true,
      data: { id: result.data.id }
    }
  } catch (error) {
    console.error('createCustomerAction error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}
```

### Key Conventions

**1. Always mark with `'use server'`**

Required for Server Actions to work.

**2. Return `Result<T>` type**

```typescript
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string }
```

Never throw exceptions for expected errors (validation, business rules).

**3. Validate input with Zod**

Even if client validated, re-validate on server (security).

**4. Use service layer**

Never call repository directly from actions. Services orchestrate business logic.

**5. Revalidate cache**

Call `revalidatePath()` or `revalidateTag()` after mutations so Server Components re-fetch.

**6. Log errors**

Catch unexpected errors, log them, return generic message to user (don't leak internals).

---

## Action Naming Convention

**Pattern:** `{verb}{Entity}Action`

**Examples:**
- `createCustomerAction`
- `updateProductAction`
- `completeSaleAction`
- `recordPaymentAction`
- `adjustInventoryAction`

**Why "Action" suffix?** Distinguishes from regular functions. Makes imports clear:
```typescript
import { createCustomer } from '@/features/customers/service'  // Service
import { createCustomerAction } from '@/app/actions/customers'  // Action
```

---

## Client Usage

### From Client Components

```typescript
'use client'

import { useTransition } from 'react'
import { createCustomerAction } from '@/app/actions/customers'
import { useRouter } from 'next/navigation'

export function CustomerForm() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  
  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createCustomerAction({
        name: formData.get('name') as string,
        phone: formData.get('phone') as string,
        // ...
      })
      
      if (!result.success) {
        toast.error(result.error)
        return
      }
      
      toast.success('Customer created')
      router.push('/customers')
    })
  }
  
  return (
    <form action={handleSubmit}>
      <input name="name" required />
      <button disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Customer'}
      </button>
    </form>
  )
}
```

**Key points:**
- Use `useTransition` for pending state
- Check `result.success` before proceeding
- Show user-friendly errors from `result.error`

---

### From Server Components

Server Components can call services directly (no action needed):

```typescript
// app/customers/[id]/page.tsx
export default async function CustomerPage({ params }: Props) {
  const user = await requireServerUser()
  const supabase = await createClient()
  
  const repo = new SupabaseCustomerRepository(supabase)
  const service = new CustomerService(repo, user.organizationId)
  
  const customer = await service.getCustomer(params.id)
  
  if (!customer) notFound()
  
  return <CustomerDetail customer={customer} />
}
```

**No action needed for reads.**

---

## REST API Routes (Secondary)

### When to Use

Use traditional API routes (`app/api/*/route.ts`) for:
1. **Webhooks** (Stripe, external services)
2. **Public APIs** (if exposing data to third parties)
3. **Mobile app backend** (Phase 2)

**Don't use for:** Regular UI interactions (use Server Actions instead).

### Example: Stripe Webhook

```typescript
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }
  
  // Handle event
  switch (event.type) {
    case 'customer.subscription.updated':
      const subscription = event.data.object
      await handleSubscriptionUpdate(subscription)
      break
  }
  
  return Response.json({ received: true })
}
```

**Key points:**
- Verify webhook signature (security)
- Use admin client (bypasses RLS)
- Return 200 quickly (async processing)

---

## Error Handling

### Expected Errors (Business Rules)

Return as `Result<T>`:

```typescript
const result = await service.createSale(input)
if (!result.success) {
  return { success: false, error: result.error }
}
```

**Examples:**
- Validation errors ("Email is invalid")
- Business rule violations ("Insufficient stock")
- Permission errors ("Requires manager role")

### Unexpected Errors (Bugs, Network Issues)

Catch and log:

```typescript
try {
  // ... business logic
} catch (error) {
  console.error('Action failed:', error)
  
  // Send to error tracking (Sentry, etc.)
  captureException(error)
  
  return {
    success: false,
    error: 'An unexpected error occurred. Please try again.'
  }
}
```

**Don't leak error details to user** (security risk).

---

## Rate Limiting (Phase 2)

**Strategy:** Use Upstash Rate Limit for Server Actions.

```typescript
import { Ratelimit } from '@upstash/ratelimit'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
})

export async function createCustomerAction(input: CreateCustomerInput) {
  const user = await requireServerUser()
  
  const { success } = await ratelimit.limit(user.id)
  if (!success) {
    return { success: false, error: 'Rate limit exceeded. Slow down.' }
  }
  
  // ... rest of action
}
```

**Limits (proposed):**
- 10 requests per 10 seconds per user (mutations)
- 100 requests per minute per user (reads)

---

## Cache Invalidation

### revalidatePath

**When:** Mutating data shown on a specific page.

```typescript
// After creating customer
revalidatePath('/customers')  // Re-fetch customers list

// After updating customer #123
revalidatePath(`/customers/${id}`)  // Re-fetch detail page
```

### revalidateTag

**When:** Data is shown on multiple pages (more flexible).

```typescript
// Tag data during fetch
fetch(url, { next: { tags: ['customers'] } })

// Invalidate all queries with tag
revalidateTag('customers')
```

**Pattern:**
- Tag: `customers` → revalidates all customer queries
- Tag: `customer:${id}` → revalidates specific customer

---

## Type Safety

### Server Action Types

```typescript
// actions/customers.ts
export async function createCustomerAction(
  input: CreateCustomerInput  // ← Typed input
): Promise<Result<{ id: string }>>  // ← Typed output
```

### Client Usage

```typescript
// TypeScript knows the shape
const result = await createCustomerAction({ name: 'ABC' })

if (result.success) {
  console.log(result.data.id)  // ← TypeScript knows `data` exists
} else {
  console.log(result.error)  // ← TypeScript knows `error` exists
}
```

---

## Testing Server Actions

### Unit Test (Service Layer)

```typescript
describe('CustomerService', () => {
  it('creates customer with valid input', async () => {
    const mockRepo = createMockRepository()
    const service = new CustomerService(mockRepo, orgId)
    
    const result = await service.createCustomer({
      name: 'ABC Corp',
      phone: '555-0100'
    })
    
    expect(result.success).toBe(true)
    expect(mockRepo.create).toHaveBeenCalledWith(...)
  })
})
```

**Test the service, not the action.** Actions are thin wrappers.

### Integration Test (E2E)

```typescript
// tests/e2e/customers.spec.ts
test('create customer flow', async ({ page }) => {
  await page.goto('/customers/new')
  await page.fill('[name="name"]', 'ABC Corp')
  await page.fill('[name="phone"]', '555-0100')
  await page.click('button[type="submit"]')
  
  await expect(page).toHaveURL('/customers')
  await expect(page.locator('text=ABC Corp')).toBeVisible()
})
```

---

## API Documentation (External)

**Phase 2:** If exposing REST API to third parties, generate OpenAPI spec.

```yaml
# openapi.yaml
paths:
  /api/v1/customers:
    get:
      summary: List customers
      security:
        - BearerAuth: []
      responses:
        200:
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Customer'
```

**Tool:** Use `@asteasolutions/zod-to-openapi` to generate from Zod schemas.

---

## Security Best Practices

### 1. Always Authenticate

```typescript
const user = await requireServerUser()
// Throws if not authenticated
```

### 2. Always Authorize

```typescript
const roleCheck = requireRole(user, 'manager')
if (!roleCheck.success) {
  return { success: false, error: roleCheck.error }
}
```

### 3. Validate Input

```typescript
const parsed = schema.safeParse(input)
if (!parsed.success) {
  return { success: false, error: parsed.error.errors[0].message }
}
```

### 4. Use Services (Not Direct DB Calls)

```typescript
// ❌ Bad: Direct database call from action
const { data } = await supabase.from('customers').insert(...)

// ✅ Good: Go through service
const service = new CustomerService(repo, orgId)
const result = await service.createCustomer(input)
```

**Why?** Services enforce business rules. Direct DB calls bypass them.

### 5. Sanitize Errors

```typescript
// ❌ Bad: Leak internal error
return { error: error.message }  // "PGRST116 JWT token expired"

// ✅ Good: Generic message
return { error: 'An error occurred. Please try again.' }
```

---

## Performance

### Parallel Actions

Run independent actions in parallel:

```typescript
const [customers, products] = await Promise.all([
  getCustomersAction(),
  getProductsAction()
])
```

### Streaming (Phase 2)

For large datasets, stream results:

```typescript
export async function* getCustomersStream() {
  const batches = await getBatchedCustomers()
  for (const batch of batches) {
    yield batch
  }
}
```

---

## Conventions Summary

| Convention | Pattern | Example |
|------------|---------|---------|
| **File location** | `app/actions/{domain}.ts` | `app/actions/customers.ts` |
| **Function naming** | `{verb}{Entity}Action` | `createCustomerAction` |
| **Return type** | `Result<T>` | `Result<{ id: string }>` |
| **Authentication** | `requireServerUser()` at top | Always first line |
| **Validation** | Zod schema | `schema.safeParse(input)` |
| **Error handling** | Try/catch with generic message | "An error occurred" |
| **Cache** | `revalidatePath()` after mutation | `revalidatePath('/customers')` |
| **Directive** | `'use server'` at top of file | Required |

---

## Migration from REST API

**If migrating from REST API to Server Actions:**

**Before (REST API):**
```typescript
// API route
export async function POST(req: Request) {
  const body = await req.json()
  // ... logic
  return Response.json({ id: '...' })
}

// Client
const res = await fetch('/api/customers', {
  method: 'POST',
  body: JSON.stringify(data)
})
const json = await res.json()
```

**After (Server Action):**
```typescript
// Server Action
export async function createCustomerAction(input: CreateCustomerInput) {
  // ... logic
  return { success: true, data: { id: '...' } }
}

// Client
const result = await createCustomerAction(data)
```

**Benefits:**
- No manual serialization (automatic)
- Type-safe (input/output typed)
- Simpler (no fetch boilerplate)
- Faster (no extra network hop)

---

## Summary

**Server Actions are the primary API pattern because:**
1. **Type-safe** — input/output types enforced
2. **Simpler** — no manual fetch, serialization, or error handling
3. **Faster** — direct server function call
4. **Secure** — authentication/authorization built-in
5. **Cacheable** — integrates with Next.js cache

**REST API routes exist only for:**
- Webhooks (Stripe, external services)
- Public APIs (third-party integrations)
- Mobile apps (Phase 2)

**Every action follows the same pattern: authenticate → validate → delegate to service → revalidate cache → return Result<T>.**

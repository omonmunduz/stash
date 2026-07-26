# Repository Layer Architecture

## Overview

The repository layer isolates the UI from the database implementation. This is a **multi-layered architecture** where each layer has a single responsibility and depends only on abstractions, not concrete implementations.

---

## The Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (React Components, Next.js Pages)                 │
│  - Never imports Supabase directly                          │
│  - Calls services through Server Actions or API routes      │
└────────────────────────┬────────────────────────────────────┘
                         │ calls
┌────────────────────────▼────────────────────────────────────┐
│  Service Layer (service.ts)                                 │
│  - Orchestrates business logic                              │
│  - Coordinates multiple repositories                        │
│  - Applies business rules                                   │
│  - Returns Result<T> for error handling                     │
└────────┬───────────────────────────────────┬────────────────┘
         │ calls                             │ calls
┌────────▼───────────────┐         ┌────────▼──────────────┐
│  Repository Interface  │         │  Business Rules       │
│  (repository.ts)       │         │  (business-rules.ts)  │
│  - Abstract contract   │         │  - Pure functions     │
│  - No implementation   │         │  - No side effects    │
└────────┬───────────────┘         └───────────────────────┘
         │ implemented by
┌────────▼───────────────────────────────────────────────────┐
│  Concrete Repository (SupabaseCustomerRepository)          │
│  - Implements the interface                                │
│  - Uses queries.ts for Supabase operations                 │
│  - Maps DB types to domain types                           │
└────────────────────────┬───────────────────────────────────┘
                         │ uses
┌────────────────────────▼───────────────────────────────────┐
│  Query Builders (queries.ts)                               │
│  - Supabase-specific query construction                    │
│  - Column selection strings                                │
│  - Filter builders                                         │
└────────────────────────┬───────────────────────────────────┘
                         │ calls
┌────────────────────────▼───────────────────────────────────┐
│  Supabase Client                                           │
│  - Database connection                                     │
│  - Auth session management                                 │
│  - RLS enforcement                                         │
└────────────────────────────────────────────────────────────┘
```

---

## File Structure Per Feature

Each feature follows this consistent structure:

```
src/features/customers/
├── types.ts              ← Domain types (Customer, CreateCustomerInput, etc.)
├── validation.ts         ← Zod schemas for runtime validation
├── business-rules.ts     ← Pure business logic functions
├── queries.ts            ← Supabase query builders
├── repository.ts         ← Interface + Supabase implementation
└── service.ts            ← Orchestration layer (UI calls this)
```

---

## Layer Responsibilities

### 1. `types.ts` — Domain Types

**What it contains:**
- TypeScript interfaces for entities
- Input/output type definitions
- Filter types
- Joined entity types

**Dependencies:** `@/lib/types/common.ts` only

**Why separate:** Domain types are the contract between all layers. They don't change when we swap databases.

---

### 2. `validation.ts` — Runtime Validation

**What it contains:**
- Zod schemas for validating user input
- Refinements for complex validation rules
- Type inference exports

**Dependencies:** `zod`, `types.ts`

**Why separate:** Validation is a cross-cutting concern. Schemas are used in:
- API routes (validate request bodies)
- Forms (client-side validation)
- Repository layer (defensive validation)

**Naming change:** Previously `schemas.ts`. Renamed to `validation.ts` to clarify purpose.

---

### 3. `business-rules.ts` — Pure Business Logic

**What it contains:**
- Pure functions (no side effects, no I/O)
- Calculations (profit, credit limits, etc.)
- Business rule checks that return `Result<T>`
- Helper functions (generateCustomerCode, etc.)

**Dependencies:** `types.ts`, `@/lib/types/common.ts`

**Why separate:** 
- Testable in isolation without database or mocks
- Reusable across multiple services
- Easy to understand (no hidden side effects)

---

### 4. `queries.ts` — Supabase Query Builders

**What it contains:**
- Column selection strings (for consistency)
- Query builder functions
- Common filter patterns
- Join definitions

**Dependencies:** `@supabase/supabase-js`, `@/lib/database.types.ts`

**Why separate:**
- Encapsulates Supabase API details
- Reused across repository methods
- Easy to test (returns query builder, doesn't execute)
- Can be replaced when switching databases

**Example:**
```typescript
export const CUSTOMER_COLUMNS = 'id, name, email, current_balance, ...'

export function customerBaseQuery(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
}
```

---

### 5. `repository.ts` — Data Access Contract + Implementation

**What it contains:**
- `interface CustomerRepository` — the abstract contract
- `class SupabaseCustomerRepository implements CustomerRepository` — concrete implementation
- Mapper functions (DB rows → domain types)

**Dependencies:** 
- Interface: `types.ts` only
- Implementation: `queries.ts`, `@supabase/supabase-js`, `validation.ts`

**Why separate interface from implementation:**
- **Testability:** Tests can use mock repositories
- **Replaceability:** Swap Supabase with Prisma/Drizzle without changing service layer
- **Dependency inversion:** High-level code depends on abstractions, not details

**Mapper functions:** Convert database types to domain types:
```typescript
function mapRowToCustomer(row: CustomerRow): Customer {
  return {
    ...row,
    id: row.id as CustomerId,
    created_at: new Date(row.created_at), // string → Date
    // ... other field mappings
  }
}
```

---

### 6. `service.ts` — Business Logic Orchestration

**What it contains:**
- Public API for UI to call
- Coordinates multiple repositories
- Applies business rules before/after repository calls
- Transaction management (when operations span multiple tables)
- Returns `Result<T>` for graceful error handling

**Dependencies:** `repository.ts` (interface only), `business-rules.ts`, `types.ts`

**Why this layer exists:**

The repository is low-level CRUD. The service is high-level use cases.

**Example:**
```typescript
// ❌ Without service layer — business logic leaks into UI
const customer = await customerRepo.findById(id)
if (!customer) return { error: 'Not found' }
if (!customer.is_active) return { error: 'Inactive' }
const creditAvailable = customer.credit_limit - customer.current_balance
if (saleTotal > creditAvailable) return { error: 'Credit exceeded' }
const sale = await saleRepo.create({ customer_id: id, total: saleTotal })

// ✅ With service layer — business logic encapsulated
const result = await salesService.createSale({ customer_id: id, total: saleTotal })
if (!result.success) return result.error
```

The service layer:
1. Loads customer from repository
2. Applies `checkCreditForSale` business rule
3. Creates sale if rules pass
4. Returns structured `Result<Sale>`

---

## Why This Architecture Improves Maintainability

### 1. **UI Never Touches Supabase**

**The Problem:**
```typescript
// ❌ BAD: UI component directly calls Supabase
export default function CustomerList() {
  const supabase = createClient()
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', orgId)
  
  return <>{data.map(...)}</>
}
```

**Why it's bad:**
- Supabase logic scattered across 50+ components
- Changing from Supabase to Prisma requires editing 50+ files
- No central place to add logging, caching, or error handling
- Business rules mixed into UI code

**The Solution:**
```typescript
// ✅ GOOD: UI calls service
export default function CustomerList() {
  const customers = await customerService.listCustomers()
  return <>{customers.map(...)}</>
}
```

**Benefits:**
- Switching databases: edit 1 file (`SupabaseCustomerRepository`)
- Adding caching: edit 1 file (`service.ts`)
- All Supabase code in one place per feature

---

### 2. **Testability at Every Layer**

**Testing the service:**
```typescript
// Mock the repository
const mockRepo: CustomerRepository = {
  findById: jest.fn().mockResolvedValue(mockCustomer),
  create: jest.fn().mockResolvedValue(mockCustomer),
  // ...
}

const service = new CustomerService(mockRepo, orgId)
const result = await service.createCustomer(input)

expect(result.success).toBe(true)
expect(mockRepo.create).toHaveBeenCalledWith(...)
```

**No database needed.** Tests are fast and isolated.

**Testing business rules:**
```typescript
const customer = { credit_limit: 1000, current_balance: 800 }
const available = availableCredit(customer)
expect(available).toBe(200)
```

**Pure function.** No mocks needed at all.

---

### 3. **Replaceability**

**Scenario:** Switch from Supabase to Prisma.

**Files that change:**
- `src/features/customers/queries.ts` — deleted or replaced with Prisma queries
- `src/features/customers/repository.ts` — new `PrismaCustomerRepository` class
- `src/lib/supabase/` — replaced with `src/lib/prisma/`

**Files that DON'T change:**
- `types.ts` — domain model unchanged
- `business-rules.ts` — pure functions, no DB dependency
- `service.ts` — depends on interface, not implementation
- **All UI code** — calls services, doesn't care about database

**Result:** Database swap is a **localized change**, not a system-wide rewrite.

---

### 4. **Clear Boundaries**

Each layer has one job:

| Layer | Job |
|-------|-----|
| UI | Display data, capture input |
| Service | Orchestrate business workflows |
| Repository | Load and save data |
| Business Rules | Enforce business constraints |
| Queries | Build database queries |

**No layer does another layer's job.** This makes code:
- Easy to locate ("where does credit limit validation happen?" → `business-rules.ts`)
- Easy to change (credit rules change → edit one file)
- Easy to onboard (new dev learns one layer at a time)

---

### 5. **Type Safety End-to-End**

```
Database Types (generated)
    ↓
Domain Types (hand-written)
    ↓
Repository Interface (typed contract)
    ↓
Service (typed orchestration)
    ↓
UI (typed props)
```

TypeScript catches errors at every boundary:
- DB column renamed? Compiler error in repository mapper.
- Repository method signature changed? Compiler error in service.
- Service return type changed? Compiler error in UI.

---

## How the UI Calls Services

### Server Components (Next.js App Router)

```typescript
// app/customers/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import { SupabaseCustomerRepository } from '@/features/customers/repository'
import { CustomerService } from '@/features/customers/service'

export default async function CustomersPage() {
  const supabase = await createServerClient()
  const repo = new SupabaseCustomerRepository(supabase)
  const service = new CustomerService(repo, await getOrgId())
  
  const customers = await service.listCustomers()
  
  return <CustomerList customers={customers} />
}
```

### Server Actions (for mutations)

```typescript
// app/customers/actions.ts
'use server'

export async function createCustomerAction(input: CreateCustomerInput) {
  const supabase = await createServerClient()
  const repo = new SupabaseCustomerRepository(supabase)
  const service = new CustomerService(repo, await getOrgId())
  
  return await service.createCustomer(input)
}
```

### API Routes (alternative)

```typescript
// app/api/customers/route.ts
export async function POST(request: Request) {
  const input = await request.json()
  const supabase = await createServerClient()
  const repo = new SupabaseCustomerRepository(supabase)
  const service = new CustomerService(repo, await getOrgId())
  
  const result = await service.createCustomer(input)
  return Response.json(result)
}
```

---

## Migration Path from Current State

**Current:** We have types, validation (schemas), business rules, and repository **interfaces**.

**Missing:** `queries.ts`, `service.ts`, and repository **implementations**.

**Next steps:**
1. Create Supabase infrastructure (`src/lib/supabase/`)
2. Implement one complete feature (Customers) as reference
3. Apply pattern to remaining 8 features
4. Test with real Supabase instance

---

## Summary

This architecture is **maintainable** because:

✅ **Single Responsibility** — each file has one job  
✅ **Dependency Inversion** — UI depends on abstractions  
✅ **Testability** — every layer can be tested in isolation  
✅ **Replaceability** — swap databases with localized changes  
✅ **Type Safety** — TypeScript enforces contracts at every boundary  
✅ **Clear Boundaries** — easy to locate and modify code  

The additional files (`queries.ts`, `service.ts`) add structure but **reduce complexity** by giving every concern its own home.

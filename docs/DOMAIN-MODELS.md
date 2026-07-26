# Domain Models Architecture

## Overview

This document explains the domain model architecture for the Stash wholesale management system.

## Design Principles

### 1. Feature-Based Architecture

```
src/
├── features/
│   ├── organizations/
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── schemas.ts        # Zod validation schemas
│   │   ├── repository.ts     # Data access interface
│   │   └── business-rules.ts # Domain logic
│   ├── users/
│   ├── customers/
│   ├── products/
│   ├── inventory/
│   ├── sales/
│   ├── payments/
│   └── expenses/
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Supabase client
│   │   └── server.ts         # Server-side client
│   └── types/
│       └── database.types.ts # Generated from Supabase
```

**Why Feature-Based?**
- Each feature is self-contained (types, validation, logic, data access)
- Easy to locate all code related to a business domain
- Scales better than organizing by technical layer (models/, controllers/, etc.)
- Easier to test in isolation
- Team members can work on different features without conflicts

### 2. Type Safety Strategy

**Four Layers of Types:**

1. **Database Types** (`database.types.ts`) - Generated from Supabase schema
2. **Domain Types** (`types.ts`) - Business entities with proper TypeScript types
3. **Validation Schemas** (`schemas.ts`) - Zod schemas for runtime validation
4. **API Types** - Request/response types for API routes

**Why This Separation?**
- Database types may have nullable fields that should be required in domain
- Domain types represent business concepts, not database structure
- Validation schemas enforce rules at runtime (user input, API boundaries)
- API types can be different from domain types (DTOs, projections)

### 3. Repository Pattern

**Why Repositories?**
- Abstracts data access from business logic
- Makes testing easier (mock repositories)
- Allows switching data sources without changing business logic
- Centralizes query logic
- Type-safe data access

**Repository Structure:**
```typescript
interface Repository<T> {
  findById(id: string): Promise<T | null>
  findAll(filter?: Filter): Promise<T[]>
  create(data: CreateDTO): Promise<T>
  update(id: string, data: UpdateDTO): Promise<T>
  delete(id: string): Promise<void>
}
```

### 4. Business Rules

**Business rules are separated from:**
- UI components (React components don't contain business logic)
- Data access (repositories don't contain business logic)
- API routes (API routes orchestrate, not implement logic)

**Business rules live in:**
- `business-rules.ts` files within each feature
- Pure functions that can be tested independently
- Domain services when logic spans multiple entities

**Example:**
```typescript
// ❌ BAD: Business logic in component
function SaleForm() {
  const handleSubmit = (sale) => {
    if (customer.current_balance + sale.total > customer.credit_limit) {
      alert("Credit limit exceeded!")
    }
  }
}

// ✅ GOOD: Business logic in domain
// features/sales/business-rules.ts
export function canCreateSale(customer: Customer, saleTotal: number): Result {
  if (customer.current_balance + saleTotal > customer.credit_limit) {
    return { success: false, error: "Credit limit exceeded" }
  }
  return { success: true }
}

// Component just calls the rule
function SaleForm() {
  const handleSubmit = (sale) => {
    const result = canCreateSale(customer, sale.total)
    if (!result.success) {
      alert(result.error)
    }
  }
}
```

---

## Domain Model Relationships

### Entity Relationship Map

```
Organization (1) ──< User (many)
Organization (1) ──< Customer (many)
Organization (1) ──< Product (many)
Organization (1) ──< Inventory (many)
Organization (1) ──< Sale (many)
Organization (1) ──< Payment (many)
Organization (1) ──< Expense (many)

Customer (1) ──< Sale (many)
Customer (1) ──< Payment (many)

Sale (1) ──< SaleItem (many)
Sale (1) ──< Payment (many) [optional link]

Product (1) ──< SaleItem (many)
Product (1) ──< Inventory (1)

User (1) ──< Sale (many) [created_by]
User (1) ──< Payment (many) [created_by]
User (1) ──< Expense (many) [created_by]
```

---

## Naming Conventions

### Interfaces
- Entities: `Organization`, `Customer`, `Product`
- Create DTOs: `CreateOrganizationInput`, `CreateCustomerInput`
- Update DTOs: `UpdateOrganizationInput`, `UpdateCustomerInput`
- Filters: `CustomerFilter`, `SaleFilter`
- Results: `CreateSaleResult`, `ValidationResult`

### Zod Schemas
- Insert schemas: `insertOrganizationSchema`, `insertCustomerSchema`
- Update schemas: `updateOrganizationSchema`, `updateCustomerSchema`
- Validation schemas: `customerCodeSchema`, `emailSchema`

### Functions
- Business rules: `canCreateSale()`, `isWithinCreditLimit()`, `calculateSaleTotal()`
- Validators: `validateCustomerCode()`, `validateEmail()`
- Helpers: `formatCustomerCode()`, `generateSaleNumber()`

---

## Type Safety Best Practices

### 1. Use Branded Types for IDs

```typescript
// ❌ BAD: All IDs are just strings
type CustomerId = string
type ProductId = string

// Can accidentally pass productId where customerId expected
function getCustomer(id: CustomerId) { ... }
getCustomer(productId) // TypeScript won't catch this!

// ✅ GOOD: Branded types
type CustomerId = string & { readonly brand: unique symbol }
type ProductId = string & { readonly brand: unique symbol }

// Now TypeScript catches the error
getCustomer(productId) // Error! Type 'ProductId' is not assignable to 'CustomerId'
```

### 2. Use Discriminated Unions for Status

```typescript
// ❌ BAD: Status as simple enum
type Sale = {
  status: 'draft' | 'completed' | 'cancelled'
  completedAt?: Date  // Might be undefined even when completed
}

// ✅ GOOD: Discriminated union
type Sale = 
  | { status: 'draft' }
  | { status: 'completed', completedAt: Date }
  | { status: 'cancelled', cancelledAt: Date, reason: string }

// TypeScript knows completedAt exists when status is 'completed'
if (sale.status === 'completed') {
  console.log(sale.completedAt) // TypeScript knows this exists
}
```

### 3. Make Illegal States Unrepresentable

```typescript
// ❌ BAD: Can have payment_status = 'paid' but amount_due > 0
type Sale = {
  total: number
  amount_paid: number
  amount_due: number
  payment_status: 'unpaid' | 'partial' | 'paid'
}

// ✅ GOOD: Payment status derived from amounts
type Sale = {
  total: number
  amount_paid: number
  amount_due: number
}

function getPaymentStatus(sale: Sale): 'unpaid' | 'partial' | 'paid' {
  if (sale.amount_due <= 0) return 'paid'
  if (sale.amount_paid > 0) return 'partial'
  return 'unpaid'
}
```

---

## Validation Strategy

### Client-Side vs Server-Side

**Client-Side (Zod in React forms):**
- Validate user input before submission
- Provide immediate feedback
- Prevent unnecessary API calls

**Server-Side (Zod in API routes):**
- Always validate (never trust client)
- Validate against business rules
- Check database constraints

**Both use same Zod schemas** - consistency guaranteed!

### Validation Layers

1. **Type Level** - TypeScript catches type errors at compile time
2. **Schema Level** - Zod validates structure at runtime
3. **Business Rule Level** - Domain functions validate business logic
4. **Database Level** - PostgreSQL constraints as final safety net

---

## Error Handling Strategy

### Result Type Pattern

```typescript
type Result<T, E = string> = 
  | { success: true, data: T }
  | { success: false, error: E }

// Business rules return Results, not throw exceptions
function canCreateSale(customer: Customer, total: number): Result<void> {
  if (customer.current_balance + total > customer.credit_limit) {
    return { 
      success: false, 
      error: `Credit limit exceeded. Available: ${customer.credit_limit - customer.current_balance}` 
    }
  }
  return { success: true, data: undefined }
}

// Caller handles result explicitly
const result = canCreateSale(customer, 5000)
if (!result.success) {
  toast.error(result.error)
  return
}
// Continue with sale creation
```

**Why Results instead of Exceptions?**
- Explicit error handling (TypeScript forces you to check)
- No unexpected exceptions
- Easier to test
- Better for functional programming style

---

## Next Steps

After approval, I will create:

1. `src/features/organizations/` - Complete organization domain
2. `src/features/users/` - User management domain
3. `src/features/customers/` - Customer domain with credit logic
4. `src/features/products/` - Product catalog domain
5. `src/features/inventory/` - Inventory tracking domain
6. `src/features/sales/` - Sales transaction domain (most complex)
7. `src/features/payments/` - Payment recording domain
8. `src/features/expenses/` - Expense tracking domain
9. `src/lib/types/` - Shared types and utilities

Each feature will include:
- ✅ TypeScript interfaces
- ✅ Zod validation schemas
- ✅ Business rules with explanations
- ✅ Repository interface
- ✅ Type-safe helpers

**Ready for approval to proceed?**

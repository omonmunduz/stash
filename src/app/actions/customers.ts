/**
 * CUSTOMER SERVER ACTIONS
 *
 * The write surface for customers. Client components call these; they never
 * import the repository or hold a Supabase client.
 *
 * Conventions, matching src/app/actions/auth.ts:
 * - Return Result<T> instead of throwing, so forms can render errors inline
 * - redirect() is called after a successful mutation where the user should move
 *   on. redirect() throws internally, so it must never sit inside a try block
 * - revalidatePath() after every write, because list and detail pages are
 *   Server Components and would otherwise serve a cached view of stale data
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCustomerService } from '@/features/customers/server';
import { requireRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import type { Customer } from '@/features/customers/types';
import type { Result } from '@/lib/types/common';
import { brandId } from '@/lib/types/common';

/** Fields the create/edit form submits. Strings, as they arrive from inputs. */
export interface CustomerFormValues {
  name: string;
  business_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  /** Raw text — empty string means "no limit". */
  credit_limit?: string;
  notes?: string;
}

/**
 * Normalize form strings into the shape the Zod schemas expect.
 *
 * Empty text inputs arrive as '' rather than undefined. Passing '' through
 * would fail the email validator and would store blank strings instead of
 * nulls, so every blank collapses to undefined here.
 */
function normalize(values: CustomerFormValues) {
  const text = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };

  const rawLimit = text(values.credit_limit);
  const creditLimit = rawLimit === undefined ? undefined : Number(rawLimit);

  return {
    name: values.name?.trim() ?? '',
    business_name: text(values.business_name),
    email: text(values.email),
    phone: text(values.phone),
    address: text(values.address),
    city: text(values.city),
    credit_limit: creditLimit,
    notes: text(values.notes),
  };
}

/**
 * Create a customer, then send the user to its detail page.
 *
 * Any role may add a customer — an employee taking an order needs to be able to
 * enter a new buyer without waiting for a manager. That matches the RLS
 * customers_insert policy, which also allows any authenticated org member.
 */
export async function createCustomerAction(
  values: CustomerFormValues
): Promise<Result<Customer>> {
  const { service } = await getCustomerService();

  const input = normalize(values);

  if (input.credit_limit !== undefined && Number.isNaN(input.credit_limit)) {
    return { success: false, error: 'Credit limit must be a number.' };
  }

  const result = await service.create(input);
  if (!result.success) return result;

  revalidatePath(ROUTES.customers.list);
  redirect(ROUTES.customers.detail(result.data.id));
}

/**
 * Update a customer.
 *
 * Requires manager or above, mirroring the customers_update RLS policy. An
 * employee editing a credit limit is the specific case that policy blocks, so
 * checking here means the user gets a readable message instead of a bare
 * permission error from Postgres.
 */
export async function updateCustomerAction(
  id: string,
  values: CustomerFormValues
): Promise<Result<Customer>> {
  const { service, user } = await getCustomerService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const input = normalize(values);

  if (input.credit_limit !== undefined && Number.isNaN(input.credit_limit)) {
    return { success: false, error: 'Credit limit must be a number.' };
  }

  // update() takes nullable fields: clearing a phone number must write null, not
  // skip the key. normalize() gives undefined for blanks, so map them here where
  // the intent ("the user emptied this field") is known.
  const result = await service.update(brandId<'CustomerId'>(id), {
    name: input.name,
    business_name: input.business_name ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    credit_limit: input.credit_limit ?? null,
    notes: input.notes ?? null,
  });

  if (!result.success) return result;

  revalidatePath(ROUTES.customers.list);
  revalidatePath(ROUTES.customers.detail(id));
  redirect(ROUTES.customers.detail(id));
}

/**
 * Activate or deactivate a customer.
 *
 * Deactivating is the soft alternative to deletion: history and balance stay
 * intact, but business-rules.checkCreditForSale refuses new sales.
 */
export async function setCustomerActiveAction(
  id: string,
  isActive: boolean
): Promise<Result<Customer>> {
  const { service, user } = await getCustomerService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const result = await service.setActive(brandId<'CustomerId'>(id), isActive);
  if (!result.success) return result;

  revalidatePath(ROUTES.customers.list);
  revalidatePath(ROUTES.customers.detail(id));
  return result;
}

/**
 * Soft-delete a customer, then return to the list.
 *
 * Admin or above: this is the one customer operation that removes a record from
 * every view, so it sits a level above ordinary edits. The service still refuses
 * if the customer owes money.
 */
export async function deleteCustomerAction(id: string): Promise<Result<void>> {
  const { service, user } = await getCustomerService();

  const permission = requireRole(user, 'admin');
  if (!permission.success) return permission;

  const result = await service.delete(brandId<'CustomerId'>(id));
  if (!result.success) return result;

  revalidatePath(ROUTES.customers.list);
  redirect(ROUTES.customers.list);
}

/**
 * Typeahead search, for the customer picker on the sale form.
 * Read-only, so no role check beyond being a signed-in org member.
 */
export async function searchCustomersAction(query: string) {
  const { service } = await getCustomerService();
  return service.search(query);
}

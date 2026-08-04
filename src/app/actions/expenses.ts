/**
 * EXPENSE SERVER ACTIONS
 *
 * The write surface for expenses. Client components call these; they never import
 * the repository or hold a Supabase client.
 *
 * Same conventions as the other action modules:
 * - Return Result<T> instead of throwing, so forms can render errors inline
 * - redirect() sits outside any try block, because it throws internally
 * - revalidatePath() after every write, since the pages are Server Components
 *
 * Recording is open to every role, matching expenses_insert_any_role — an employee
 * sent out for packing tape has to be able to log what it cost. Correcting and
 * deleting are manager work, matching expenses_update_manager_or_above.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getExpenseService } from '@/features/expenses/server';
import { requireRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import type { Expense } from '@/features/expenses/types';
import type { PaymentMethod } from '@/features/payments/types';
import type { Result } from '@/lib/types/common';
import { brandId } from '@/lib/types/common';

/** Fields the create/edit form submits. Strings, as they arrive from inputs. */
export interface ExpenseFormValues {
  /** Raw text from a number input. */
  amount: string;
  category: string;
  description: string;
  payment_method: PaymentMethod;
  /** ISO date (yyyy-mm-dd). Blank means today. */
  expense_date?: string;
  vendor?: string;
}

/**
 * Normalize form strings into the shape the Zod schemas expect.
 *
 * Blank text inputs arrive as '' rather than undefined, and '' would be stored as
 * an empty string instead of null, so every blank collapses to undefined. The
 * amount is converted here and NaN reported by the caller, because Zod's message
 * for a failed number coercion is not one a shop owner can act on.
 */
function normalize(values: ExpenseFormValues) {
  const text = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };

  return {
    amount: text(values.amount) === undefined ? undefined : Number(values.amount.trim()),
    category: values.category?.trim() ?? '',
    description: values.description?.trim() ?? '',
    payment_method: values.payment_method,
    expense_date: text(values.expense_date)
      ? parseDateInput(values.expense_date!)
      : new Date(),
    vendor: text(values.vendor),
  };
}

/**
 * Record an expense, then go to the list.
 *
 * No role guard — every role may insert, and the RLS policy is what enforces the
 * organization boundary.
 */
export async function createExpenseAction(
  values: ExpenseFormValues
): Promise<Result<Expense>> {
  const { service } = await getExpenseService();

  const input = normalize(values);

  if (input.amount === undefined) {
    return { success: false, error: 'Enter an amount.' };
  }

  if (Number.isNaN(input.amount)) {
    return { success: false, error: 'Amount must be a number.' };
  }

  const result = await service.create(input);
  if (!result.success) return result;

  revalidatePath(ROUTES.expenses.list);
  revalidatePath(ROUTES.dashboard.home);
  redirect(ROUTES.expenses.list);
}

/**
 * Correct an expense.
 *
 * Manager or above. An expense is a number that comes straight off profit, so
 * changing one after the fact is a supervised correction rather than routine
 * entry — the same split as payments.
 */
export async function updateExpenseAction(
  id: string,
  values: ExpenseFormValues
): Promise<Result<Expense>> {
  const { service, user } = await getExpenseService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const input = normalize(values);

  if (input.amount === undefined) {
    return { success: false, error: 'Enter an amount.' };
  }

  if (Number.isNaN(input.amount)) {
    return { success: false, error: 'Amount must be a number.' };
  }

  // vendor is sent as null rather than omitted when cleared, so emptying the
  // field erases the stored value instead of silently keeping it.
  const result = await service.update(brandId<'ExpenseId'>(id), {
    ...input,
    vendor: input.vendor ?? null,
  });

  if (!result.success) return result;

  revalidatePath(ROUTES.expenses.list);
  revalidatePath(ROUTES.dashboard.home);
  redirect(ROUTES.expenses.list);
}

/**
 * Delete an expense.
 *
 * Manager or above, and a soft delete — it stops counting against profit but
 * stays in the record. Returns rather than redirecting: this is called from a row
 * on the list, and the user stays where they are.
 */
export async function deleteExpenseAction(id: string): Promise<Result<void>> {
  const { service, user } = await getExpenseService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const result = await service.remove(brandId<'ExpenseId'>(id));
  if (!result.success) return result;

  revalidatePath(ROUTES.expenses.list);
  revalidatePath(ROUTES.dashboard.home);

  return result;
}

// ── Internals ─────────────────────────────────────────────────────────────────

/** See the note in actions/sales.ts — 'yyyy-mm-dd' must not go through UTC. */
function parseDateInput(value: string): Date {
  const [year, month, day] = value.trim().split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * PAYMENT SERVER ACTIONS
 *
 * The write surface for payments. Recording money received is the most common
 * thing staff do after a sale, so it is deliberately open to every role — the
 * same as the payments_insert_any_role RLS policy.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getPaymentService } from '@/features/payments/server';
import { requireRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import type { RecordPaymentResult } from '@/features/payments/service';
import type { Payment, PaymentMethod } from '@/features/payments/types';
import type { Result } from '@/lib/types/common';
import { brandId } from '@/lib/types/common';

/** Fields the record-payment form submits. Strings, as they arrive from inputs. */
export interface PaymentFormValues {
  customer_id: string;
  /** Raw text from a number input. */
  amount: string;
  payment_method: PaymentMethod;
  /** ISO date (yyyy-mm-dd). Blank means today. */
  payment_date?: string;
  reference_number?: string;
  notes?: string;
  /**
   * Settle this invoice first. Set when recording from an invoice screen; absent
   * when paying down the tab as a whole.
   */
  sale_id?: string;
}

/**
 * Record a payment against a customer's tab.
 *
 * Returns the result rather than redirecting: the form is rendered inline on the
 * customer detail page, and the user's next move is usually to look at the
 * updated balance right there. It also lets the UI surface creditNotice when the
 * customer paid more than they owed.
 */
export async function recordPaymentAction(
  values: PaymentFormValues
): Promise<Result<RecordPaymentResult>> {
  const { service } = await getPaymentService();

  const amount = Number(values.amount?.trim());

  if (!values.amount?.trim() || Number.isNaN(amount)) {
    return { success: false, error: 'Enter an amount.' };
  }

  const result = await service.record({
    customer_id: values.customer_id?.trim(),
    amount,
    payment_method: values.payment_method,
    payment_date: values.payment_date?.trim()
      ? parseDateInput(values.payment_date)
      : new Date(),
    reference_number: values.reference_number?.trim() || undefined,
    notes: values.notes?.trim() || undefined,
    sale_id: values.sale_id?.trim() || undefined,
  });

  if (!result.success) return result;

  // The payment moved the customer's balance and the payment_status of every
  // invoice it touched, so both the tab and the sales views are now stale. The
  // day book is stale too — this is the row that belongs at the top of it.
  revalidatePath(ROUTES.customers.list);
  revalidatePath(ROUTES.customers.detail(values.customer_id));
  revalidatePath(ROUTES.payments.list);
  revalidatePath(ROUTES.sales.list);
  revalidatePath(ROUTES.dashboard.home);

  for (const allocation of result.data.payment.allocations) {
    revalidatePath(ROUTES.sales.detail(allocation.sale_id));
  }

  return result;
}

/** Fields the payment edit form submits. */
export interface PaymentEditFormValues {
  /** Blank leaves the amount alone; a value re-runs oldest-debt-first. */
  amount?: string;
  /** ISO date (yyyy-mm-dd). Blank leaves the date alone. */
  payment_date?: string;
  payment_method?: PaymentMethod;
  reference_number?: string;
  notes?: string;
}

/**
 * Correct a payment.
 *
 * Manager or above, matching voidPaymentAction: changing what a customer is
 * recorded as having handed over moves their balance, so it sits with the other
 * corrections rather than with routine entry.
 *
 * customerId is a parameter rather than read back from the payment because it is
 * only needed to revalidate the tab the user is looking at. The service still
 * loads the payment itself and checks tenancy, so a wrong value here changes
 * which page refreshes, not which record is written.
 */
export async function updatePaymentAction(
  id: string,
  customerId: string,
  values: PaymentEditFormValues
): Promise<Result<Payment>> {
  const { service, user } = await getPaymentService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  // Blank fields are omitted rather than sent as undefined-ish values, so an edit
  // that only touches the notes does not re-run the allocation rebuild.
  const patch: Record<string, unknown> = {};

  if (values.amount?.trim()) {
    const amount = Number(values.amount.trim());

    if (Number.isNaN(amount)) {
      return { success: false, error: 'Enter a valid amount.' };
    }

    patch.amount = amount;
  }

  if (values.payment_date?.trim()) {
    patch.payment_date = parseDateInput(values.payment_date);
  }

  if (values.payment_method) patch.payment_method = values.payment_method;

  // Cleared text fields are meant to erase the stored value, so an empty string
  // becomes null rather than being dropped from the patch.
  if (values.reference_number !== undefined) {
    patch.reference_number = values.reference_number.trim() || null;
  }

  if (values.notes !== undefined) {
    patch.notes = values.notes.trim() || null;
  }

  const result = await service.update(brandId<'PaymentId'>(id), patch);
  if (!result.success) return result;

  // An amount change rebuilds this customer's allocations oldest-first, so every
  // one of their invoices can have moved — the whole sales list is revalidated
  // rather than the specific invoices this payment used to touch.
  revalidatePath(ROUTES.customers.list);
  revalidatePath(ROUTES.customers.detail(customerId));
  revalidatePath(ROUTES.payments.list);
  revalidatePath(ROUTES.sales.list);
  revalidatePath(ROUTES.dashboard.home);

  return result;
}

/**
 * Void a payment. The invoices it was covering go back to unpaid or partial and
 * the customer's balance rises again.
 *
 * Manager or above: reversing received money is a correction, not routine data
 * entry.
 */
export async function voidPaymentAction(
  id: string,
  customerId: string
): Promise<Result<void>> {
  const { service, user } = await getPaymentService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const result = await service.void(brandId<'PaymentId'>(id));
  if (!result.success) return result;

  revalidatePath(ROUTES.customers.list);
  revalidatePath(ROUTES.customers.detail(customerId));
  revalidatePath(ROUTES.payments.list);
  revalidatePath(ROUTES.sales.list);
  revalidatePath(ROUTES.dashboard.home);

  return result;
}

// ── Internals ─────────────────────────────────────────────────────────────────

/** See the note in actions/sales.ts — 'yyyy-mm-dd' must not go through UTC. */
function parseDateInput(value: string): Date {
  const [year, month, day] = value.trim().split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

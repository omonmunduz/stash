/**
 * SALE SERVER ACTIONS
 *
 * The write surface for sales. Client components call these; they never import
 * the repository or hold a Supabase client.
 *
 * Conventions match src/app/actions/customers.ts: return Result<T> rather than
 * throwing, revalidate the pages a write invalidates, and call redirect() outside
 * any try block since it throws internally.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSaleService } from '@/features/sales/server';
import { requireRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import type { Sale } from '@/features/sales/types';
import type { PaymentMethod } from '@/features/payments/types';
import type { Result } from '@/lib/types/common';
import { brandId } from '@/lib/types/common';

/** One line as the sale form submits it. Strings, as they arrive from inputs. */
export interface SaleLineValues {
  product_id: string;
  quantity: string;
  /** Blank means "use the catalog price". */
  unit_price?: string;
  discount?: string;
}

/** Fields the sale form submits. */
export interface SaleFormValues {
  customer_id: string;
  lines: SaleLineValues[];
  /** ISO date (yyyy-mm-dd) from a date input. Blank means today. */
  sale_date?: string;
  due_date?: string;
  notes?: string;
  /** What the customer handed over now. Blank or '0' means pure credit. */
  amount_paid?: string;
  payment_method?: PaymentMethod;
}

/**
 * Record a sale, then send the user to its detail page.
 *
 * Any role may record a sale. Whoever is behind the counter has to be able to
 * write down what just left the shelf, which is also what the sales_insert RLS
 * policy allows.
 */
export async function createSaleAction(values: SaleFormValues): Promise<Result<Sale>> {
  const { service } = await getSaleService();

  const parsed = parseForm(values);
  if (!parsed.success) return parsed;

  const result = await service.create(parsed.data);
  if (!result.success) return result;

  const { sale } = result.data;

  // Every one of these reads data this sale just changed: the sales list gains a
  // row, the customer's tab gains an invoice and a new balance, and stock came
  // off the products and inventory views.
  revalidatePath(ROUTES.sales.list);
  revalidatePath(ROUTES.customers.list);
  revalidatePath(ROUTES.customers.detail(sale.customer_id));
  revalidatePath(ROUTES.products.list);
  revalidatePath(ROUTES.inventory.list);
  revalidatePath(ROUTES.dashboard.home);

  redirect(ROUTES.sales.detail(sale.id));
}

/**
 * Cancel a sale: stock returns to the shelf and the customer's tab drops by
 * whatever was outstanding.
 *
 * Manager or above. Reversing a recorded transaction is not something a shift
 * employee should be able to do unsupervised, which matches
 * sales_update_scoped_by_role.
 */
export async function cancelSaleAction(id: string): Promise<Result<Sale>> {
  const { service, user } = await getSaleService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const result = await service.cancel(brandId<'SaleId'>(id));
  if (!result.success) return result;

  revalidatePath(ROUTES.sales.list);
  revalidatePath(ROUTES.sales.detail(id));
  revalidatePath(ROUTES.customers.list);
  revalidatePath(ROUTES.customers.detail(result.data.customer_id));
  revalidatePath(ROUTES.inventory.list);
  revalidatePath(ROUTES.dashboard.home);

  return result;
}

/** Update a sale's date, due date, or notes. Manager or above. */
export async function updateSaleAction(
  id: string,
  values: { sale_date?: string; due_date?: string; notes?: string }
): Promise<Result<Sale>> {
  const { service, user } = await getSaleService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const result = await service.update(brandId<'SaleId'>(id), {
    sale_date: values.sale_date ? parseDateInput(values.sale_date) : undefined,
    // Distinguishing '' from undefined matters: the first means the user cleared
    // the due date, the second means the form did not include the field.
    due_date:
      values.due_date === undefined
        ? undefined
        : values.due_date.trim()
          ? parseDateInput(values.due_date)
          : null,
    notes: values.notes === undefined ? undefined : values.notes.trim() || null,
  });

  if (!result.success) return result;

  revalidatePath(ROUTES.sales.list);
  revalidatePath(ROUTES.sales.detail(id));
  revalidatePath(ROUTES.customers.detail(result.data.customer_id));

  return result;
}

// ── Internals ─────────────────────────────────────────────────────────────────

/**
 * Turn the form's strings into the shape the service schema expects.
 *
 * Numeric fields get checked here rather than in Zod, because a blank or
 * mistyped input becomes NaN, and Zod reports NaN as "expected number" —
 * technically true and useless to someone who typed "1,5" in a quantity box.
 */
function parseForm(values: SaleFormValues): Result<{
  customer_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price?: number;
    discount?: number;
  }>;
  sale_date?: Date;
  due_date?: Date | null;
  notes?: string | null;
  amount_paid: number;
  payment_method: PaymentMethod;
}> {
  // Lines with no product picked are dropped rather than rejected. The form
  // starts with an empty row and lets the user add more, so a trailing blank row
  // is a normal state, not a mistake worth an error message.
  const filled = values.lines.filter((line) => line.product_id?.trim());

  if (filled.length === 0) {
    return { success: false, error: 'Add at least one product to the sale.' };
  }

  const items = [];

  for (const [index, line] of filled.entries()) {
    const quantity = toNumber(line.quantity);
    if (quantity === undefined || Number.isNaN(quantity)) {
      return { success: false, error: `Line ${index + 1}: enter a quantity.` };
    }
    if (quantity <= 0) {
      return { success: false, error: `Line ${index + 1}: quantity must be more than zero.` };
    }

    const unitPrice = toNumber(line.unit_price);
    if (unitPrice !== undefined && Number.isNaN(unitPrice)) {
      return { success: false, error: `Line ${index + 1}: price must be a number.` };
    }
    if (unitPrice !== undefined && unitPrice < 0) {
      return { success: false, error: `Line ${index + 1}: price cannot be negative.` };
    }

    const discount = toNumber(line.discount);
    if (discount !== undefined && Number.isNaN(discount)) {
      return { success: false, error: `Line ${index + 1}: discount must be a number.` };
    }
    if (discount !== undefined && discount < 0) {
      return { success: false, error: `Line ${index + 1}: discount cannot be negative.` };
    }

    items.push({
      product_id: line.product_id.trim(),
      quantity,
      unit_price: unitPrice,
      discount,
    });
  }

  const amountPaid = toNumber(values.amount_paid) ?? 0;
  if (Number.isNaN(amountPaid)) {
    return { success: false, error: 'Amount paid must be a number.' };
  }
  if (amountPaid < 0) {
    return { success: false, error: 'Amount paid cannot be negative.' };
  }

  return {
    success: true,
    data: {
      customer_id: values.customer_id?.trim() ?? '',
      items,
      sale_date: values.sale_date?.trim() ? parseDateInput(values.sale_date) : undefined,
      due_date: values.due_date?.trim() ? parseDateInput(values.due_date) : null,
      notes: values.notes?.trim() || null,
      amount_paid: amountPaid,
      payment_method: values.payment_method ?? 'cash',
    },
  };
}

function toNumber(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return Number(trimmed);
}

/**
 * A date input gives 'yyyy-mm-dd'. new Date() on that string parses it as UTC
 * midnight, which reads as the previous day for anyone west of UTC. Building from
 * the parts keeps the date the user actually picked.
 */
function parseDateInput(value: string): Date {
  const [year, month, day] = value.trim().split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

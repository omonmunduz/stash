/**
 * PRODUCT SERVER ACTIONS
 *
 * The write surface for the catalog. Client components call these; they never
 * import the repository or hold a Supabase client.
 *
 * Same conventions as src/app/actions/customers.ts:
 * - Return Result<T> instead of throwing, so forms can render errors inline
 * - redirect() sits outside any try block, because it throws internally
 * - revalidatePath() after every write, since the pages are Server Components
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getProductService } from '@/features/products/server';
import { requireRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import type { Product } from '@/features/products/types';
import type { Result } from '@/lib/types/common';
import { brandId } from '@/lib/types/common';
import {
  uploadFile,
  deleteFile,
  generateProductImagePath,
} from '@/lib/supabase/storage';

/** Fields the create/edit form submits. Strings, as they arrive from inputs. */
export interface ProductFormValues {
  name: string;
  /** Blank means "derive one from the name". */
  sku?: string;
  description?: string;
  category?: string;
  unit_of_measure?: string;
  /** Raw text from number inputs. */
  cost_price?: string;
  sale_price?: string;
  /** Opening stock. Blank means zero. */
  initial_quantity?: string;
  /** Optional product image file */
  image?: File | null;
}

/**
 * Normalize form strings into the shape the Zod schemas expect.
 *
 * Blank text inputs arrive as '' rather than undefined, and '' would be stored
 * as an empty string instead of null, so every blank collapses to undefined.
 * Numeric fields are converted here and NaN is reported by the caller, because
 * Zod's message for a failed number coercion is not one a shop owner can act on.
 */
function normalize(values: ProductFormValues) {
  const text = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };

  const num = (value: string | undefined) => {
    const trimmed = text(value);
    return trimmed === undefined ? undefined : Number(trimmed);
  };

  return {
    name: values.name?.trim() ?? '',
    sku: text(values.sku),
    description: text(values.description),
    category: text(values.category),
    unit_of_measure: text(values.unit_of_measure) ?? 'unit',
    cost_price: num(values.cost_price),
    sale_price: num(values.sale_price),
    initial_quantity: num(values.initial_quantity),
  };
}

/** Names of the numeric fields, for the NaN check. */
const NUMERIC_LABELS: Record<string, string> = {
  cost_price: 'Cost price',
  sale_price: 'Selling price',
  initial_quantity: 'Opening stock',
};

function firstNumericError(input: ReturnType<typeof normalize>): string | null {
  for (const key of Object.keys(NUMERIC_LABELS)) {
    const value = input[key as keyof typeof input];
    if (typeof value === 'number' && Number.isNaN(value)) {
      return `${NUMERIC_LABELS[key]} must be a number.`;
    }
  }
  return null;
}

/**
 * Create a product, then go to the catalog.
 *
 * Manager or above, matching products_insert_manager_or_above. Pricing is a
 * management decision — an employee mistyping a cost price would silently skew
 * every profit figure that follows.
 */
export async function createProductAction(
  formData: FormData
): Promise<Result<Product>> {
  const { service, user } = await getProductService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  // Extract values from FormData
  const values: ProductFormValues = {
    name: formData.get('name') as string,
    sku: formData.get('sku') as string,
    description: formData.get('description') as string,
    category: formData.get('category') as string,
    unit_of_measure: formData.get('unit_of_measure') as string,
    cost_price: formData.get('cost_price') as string,
    sale_price: formData.get('sale_price') as string,
    initial_quantity: formData.get('initial_quantity') as string,
  };

  const imageFile = formData.get('image') as File | null;

  const input = normalize(values);

  const numericError = firstNumericError(input);
  if (numericError) return { success: false, error: numericError };

  const result = await service.create(input);
  if (!result.success) return result;

  // Upload image if provided
  if (imageFile && imageFile.size > 0) {
    const imagePath = generateProductImagePath(
      user.organizationId,
      result.data.id,
      imageFile
    );

    const uploadResult = await uploadFile(
      'product-images',
      imagePath,
      imageFile,
      { upsert: true, contentType: imageFile.type }
    );

    if (uploadResult.success) {
      // Update product with image path
      await service.update(result.data.id, { image_url: imagePath });
    }
    // If upload fails, we still have the product created - don't fail the whole operation
  }

  revalidatePath(ROUTES.products.list);
  redirect(ROUTES.products.list);
}

/**
 * Update a product.
 *
 * Manager or above, matching products_update_manager_or_above.
 */
export async function updateProductAction(
  id: string,
  formData: FormData
): Promise<Result<Product>> {
  const { service, user } = await getProductService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  // Extract values from FormData
  const values: ProductFormValues = {
    name: formData.get('name') as string,
    sku: formData.get('sku') as string,
    description: formData.get('description') as string,
    category: formData.get('category') as string,
    unit_of_measure: formData.get('unit_of_measure') as string,
    cost_price: formData.get('cost_price') as string,
    sale_price: formData.get('sale_price') as string,
    initial_quantity: formData.get('initial_quantity') as string,
  };

  const imageFile = formData.get('image') as File | null;

  const input = normalize(values);

  const numericError = firstNumericError(input);
  if (numericError) return { success: false, error: numericError };

  // initial_quantity is create-only: changing stock is an inventory
  // adjustment, not a catalog edit, and silently overwriting the on-hand count
  // from an edit form would lose whatever was sold since.
  const productId = brandId<'ProductId'>(id);

  // Handle image upload if provided
  let imageUrl: string | undefined = undefined;
  if (imageFile && imageFile.size > 0) {
    const imagePath = generateProductImagePath(
      user.organizationId,
      productId,
      imageFile
    );

    const uploadResult = await uploadFile(
      'product-images',
      imagePath,
      imageFile,
      { upsert: true, contentType: imageFile.type }
    );

    if (uploadResult.success) {
      imageUrl = imagePath;
    }
  }

  const updateData = {
    name: input.name,
    sku: input.sku,
    description: input.description ?? null,
    category: input.category ?? null,
    unit_of_measure: input.unit_of_measure,
    cost_price: input.cost_price,
    sale_price: input.sale_price,
    ...(imageUrl && { image_url: imageUrl }),
  };

  const result = await service.update(productId, updateData);

  if (!result.success) return result;

  revalidatePath(ROUTES.products.list);
  redirect(ROUTES.products.list);
}

/**
 * Activate or deactivate a product.
 *
 * Deactivating keeps it out of the sale form's picker while leaving every past
 * invoice intact — the right move for a discontinued line.
 */
export async function setProductActiveAction(
  id: string,
  isActive: boolean
): Promise<Result<Product>> {
  const { service, user } = await getProductService();

  const permission = requireRole(user, 'manager');
  if (!permission.success) return permission;

  const result = await service.setActive(brandId<'ProductId'>(id), isActive);
  if (!result.success) return result;

  revalidatePath(ROUTES.products.list);
  return result;
}

/**
 * Typeahead search for the sale form's line-item picker.
 * Read-only, so no role check beyond being a signed-in org member.
 */
export async function searchProductsAction(query: string) {
  const { service } = await getProductService();
  return service.search(query);
}

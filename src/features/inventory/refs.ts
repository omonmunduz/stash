/**
 * SUBJECT REFS
 *
 * Turning a loose `(kind, id)` pair from a URL or a form into the branded
 * discriminated ref the rest of the feature takes.
 *
 * This is its own module because the conversion is where two things happen that
 * are easy to get wrong separately: the kind is validated (it arrives as an
 * arbitrary string from a route segment), and the id is branded to match the
 * branch it landed in. Building the object inline instead tends to produce
 * `{ kind, id }` with a widened `kind`, which does not narrow against the union —
 * or worse, a cast that silently allows a product id into the item branch.
 */

import { brandId } from '@/lib/types/common';
import type { InventorySubjectRef } from './types';

/** Which kind of thing a stock operation is about, as it arrives from a route param or form. */
export type SubjectKind = 'product' | 'item';

/**
 * Validate a kind that came from outside the app.
 *
 * Returns null rather than throwing so callers decide the response: a page 404s,
 * an action returns a message.
 */
export function parseSubjectKind(value: string | undefined): SubjectKind | null {
  return value === 'product' || value === 'item' ? value : null;
}

/**
 * Build the ref for a known kind.
 *
 * Written as two returns rather than one object with a computed key because that
 * is what makes each id brand to the type its own branch declares.
 */
export function toSubjectRef(kind: SubjectKind, id: string): InventorySubjectRef {
  return kind === 'product'
    ? { kind: 'product', id: brandId<'ProductId'>(id) }
    : { kind: 'item', id: brandId<'InventoryItemId'>(id) };
}

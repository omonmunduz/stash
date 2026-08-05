/**
 * QUERY LIMITS
 *
 * Upper bounds for list reads. These are safety nets, not pagination.
 *
 * Every list query in this app was previously unbounded: `SELECT ... WHERE
 * organization_id = $1` with no LIMIT. That is fine for a shop with 200
 * customers and wrong for the same shop three years later with 40,000 sales,
 * because the cost is paid three times over — Postgres sorts the whole set,
 * PostgREST serialises it to JSON, and the Server Component ships it into the
 * RSC payload the browser has to download and parse.
 *
 * The bound makes the worst case finite. It does not make the list correct at
 * scale — a business that reaches these numbers needs real pagination, and the
 * cap is deliberately set where it starts to hurt rather than where it starts to
 * matter, so hitting it is a signal rather than a silent truncation.
 *
 * Chosen per table by how the row count grows:
 * - Transactional tables (sales, payments, expenses) grow forever. The list
 *   screens filter by period and sort newest-first, so a cap here trims the
 *   oldest rows off a view nobody scrolls to.
 * - Catalogue tables (customers, products, inventory items) grow with the size
 *   of the business, not with time. A small wholesaler reaching 2,000 customers
 *   is a real business with a real pagination requirement.
 */

/**
 * Transactional list reads: sales, payments, expenses.
 *
 * 500 rows is roughly two years of daily sales for a shop doing one invoice a
 * day, and about six weeks for one doing a dozen. Both are far past what anyone
 * scrolls through on a phone.
 */
export const TRANSACTION_LIST_LIMIT = 500;

/**
 * Catalogue list reads: customers, products, inventory items and stock lines.
 *
 * Higher than the transactional cap because these lists are the ones users
 * genuinely scan end to end, and because they are the source for on-page search
 * and filtering — see the note in inventory's findAll, where low-stock filtering
 * happens in application code and therefore only sees rows the cap let through.
 */
export const CATALOGUE_LIST_LIMIT = 2000;

/**
 * Id-to-name lookups that back a `Map` rather than a rendered list.
 *
 * Deliberately far higher than the list caps, because a miss here is not a
 * shorter list — it is a row that renders as "Unknown customer" next to a real
 * invoice. Truncating a list the user was going to scroll past is invisible;
 * truncating a lookup is a visible data bug.
 *
 * It is affordable at this size because the projection is three small columns
 * and nothing is rendered per row: 10,000 names is a few hundred kilobytes of
 * JSON, against roughly six times that for the same rows at full width.
 *
 * The bound exists so a runaway query cannot pull an unbounded set into memory,
 * not because 10,000 is a sensible number of names to ship. An organization
 * approaching it needs the lookup narrowed to the ids actually on the page,
 * which costs a round trip the current parallel fetch avoids.
 */
export const NAME_LOOKUP_LIMIT = 10_000;

/**
 * ADJUST STOCK PAGE
 *
 * One screen for both products and non-sellable items, keyed on the [kind]
 * segment. The alternative — a route under each catalogue — would have meant two
 * copies of a form whose only difference is which table the id points at, and the
 * database already treats them as one thing: inventory rows carry either a
 * product_id or an item_id and are otherwise identical.
 *
 * Guarded at manager and above to match adjust_inventory and set_inventory_count,
 * which both check the role themselves. The guard here exists so an employee gets
 * redirected instead of filling in a form that would be refused on submit.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdjustStockForm } from '@/features/inventory/components/AdjustStockForm';
import { AdjustmentHistory } from '@/features/inventory/components/AdjustmentHistory';
import { getInventoryService } from '@/features/inventory/server';
import { parseSubjectKind, toSubjectRef } from '@/features/inventory/refs';
import { requireMinimumRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { formatQuantity, formatMoney } from '@/lib/utils/format';

export const metadata = {
  title: 'Adjust stock',
};

/** How many past movements to show. Enough to reconcile a delivery, not a ledger. */
const HISTORY_LIMIT = 15;

interface AdjustStockPageProps {
  params: Promise<{ kind: string; id: string }>;
}

export default async function AdjustStockPage({ params }: AdjustStockPageProps) {
  const { kind: rawKind, id } = await params;

  // The segment is user-controlled, so it is validated rather than cast. Anything
  // else is a 404 — an unrecognised value would otherwise reach the RPC as a pair
  // of nulls and come back as "exactly one product or one item", which tells
  // nobody anything.
  const kind = parseSubjectKind(rawKind);
  if (!kind) notFound();

  await requireMinimumRole('manager');

  const { service } = await getInventoryService();

  const ref = toSubjectRef(kind, id);
  const [stock, history] = await Promise.all([
    service.getBySubject(ref),
    service.listAdjustments(ref, HISTORY_LIMIT),
  ]);

  // No stock row means no such product or item in this organization — the query is
  // already scoped to it, so a wrong id and someone else's id look the same here.
  if (!stock.success) notFound();

  const line = stock.data;
  const backHref =
    kind === 'product' ? ROUTES.products.list : ROUTES.inventory.items.list;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.inventory.list}>
          <ArrowLeft aria-hidden="true" />
          Stock
        </Link>
      </Button>

      <PageHeader
        title={line.subject.name}
        description={line.subject.code}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>
              {kind === 'product' ? 'Products' : 'Supplies'}
            </Link>
          </Button>
        }
      />

      {/* Current figure, stated plainly and once. Every quantity below is relative
          to this, so it reads before the form rather than inside it. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border bg-muted/40 p-4">
        <span className="text-2xl font-semibold tabular-nums">
          {formatQuantity(line.quantity_on_hand)}
        </span>
        <span className="text-sm text-muted-foreground">
          {line.unit_of_measure} on hand
        </span>
        {line.is_low_stock && (
          <Badge variant="warning" className="ml-auto">
            {line.quantity_on_hand <= 0 ? 'Out of stock' : 'Low stock'}
          </Badge>
        )}
        <span className="w-full text-xs text-muted-foreground">
          Worth {formatMoney(line.stock_value)} at cost
          {line.reorder_level !== null &&
            ` · reorder at ${formatQuantity(line.reorder_level)}`}
        </span>
      </div>

      {!line.is_active && (
        <Alert>
          <AlertDescription>
            This {kind === 'product' ? 'product' : 'item'} is inactive. Stock can
            still be corrected, but it will not appear when recording a sale.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <AdjustStockForm
            kind={kind}
            id={id}
            name={line.subject.name}
            unitOfMeasure={line.unit_of_measure}
            quantityOnHand={line.quantity_on_hand}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent changes</CardTitle>
        </CardHeader>
        <CardContent>
          {history.success ? (
            <AdjustmentHistory
              adjustments={history.data}
              unitOfMeasure={line.unit_of_measure}
            />
          ) : (
            // A failed history read does not block the form: correcting stock is
            // the reason for being here, and the log is context.
            <p className="text-sm text-muted-foreground">{history.error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

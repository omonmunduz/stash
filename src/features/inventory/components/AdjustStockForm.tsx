/**
 * ADJUST STOCK FORM
 *
 * Two modes over one subject, because there are two genuinely different things a
 * person means when they change a stock figure:
 *
 * - "Something moved": a delivery arrived, a box was dropped, a customer brought
 *   goods back. That is a signed delta against whatever is on the shelf now.
 * - "The number is wrong": a physical count says 38. That is an absolute figure,
 *   and the delta has to be derived from the current quantity at the moment of
 *   writing — which is why it goes through set_inventory_count and not this
 *   form's arithmetic. Computing the difference here would silently discard
 *   anything sold between loading the page and pressing save.
 *
 * Quantity is entered unsigned with a separate in/out toggle. A minus sign typed
 * into a number field is easy to fumble and hard to read back with confidence,
 * and the toggle also lets the reason preselect a sensible direction — nobody
 * picking "Damaged or expired" means stock arrived.
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { adjustStockAction, setCountAction } from '@/app/actions/inventory';
import type { SubjectKind } from '@/app/actions/inventory';
import type { InventoryAdjustmentReason } from '../types';
import {
  ADJUSTMENT_REASON_LABELS,
  SELECTABLE_ADJUSTMENT_REASONS,
  REASON_DEFAULT_DIRECTION,
} from '../labels';
import { ROUTES } from '@/lib/constants/routes';
import { formatQuantity } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

type Mode = 'move' | 'recount';

interface AdjustStockFormProps {
  kind: SubjectKind;
  id: string;
  name: string;
  unitOfMeasure: string;
  /** What is recorded right now, for the preview and the recount placeholder. */
  quantityOnHand: number;
}

export function AdjustStockForm({
  kind,
  id,
  name,
  unitOfMeasure,
  quantityOnHand,
}: AdjustStockFormProps) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('move');
  const [quantity, setQuantity] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [reason, setReason] = useState<InventoryAdjustmentReason>('purchase');
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Picking a reason also sets the direction it usually implies. Kept as a plain
   * handler rather than an effect so a deliberate override is not immediately
   * undone by a re-render.
   */
  const chooseReason = (next: InventoryAdjustmentReason) => {
    setReason(next);
    setDirection(REASON_DEFAULT_DIRECTION[next]);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result =
        mode === 'move'
          ? await adjustStockAction({
              kind,
              id,
              quantity,
              direction,
              reason,
              notes,
            })
          : await setCountAction({ kind, id, counted, notes });

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Neither action redirects — staying here is deliberate. Correcting stock
      // is often several movements in a row (a delivery of four different
      // things), and bouncing to the list after each one costs a navigation
      // every time. The revalidated quantity above the form is the confirmation.
      setQuantity('');
      setCounted('');
      setNotes('');
      router.refresh();
    });
  };

  // Preview of where the shelf lands, shown while typing because the figure being
  // committed is the one worth checking before pressing save.
  const typedQuantity = Number(quantity);
  const showsPreview =
    mode === 'move' &&
    quantity !== '' &&
    Number.isFinite(typedQuantity) &&
    typedQuantity > 0;
  const projected =
    quantityOnHand + (direction === 'out' ? -typedQuantity : typedQuantity);

  const notesRequired = mode === 'move' && reason === 'other';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Mode switch. A radio group because the two are exclusive, and because
          arrow-key navigation between them comes free with the role. */}
      <div
        role="radiogroup"
        aria-label="What kind of change is this?"
        className="grid gap-2 sm:grid-cols-2"
      >
        <ModeOption
          checked={mode === 'move'}
          onSelect={() => setMode('move')}
          disabled={isPending}
          title="Stock moved"
          description="A delivery came in, or goods were damaged, lost, or returned."
        />
        <ModeOption
          checked={mode === 'recount'}
          onSelect={() => setMode('recount')}
          disabled={isPending}
          title="I counted it"
          description="Correct the figure to what is physically on the shelf."
        />
      </div>

      {mode === 'move' ? (
        <fieldset className="space-y-4" disabled={isPending}>
          <legend className="sr-only">Stock movement</legend>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Why <span aria-hidden="true">*</span>
            </Label>
            {/*
              Native select: the project has no select primitive, and on a phone
              this opens the OS picker, which is a better control than anything
              hand-rolled. Same reasoning as ProductPicker.
            */}
            <select
              id="reason"
              value={reason}
              onChange={(event) =>
                chooseReason(event.target.value as InventoryAdjustmentReason)
              }
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {SELECTABLE_ADJUSTMENT_REASONS.map((value) => (
                <option key={value} value={value}>
                  {ADJUSTMENT_REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                How much <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                In {unitOfMeasure}. Enter a positive number.
              </p>
            </div>

            <div className="space-y-2">
              <span id="direction-label" className="text-sm font-medium">
                Direction
              </span>
              <div
                role="radiogroup"
                aria-labelledby="direction-label"
                className="flex gap-2"
              >
                <DirectionOption
                  checked={direction === 'in'}
                  onSelect={() => setDirection('in')}
                  label="Came in"
                />
                <DirectionOption
                  checked={direction === 'out'}
                  onSelect={() => setDirection('out')}
                  label="Went out"
                />
              </div>
              {showsPreview && (
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {formatQuantity(quantityOnHand)} →{' '}
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      projected < 0 ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {formatQuantity(projected)}
                  </span>{' '}
                  {unitOfMeasure}
                  {projected < 0 && ' — more than you have'}
                </p>
              )}
            </div>
          </div>
        </fieldset>
      ) : (
        <fieldset className="space-y-4" disabled={isPending}>
          <legend className="sr-only">Counted quantity</legend>

          <div className="space-y-2">
            <Label htmlFor="counted">
              How many are actually there? <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="counted"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              value={counted}
              onChange={(event) => setCounted(event.target.value)}
              placeholder={formatQuantity(quantityOnHand)}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Recorded as {formatQuantity(quantityOnHand)} {unitOfMeasure}. The
              difference is logged as a count correction.
            </p>
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-2" disabled={isPending}>
        <Label htmlFor="notes">
          Note{' '}
          {notesRequired ? (
            <span aria-hidden="true">*</span>
          ) : (
            <span className="font-normal text-muted-foreground">(optional)</span>
          )}
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={500}
          rows={2}
          required={notesRequired}
          placeholder={
            mode === 'recount'
              ? 'e.g., Monthly count'
              : 'e.g., Two boxes crushed in transit'
          }
        />
        {notesRequired && (
          <p className="text-xs text-muted-foreground">
            Required when the reason is &ldquo;Other&rdquo; — otherwise the history
            will not say what happened.
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" disabled={isPending} className="sm:w-auto">
          {isPending ? 'Saving...' : mode === 'move' ? 'Record change' : 'Correct count'}
        </Button>
        <Button asChild variant="outline" disabled={isPending} className="sm:w-auto">
          <Link href={ROUTES.inventory.list}>Done</Link>
        </Button>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {isPending ? `Saving stock change for ${name}` : ''}
      </p>
    </form>
  );
}

/** One of the two mode cards. */
function ModeOption({
  checked,
  onSelect,
  disabled,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-primary bg-accent' : 'border-border hover:bg-accent'
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

/** In or out. */
function DirectionOption({
  checked,
  onSelect,
  label,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'h-11 flex-1 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background hover:bg-accent'
      )}
    >
      {label}
    </button>
  );
}

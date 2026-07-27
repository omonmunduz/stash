/**
 * CUSTOMER FORM
 *
 * One component for both create and edit — the two differ only in which action
 * they call and what the submit button says, so splitting them would duplicate
 * eight fields for no benefit.
 *
 * Design decisions:
 * - Name is the only required field. The target user is often entering a
 *   customer mid-conversation; demanding an address would mean either a blocked
 *   save or a fake one.
 * - Contact details and credit terms are grouped separately, because "who is
 *   this" and "how much can they owe" are different decisions.
 * - On success the action redirects, so this component has no success state.
 *   The pending flag stays true through the navigation, which keeps the button
 *   disabled and prevents a double submit.
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createCustomerAction, updateCustomerAction } from '@/app/actions/customers';
import type { CustomerFormValues } from '@/app/actions/customers';
import type { Customer } from '../types';
import { ROUTES } from '@/lib/constants/routes';

interface CustomerFormProps {
  /** Present when editing; absent when creating. */
  customer?: Customer;
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const isEdit = customer !== undefined;

  const [values, setValues] = useState<CustomerFormValues>({
    name: customer?.name ?? '',
    business_name: customer?.business_name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    address: customer?.address ?? '',
    city: customer?.city ?? '',
    // Number inputs need a string; a null limit shows as blank, which is also
    // how the user clears it.
    credit_limit: customer?.credit_limit != null ? String(customer.credit_limit) : '',
    notes: customer?.notes ?? '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (field: keyof CustomerFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateCustomerAction(customer.id, values)
        : await createCustomerAction(values);

      // Only reached on failure — both actions redirect when they succeed.
      if (!result.success) setError(result.error);
    });
  };

  const cancelHref = isEdit ? ROUTES.customers.detail(customer.id) : ROUTES.customers.list;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">Who they are</legend>

        <div className="space-y-2">
          <Label htmlFor="name">
            Name <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={set('name')}
            placeholder="e.g., Ahmed Hassan"
            required
            minLength={2}
            maxLength={100}
            autoFocus={!isEdit}
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_name">Shop or business name</Label>
          <Input
            id="business_name"
            value={values.business_name}
            onChange={set('business_name')}
            placeholder="e.g., Ahmed's Grocery"
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground">
            Shown instead of their personal name where space is tight.
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">How to reach them</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              value={values.phone}
              onChange={set('phone')}
              placeholder="0700 123 456"
              maxLength={30}
              autoComplete="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={set('email')}
              placeholder="name@example.com"
              maxLength={255}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={values.address}
            onChange={set('address')}
            placeholder="Street and number"
            maxLength={255}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={values.city}
            onChange={set('city')}
            maxLength={100}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">Credit terms</legend>

        <div className="space-y-2">
          <Label htmlFor="credit_limit">Credit limit</Label>
          <Input
            id="credit_limit"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={values.credit_limit}
            onChange={set('credit_limit')}
            placeholder="Leave blank for no limit"
          />
          <p className="text-xs text-muted-foreground">
            The most this customer may owe at one time. Leave blank to allow any
            amount — you will still see what they owe.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={values.notes}
            onChange={set('notes')}
            placeholder="Anything worth remembering — delivery days, who to ask for, payment habits."
            maxLength={1000}
            rows={3}
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" disabled={isPending} className="sm:w-auto">
          {isPending
            ? isEdit
              ? 'Saving...'
              : 'Adding...'
            : isEdit
              ? 'Save changes'
              : 'Add customer'}
        </Button>
        <Button asChild variant="outline" disabled={isPending} className="sm:w-auto">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

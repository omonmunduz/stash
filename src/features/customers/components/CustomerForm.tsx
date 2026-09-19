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
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('customers.form');
  const tActions = useTranslations('common.actions');
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
        <legend className="text-sm font-medium">{t('sectionWhoTheyAre')}</legend>

        <div className="space-y-2">
          <Label htmlFor="name">
            {t('name')} <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={set('name')}
            placeholder={t('namePlaceholder')}
            required
            minLength={2}
            maxLength={100}
            autoFocus={!isEdit}
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_name">{t('businessName')}</Label>
          <Input
            id="business_name"
            value={values.business_name}
            onChange={set('business_name')}
            placeholder={t('businessNamePlaceholder')}
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground">
            {t('businessNameHelp')}
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">{t('sectionHowToReach')}</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">{t('phone')}</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              value={values.phone}
              onChange={set('phone')}
              placeholder={t('phonePlaceholder')}
              maxLength={30}
              autoComplete="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={set('email')}
              placeholder={t('emailPlaceholder')}
              maxLength={255}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">{t('address')}</Label>
          <Input
            id="address"
            value={values.address}
            onChange={set('address')}
            placeholder={t('addressPlaceholder')}
            maxLength={255}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">{t('city')}</Label>
          <Input
            id="city"
            value={values.city}
            onChange={set('city')}
            maxLength={100}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-medium">{t('sectionCreditTerms')}</legend>

        <div className="space-y-2">
          <Label htmlFor="credit_limit">{t('creditLimit')}</Label>
          <Input
            id="credit_limit"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={values.credit_limit}
            onChange={set('credit_limit')}
            placeholder={t('creditLimitPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('creditLimitHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{t('notes')}</Label>
          <Textarea
            id="notes"
            value={values.notes}
            onChange={set('notes')}
            placeholder={t('notesPlaceholder')}
            maxLength={1000}
            rows={3}
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" disabled={isPending} className="sm:w-auto">
          {isPending
            ? isEdit
              ? t('saving')
              : t('adding')
            : isEdit
              ? t('saveChanges')
              : t('addCustomerButton')}
        </Button>
        <Button asChild variant="outline" disabled={isPending} className="sm:w-auto">
          <Link href={cancelHref}>{tActions('cancel')}</Link>
        </Button>
      </div>
    </form>
  );
}

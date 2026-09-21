/**
 * EMPLOYEE FORM
 *
 * One component for create and edit. The form handles:
 * - Display name (required)
 * - Slug (auto-generated from name if not provided)
 * - Bio
 * - Photo URL
 * - Active status
 */

'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { createEmployeeAction, updateEmployeeAction } from '@/app/actions/employees';
import type { EmployeeFormValues } from '@/app/actions/employees';
import type { Employee } from '../types';

interface EmployeeFormProps {
  employee?: Employee;
}

export function EmployeeForm({ employee }: EmployeeFormProps) {
  const t = useTranslations('employees.form');
  const tCommon = useTranslations('common.actions');
  const isEdit = employee !== undefined;

  const [values, setValues] = useState<EmployeeFormValues>({
    display_name: employee?.display_name ?? '',
    slug: employee?.slug ?? '',
    bio: employee?.bio ?? '',
    photo_url: employee?.photo_url ?? '',
    is_active: employee?.is_active ?? true,
    create_user_account: false,
    email: '',
    password: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (field: keyof EmployeeFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateEmployeeAction(employee.id, values)
        : await createEmployeeAction(values);

      if (!result.success) setError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-4" disabled={isPending}>
        <div className="space-y-2">
          <Label htmlFor="display_name">
            {t('displayName')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="display_name"
            value={values.display_name}
            onChange={set('display_name')}
            placeholder={t('displayNamePlaceholder')}
            required
          />
          <p className="text-xs text-muted-foreground">
            {t('displayNameHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">{t('slug')}</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/</span>
            <Input
              id="slug"
              value={values.slug}
              onChange={set('slug')}
              placeholder={t('slugPlaceholder')}
              pattern="[a-z0-9\-]+"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isEdit ? t('slugHelpEdit') : t('slugHelpCreate')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">{t('bio')}</Label>
          <Textarea
            id="bio"
            value={values.bio}
            onChange={set('bio')}
            placeholder={t('bioPlaceholder')}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {t('bioHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="photo_url">{t('photoUrl')}</Label>
          <Input
            id="photo_url"
            type="url"
            value={values.photo_url}
            onChange={set('photo_url')}
            placeholder={t('photoUrlPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('photoUrlHelp')}
          </p>
        </div>

        {!isEdit && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="create_user_account"
                checked={values.create_user_account}
                onCheckedChange={(checked) =>
                  setValues((prev) => ({ ...prev, create_user_account: checked === true }))
                }
              />
              <Label htmlFor="create_user_account" className="cursor-pointer font-normal">
                {t('createUserAccount')}
              </Label>
            </div>

            {values.create_user_account && (
              <div className="space-y-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {t('email')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={values.email}
                    onChange={set('email')}
                    placeholder={t('emailPlaceholder')}
                    required={values.create_user_account}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('emailHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    {t('password')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={values.password}
                    onChange={set('password')}
                    placeholder={t('passwordPlaceholder')}
                    required={values.create_user_account}
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('passwordHelp')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {isEdit && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={values.is_active}
              onCheckedChange={(checked) =>
                setValues((prev) => ({ ...prev, is_active: checked === true }))
              }
            />
            <Label htmlFor="is_active" className="cursor-pointer font-normal">
              {t('active')}
            </Label>
          </div>
        )}
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon('saving') : isEdit ? tCommon('saveChanges') : t('createEmployee')}
        </Button>
      </div>
    </form>
  );
}

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
            Display name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="display_name"
            value={values.display_name}
            onChange={set('display_name')}
            placeholder="Jane Smith"
            required
          />
          <p className="text-xs text-muted-foreground">
            Name shown to customers in bookings
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">URL slug</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/</span>
            <Input
              id="slug"
              value={values.slug}
              onChange={set('slug')}
              placeholder="jane-smith"
              pattern="[a-z0-9\-]+"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? 'Changing this breaks existing booking links'
              : 'Auto-generated from name if left blank'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={values.bio}
            onChange={set('bio')}
            placeholder="Senior stylist with 10 years experience"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Shown on the public booking page
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="photo_url">Photo URL</Label>
          <Input
            id="photo_url"
            type="url"
            value={values.photo_url}
            onChange={set('photo_url')}
            placeholder="https://example.com/photo.jpg"
          />
          <p className="text-xs text-muted-foreground">
            Optional. Shows on booking page and appointment list.
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
                Create user account for this employee
              </Label>
            </div>

            {values.create_user_account && (
              <div className="space-y-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={values.email}
                    onChange={set('email')}
                    placeholder="employee@example.com"
                    required={values.create_user_account}
                  />
                  <p className="text-xs text-muted-foreground">
                    Employee will use this email to sign in
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={values.password}
                    onChange={set('password')}
                    placeholder="Minimum 8 characters"
                    required={values.create_user_account}
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Set an initial password for the employee
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
              Active (can take appointments)
            </Label>
          </div>
        )}
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isEdit ? 'Save changes' : 'Create employee'}
        </Button>
      </div>
    </form>
  );
}

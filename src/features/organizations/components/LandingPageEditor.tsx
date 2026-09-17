/**
 * LANDING PAGE EDITOR COMPONENT
 *
 * Form to edit organization landing page content and toggle visibility
 * of services and products.
 */

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  updateLandingPageAction,
  toggleServiceVisibilityAction,
  toggleProductVisibilityAction,
} from '@/app/actions/landing-page';
import type { OrganizationId } from '@/lib/types/common';
import type { ServiceId } from '@/features/services/types';
import type { ProductId } from '@/lib/types/common';

interface LandingPageEditorProps {
  organization: {
    id: OrganizationId;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
    hero_image_url: string | null;
  };
  services: Array<{
    id: ServiceId;
    name: string;
    visible_on_landing_page: boolean | null;
    is_active: boolean | null;
  }>;
  products: Array<{
    id: ProductId;
    name: string;
    visible_on_landing_page: boolean | null;
    is_active: boolean | null;
  }>;
}

export function LandingPageEditor({ organization, services, products }: LandingPageEditorProps) {
  const [values, setValues] = useState({
    description: organization.description ?? '',
    logo_url: organization.logo_url ?? '',
    hero_image_url: organization.hero_image_url ?? '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (field: keyof typeof values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setValues((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateLandingPageAction(organization.id, values);
      if (!result.success) setError(result.error);
      // On success, page revalidates automatically
    });
  };

  const handleToggleService = (serviceId: ServiceId, visible: boolean) => {
    startTransition(async () => {
      await toggleServiceVisibilityAction(serviceId, visible);
    });
  };

  const handleToggleProduct = (productId: ProductId, visible: boolean) => {
    startTransition(async () => {
      await toggleProductVisibilityAction(productId, visible);
    });
  };

  const activeServices = services.filter((s) => s.is_active);
  const activeProducts = products.filter((p) => p.is_active);

  return (
    <div className="space-y-6">
      {/* Organization Content */}
      <Card>
        <CardHeader>
          <CardTitle>Landing Page Content</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <fieldset className="space-y-4" disabled={isPending}>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={values.description}
                  onChange={set('description')}
                  placeholder="Tell customers about your business"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Shown below your business name on the landing page
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  type="url"
                  value={values.logo_url}
                  onChange={set('logo_url')}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Shown next to your business name
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hero_image_url">Hero Image URL</Label>
                <Input
                  id="hero_image_url"
                  type="url"
                  value={values.hero_image_url}
                  onChange={set('hero_image_url')}
                  placeholder="https://example.com/hero.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Banner image shown at the top of your landing page
                </p>
              </div>
            </fieldset>

            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Services Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
        </CardHeader>
        <CardContent>
          {activeServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active services to display. Add services first.
            </p>
          ) : (
            <div className="space-y-3">
              {activeServices.map((service) => (
                <div key={service.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`service-${service.id}`}
                    checked={service.visible_on_landing_page ?? true}
                    onCheckedChange={(checked) =>
                      handleToggleService(service.id, checked === true)
                    }
                    disabled={isPending}
                  />
                  <Label
                    htmlFor={`service-${service.id}`}
                    className="cursor-pointer font-normal"
                  >
                    {service.name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          {activeProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active products to display. Add products first.
            </p>
          ) : (
            <div className="space-y-3">
              {activeProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`product-${product.id}`}
                    checked={product.visible_on_landing_page ?? true}
                    onCheckedChange={(checked) =>
                      handleToggleProduct(product.id, checked === true)
                    }
                    disabled={isPending}
                  />
                  <Label
                    htmlFor={`product-${product.id}`}
                    className="cursor-pointer font-normal"
                  >
                    {product.name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

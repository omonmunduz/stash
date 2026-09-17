/**
 * SERVICE LIST
 *
 * Displays services with name, duration, price.
 * Matches the pattern from ProductList.
 */

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Service } from '../types';
import { ROUTES } from '@/lib/constants/routes';
import { formatMoney } from '@/lib/utils/format';

export function ServiceList({ services }: { services: Service[] }) {
  return (
    <>
      {/* Phone layout */}
      <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
        {services.map((service) => (
          <li key={service.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={ROUTES.services.edit(service.id)}
                    className="truncate font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {service.name}
                  </Link>
                  {!service.is_active && (
                    <Badge variant="secondary" className="shrink-0">
                      Inactive
                    </Badge>
                  )}
                </div>
                {service.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {service.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {service.duration_minutes} minutes
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="font-medium tabular-nums">
                  {formatMoney(service.price)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and up */}
      <div className="hidden rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <Link
                    href={ROUTES.services.edit(service.id)}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {service.name}
                  </Link>
                  {service.description && (
                    <p className="text-xs text-muted-foreground">{service.description}</p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {service.duration_minutes} min
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(service.price)}
                </TableCell>
                <TableCell>
                  {service.is_active ? (
                    <Badge variant="outline" className="text-green-600">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

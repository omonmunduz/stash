/**
 * EMPLOYEE LIST
 *
 * Displays employees with their photo, name, bio, and status.
 * Matches the pattern from CustomerList and ProductList.
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
import type { Employee } from '../types';
import { ROUTES } from '@/lib/constants/routes';
import { User } from 'lucide-react';

export function EmployeeList({ employees }: { employees: Employee[] }) {
  return (
    <>
      {/* Phone layout */}
      <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
        {employees.map((employee) => (
          <li key={employee.id} className="px-4 py-3">
            <Link
              href={ROUTES.employees.detail(employee.id)}
              className="flex items-start gap-3 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                {employee.photo_url ? (
                  <img
                    src={employee.photo_url}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <User className="size-5 text-muted-foreground" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{employee.display_name}</span>
                  {!employee.is_active && (
                    <Badge variant="secondary" className="shrink-0">
                      Inactive
                    </Badge>
                  )}
                </div>
                {employee.bio && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {employee.bio}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">/{employee.slug}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet and up */}
      <div className="hidden rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <Link
                    href={ROUTES.employees.detail(employee.id)}
                    className="flex items-center gap-3 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                      {employee.photo_url ? (
                        <img
                          src={employee.photo_url}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <User className="size-4 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                    {employee.display_name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  /{employee.slug}
                </TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">
                  <p className="line-clamp-2">{employee.bio ?? '—'}</p>
                </TableCell>
                <TableCell>
                  {employee.is_active ? (
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

/**
 * EDIT EXPENSE PAGE
 *
 * Guarded at manager and above, matching expenses_update_manager_or_above and the
 * requireRole check inside updateExpenseAction. An expense is a number that comes
 * straight off profit, so changing one after the fact is a supervised correction
 * rather than routine entry — the same split as payments.
 *
 * The guard runs before the read. Loading the record first and then redirecting
 * would tell an employee the expense exists and what it was for, which is the
 * information the policy is there to withhold.
 *
 * notFound() rather than an error banner when the read fails: service.getById
 * returns the same "not found" for a missing row and for one belonging to another
 * organization, and a 404 is the honest response to both.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExpenseForm } from '@/features/expenses/components/ExpenseForm';
import { getExpenseService } from '@/features/expenses/server';
import { requireMinimumRole } from '@/features/auth/guards';
import { ROUTES } from '@/lib/constants/routes';
import { brandId } from '@/lib/types/common';

export const metadata = {
  title: 'Edit expense',
};

interface EditExpensePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const { id } = await params;

  await requireMinimumRole('manager');

  const { service } = await getExpenseService();
  const result = await service.getById(brandId<'ExpenseId'>(id));

  if (!result.success) notFound();

  const expense = result.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.expenses.list}>
          <ArrowLeft aria-hidden="true" />
          Expenses
        </Link>
      </Button>

      <PageHeader title="Edit expense" description={expense.expense_number} />

      <Card>
        <CardContent className="pt-6">
          <ExpenseForm expense={expense} />
        </CardContent>
      </Card>
    </div>
  );
}

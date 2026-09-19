/**
 * RECORD EXPENSE PAGE
 *
 * Open to every role, matching expenses_insert_any_role and the absence of a guard
 * in createExpenseAction. An employee sent out for packing tape has to be able to
 * log what it cost — making them find a manager first is how costs end up on the
 * back of a receipt instead of in the books. Correcting one afterwards is the
 * supervised operation, and that guard lives on the edit page.
 *
 * No customer picker, no stock lookup, nothing to load: an expense stands on its
 * own. So unlike the record-payment page there is no query here and no empty state
 * to fall back to — the form is the whole page.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExpenseForm } from '@/features/expenses/components/ExpenseForm';
import { ROUTES } from '@/lib/constants/routes';

export const metadata = {
  title: 'Record expense',
};

export default async function NewExpensePage() {
  const t = await getTranslations('expenses.new');

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={ROUTES.expenses.list}>
          <ArrowLeft aria-hidden="true" />
          {t('backToExpenses')}
        </Link>
      </Button>

      <PageHeader
        title={t('title')}
        description={t('description')}
      />

      <Card>
        <CardContent className="pt-6">
          <ExpenseForm />
        </CardContent>
      </Card>
    </div>
  );
}

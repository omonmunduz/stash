/**
 * PAYMENT SERVICE FACTORY (server-only)
 *
 * Wires the Supabase client, repositories, and service for the current request.
 */

import { createClient } from '@/lib/supabase/server';
import { requireActiveUser } from '@/features/auth/guards';
import { SupabasePaymentRepository } from './repository';
import { SupabaseCustomerRepository } from '@/features/customers/repository';
import { SupabaseSaleRepository } from '@/features/sales/repository';
import { PaymentService } from './service';
import type { AuthUser } from '@/features/auth/types';

/**
 * Build a payment service scoped to the signed-in user's organization.
 */
export async function getPaymentService(): Promise<{
  service: PaymentService;
  user: AuthUser;
}> {
  const user = await requireActiveUser();
  const supabase = await createClient();

  return {
    service: new PaymentService(
      new SupabasePaymentRepository(supabase),
      new SupabaseCustomerRepository(supabase),
      new SupabaseSaleRepository(supabase),
      user.organizationId
    ),
    user,
  };
}

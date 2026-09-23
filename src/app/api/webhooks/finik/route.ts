/**
 * FINIK WEBHOOK ENDPOINT
 *
 * Public endpoint for Finik payment gateway callbacks.
 *
 * Flow:
 * 1. Verify webhook signature (CRITICAL for security)
 * 2. Log raw event to webhook_events table
 * 3. Find invoice by gateway_request_id
 * 4. Validate amount matches
 * 5. Process payment based on status
 * 6. Return 200 quickly (< 5 seconds)
 *
 * Security:
 * - Always verify signature before processing
 * - Idempotent: repeated webhooks for same payment are safe
 * - Never trust redirect/success page as payment proof
 * - Rate limiting handled by Vercel/platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/admin';
import { getPaymentGateway } from '@/features/billing/payment-gateway';
import * as billingRepo from '@/features/billing/repository';

interface FinikWebhookPayload {
  request_id?: string;          // Our gateway_request_id
  transaction_id?: string;      // Finik's transaction ID
  status?: string;              // 'SUCCEEDED' | 'FAILED' | 'PENDING'
  amount?: number;
  currency?: string;
  paid_at?: string;
  error_message?: string;
  custom_fields?: Record<string, string>;
  [key: string]: any;           // Other fields we might not know about
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Parse request
    const signature = request.headers.get('x-signature') || '';
    const rawBody = await request.text();
    let payload: FinikWebhookPayload;

    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error('[Webhook] Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    console.log('[Webhook] Received:', {
      request_id: payload.request_id,
      status: payload.status,
      amount: payload.amount,
    });

    // 2. Verify signature (CRITICAL)
    const gateway = getPaymentGateway();
    const verification = await gateway.verifyWebhook({
      signature,
      payload: rawBody,
      headers: Object.fromEntries(request.headers.entries()),
    });

    // 3. Store raw webhook event (regardless of validity)
    const webhookEvent = await billingRepo.createWebhookEvent({
      provider: 'finik',
      event_type: payload.status || null,
      gateway_request_id: payload.request_id || null,
      signature,
      signature_valid: verification.valid,
      raw_payload: payload,
      processed: false,
      processed_at: null,
      error_message: null,
    });

    // 4. Reject if signature invalid
    if (!verification.valid) {
      console.error('[Webhook] Invalid signature:', verification.error);
      await billingRepo.updateWebhookEvent(webhookEvent.id, {
        error_message: `Invalid signature: ${verification.error}`,
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 5. Find invoice by request_id
    if (!payload.request_id) {
      const error = 'Missing request_id in payload';
      console.error('[Webhook]', error);
      await billingRepo.updateWebhookEvent(webhookEvent.id, {
        error_message: error,
      });
      return NextResponse.json({ error }, { status: 400 });
    }

    const invoice = await billingRepo.getInvoiceByGatewayRequestId(payload.request_id);

    if (!invoice) {
      const error = `Invoice not found for request_id: ${payload.request_id}`;
      console.error('[Webhook]', error);
      await billingRepo.updateWebhookEvent(webhookEvent.id, {
        error_message: error,
      });
      // Return 200 anyway - not our problem if they send invalid request_id
      return NextResponse.json({ received: true });
    }

    // 6. Check if already processed (idempotency)
    if (invoice.status === 'paid') {
      console.log('[Webhook] Invoice already paid, skipping');
      await billingRepo.updateWebhookEvent(webhookEvent.id, {
        processed: true,
        processed_at: new Date(),
      });
      return NextResponse.json({ received: true, already_processed: true });
    }

    // 7. Validate amount matches (if provided)
    if (payload.amount !== undefined) {
      const amountKgs = Number(payload.amount);
      const invoiceAmount = Number(invoice.amount_kgs);

      if (Math.abs(amountKgs - invoiceAmount) > 0.01) {
        const error = `Amount mismatch: expected ${invoiceAmount} KGS, got ${amountKgs} KGS`;
        console.error('[Webhook]', error);
        await billingRepo.updateWebhookEvent(webhookEvent.id, {
          error_message: error,
        });
        return NextResponse.json({ error }, { status: 400 });
      }
    }

    // 8. Process based on status
    const status = payload.status?.toUpperCase();

    if (status === 'SUCCEEDED' || status === 'PAID' || status === 'SUCCESS') {
      await processSuccessfulPayment(invoice, payload, webhookEvent.id);
      console.log('[Webhook] Payment processed successfully');
    } else if (status === 'FAILED' || status === 'ERROR') {
      await processFailedPayment(invoice, payload, webhookEvent.id);
      console.log('[Webhook] Payment marked as failed');
    } else {
      console.log('[Webhook] Status not final, ignoring:', status);
      await billingRepo.updateWebhookEvent(webhookEvent.id, {
        processed: true,
        processed_at: new Date(),
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Completed in ${duration}ms`);

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[Webhook] Processing error:', error);

    // Still return 200 to avoid retry storms
    // Log the error for investigation
    return NextResponse.json(
      {
        received: true,
        error: 'Internal processing error'
      },
      { status: 200 }
    );
  }
}

/**
 * Process successful payment
 */
async function processSuccessfulPayment(
  invoice: any,
  payload: FinikWebhookPayload,
  webhookEventId: string
): Promise<void> {
  const supabase = createClient();

  try {
    // Start transaction-like operations
    // 1. Update invoice to paid
    await billingRepo.updateInvoice(invoice.id, {
      status: 'paid',
      paid_at: payload.paid_at ? new Date(payload.paid_at) : new Date(),
      gateway_transaction_id: payload.transaction_id || null,
    });

    // 2. Create payment record
    await billingRepo.createPayment({
      invoice_id: invoice.id,
      organization_id: invoice.organization_id,
      amount_kgs: Number(invoice.amount_kgs),
      currency: invoice.currency,
      paid_via: 'webhook',
      gateway_transaction_id: payload.transaction_id || null,
      gateway_raw_payload: payload,
      marked_paid_by: null,
      admin_note: null,
      paid_at: payload.paid_at ? new Date(payload.paid_at) : new Date(),
    });

    // 3. Extend subscription period by 1 month
    const subscription = await billingRepo.getSubscriptionByOrgId(invoice.organization_id);

    if (subscription) {
      // Use database function to extend period
      await supabase.rpc('extend_subscription_period', {
        p_subscription_id: subscription.id,
        p_interval: '1 month',
      });
    }

    // 4. Mark webhook as processed
    await billingRepo.updateWebhookEvent(webhookEventId, {
      processed: true,
      processed_at: new Date(),
    });

    console.log('[Webhook] Payment successful:', {
      invoice_id: invoice.id,
      transaction_id: payload.transaction_id,
      amount: invoice.amount_kgs,
    });

  } catch (error) {
    console.error('[Webhook] Failed to process payment:', error);
    await billingRepo.updateWebhookEvent(webhookEventId, {
      error_message: error instanceof Error ? error.message : 'Processing failed',
    });
    throw error;
  }
}

/**
 * Process failed payment
 */
async function processFailedPayment(
  invoice: any,
  payload: FinikWebhookPayload,
  webhookEventId: string
): Promise<void> {
  try {
    // Update invoice to failed
    await billingRepo.updateInvoice(invoice.id, {
      status: 'failed',
      gateway_transaction_id: payload.transaction_id || null,
    });

    // Mark webhook as processed
    await billingRepo.updateWebhookEvent(webhookEventId, {
      processed: true,
      processed_at: new Date(),
      error_message: payload.error_message || null,
    });

    console.log('[Webhook] Payment failed:', {
      invoice_id: invoice.id,
      error: payload.error_message,
    });

  } catch (error) {
    console.error('[Webhook] Failed to process failed payment:', error);
    await billingRepo.updateWebhookEvent(webhookEventId, {
      error_message: error instanceof Error ? error.message : 'Processing failed',
    });
    throw error;
  }
}

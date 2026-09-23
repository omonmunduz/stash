/**
 * PAYMENT GATEWAY CONFIGURATION
 *
 * Loads gateway config from environment variables.
 * Never logs or exposes secrets.
 */

import type { PaymentGatewayConfig } from './interface';

export function getPaymentGatewayConfig(): PaymentGatewayConfig {
  const accountId = process.env.FINIK_ACCOUNT_ID;
  const apiKey = process.env.FINIK_API_KEY;
  const privateKey = process.env.FINIK_PRIVATE_KEY;
  const publicKey = process.env.FINIK_PUBLIC_KEY;
  const webhookUrl = process.env.FINIK_WEBHOOK_URL;
  const baseUrl = process.env.FINIK_BASE_URL;

  if (!accountId || !apiKey) {
    throw new Error(
      'Missing required Finik configuration. Set FINIK_ACCOUNT_ID and FINIK_API_KEY environment variables.'
    );
  }

  if (!webhookUrl) {
    throw new Error(
      'Missing FINIK_WEBHOOK_URL. Set to your webhook endpoint (e.g., https://yourdomain.com/api/webhooks/finik)'
    );
  }

  return {
    accountId,
    apiKey,
    privateKey,
    publicKey,
    webhookUrl,
    baseUrl,
  };
}

/**
 * Check if payment gateway is configured
 */
export function isPaymentGatewayConfigured(): boolean {
  return !!(
    process.env.FINIK_ACCOUNT_ID &&
    process.env.FINIK_API_KEY &&
    process.env.FINIK_WEBHOOK_URL
  );
}

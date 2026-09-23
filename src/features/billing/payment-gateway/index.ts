/**
 * PAYMENT GATEWAY FACTORY
 *
 * Creates and exports the configured payment gateway instance.
 * Centralizes gateway initialization.
 */

import { FinikPaymentGateway } from './finik';
import { getPaymentGatewayConfig } from './config';
import type { PaymentGateway } from './interface';

let gatewayInstance: PaymentGateway | null = null;

/**
 * Get the configured payment gateway instance (singleton)
 */
export function getPaymentGateway(): PaymentGateway {
  if (!gatewayInstance) {
    const config = getPaymentGatewayConfig();
    gatewayInstance = new FinikPaymentGateway(config);
  }
  return gatewayInstance;
}

/**
 * Re-export types for convenience
 */
export type {
  PaymentGateway,
  PaymentGatewayConfig,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatus,
  VerifyWebhookRequest,
  VerifyWebhookResponse,
} from './interface';

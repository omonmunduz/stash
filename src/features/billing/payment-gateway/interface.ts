/**
 * PAYMENT GATEWAY INTERFACE
 *
 * Gateway-agnostic interface for payment processing.
 * Finik implementation behind this interface can be swapped for other
 * gateways (FreedomPay, etc.) without changing application code.
 */

export interface PaymentGatewayConfig {
  accountId: string;
  apiKey: string;
  privateKey?: string;  // For request signing
  publicKey?: string;   // For webhook verification
  webhookUrl: string;
  baseUrl?: string;
}

export interface CreatePaymentRequest {
  amount: number;           // Amount in KGS (decimal)
  currency: string;         // 'KGS'
  requestId: string;        // Unique ID for idempotency
  description: string;
  customFields?: Record<string, string>;  // Pass invoice_id, etc.
  callbackUrl?: string;     // Override default webhook URL
}

export interface CreatePaymentResponse {
  success: boolean;
  paymentUrl?: string;      // URL for customer to complete payment
  qrCodeUrl?: string;       // URL to QR code image
  requestId: string;        // Echo back for tracking
  error?: string;
}

export interface PaymentStatus {
  requestId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'expired';
  transactionId?: string;   // Gateway's transaction ID
  amount?: number;
  currency?: string;
  paidAt?: Date;
  errorMessage?: string;
}

export interface VerifyWebhookRequest {
  signature: string;
  payload: string | object;
  headers?: Record<string, string>;
}

export interface VerifyWebhookResponse {
  valid: boolean;
  error?: string;
}

/**
 * Payment Gateway Interface
 * All gateway implementations must conform to this contract
 */
export interface PaymentGateway {
  /**
   * Create a new payment request
   * Returns payment URL and QR code for customer
   */
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;

  /**
   * Query payment status by request ID
   * Used for reconciliation when webhook is missed
   */
  getPaymentStatus(requestId: string): Promise<PaymentStatus>;

  /**
   * Verify webhook signature
   * CRITICAL: Must validate before processing webhook
   */
  verifyWebhook(request: VerifyWebhookRequest): Promise<VerifyWebhookResponse>;

  /**
   * Gateway name for logging
   */
  getName(): string;
}

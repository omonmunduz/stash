/**
 * FINIK PAYMENT GATEWAY (MOCK IMPLEMENTATION)
 *
 * Mock implementation of Finik payment gateway for development.
 * Simulates payment creation and webhook callbacks.
 *
 * TODO: Replace with real Finik API integration once documentation is available.
 * Real implementation needs:
 * - Base URL and endpoints
 * - Authentication headers
 * - Request signing algorithm
 * - Webhook signature verification method
 * - Exact payload structures
 */

import type {
  PaymentGateway,
  PaymentGatewayConfig,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatus,
  VerifyWebhookRequest,
  VerifyWebhookResponse,
} from './interface';

export class FinikPaymentGateway implements PaymentGateway {
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  getName(): string {
    return 'Finik (Mock)';
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    try {
      // TODO: Real implementation
      // POST to Finik API endpoint
      // Include authentication headers
      // Sign request with private key
      // Parse response for payment URL and QR code

      console.log('[Finik Mock] Creating payment:', {
        amount: request.amount,
        requestId: request.requestId,
        description: request.description,
      });

      // Mock response - simulate successful payment creation
      const mockPaymentUrl = `https://finik.kg/pay/${request.requestId}`;
      const mockQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockPaymentUrl)}`;

      return {
        success: true,
        paymentUrl: mockPaymentUrl,
        qrCodeUrl: mockQrCodeUrl,
        requestId: request.requestId,
      };
    } catch (error) {
      console.error('[Finik Mock] Payment creation failed:', error);
      return {
        success: false,
        requestId: request.requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getPaymentStatus(requestId: string): Promise<PaymentStatus> {
    try {
      // TODO: Real implementation
      // GET from Finik API status endpoint
      // Include authentication headers
      // Parse response for payment status

      console.log('[Finik Mock] Querying payment status:', requestId);

      // Mock response - always return pending for now
      // In real implementation, this would query Finik API
      return {
        requestId,
        status: 'pending',
      };
    } catch (error) {
      console.error('[Finik Mock] Status query failed:', error);
      return {
        requestId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async verifyWebhook(request: VerifyWebhookRequest): Promise<VerifyWebhookResponse> {
    try {
      // TODO: Real implementation
      // Verify signature using public key
      // Algorithm depends on Finik's specification
      // Common approaches:
      // - HMAC-SHA256 with secret key
      // - RSA signature with public key
      // - JWT with verification

      console.log('[Finik Mock] Verifying webhook signature');

      // Mock verification - accept test signatures, reject others
      if (!request.signature) {
        return {
          valid: false,
          error: 'Missing signature',
        };
      }

      // For testing: accept signature starting with "test_"
      const isTestSignature = request.signature.startsWith('test_');

      if (isTestSignature) {
        console.log('[Finik Mock] Test signature accepted');
        return { valid: true };
      }

      // Mock: accept any signature in development
      // DANGER: Real implementation MUST verify properly
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Finik Mock] ⚠️  Accepting unverified webhook in development mode');
        return { valid: true };
      }

      return {
        valid: false,
        error: 'Invalid signature',
      };
    } catch (error) {
      console.error('[Finik Mock] Webhook verification failed:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification error',
      };
    }
  }
}

/**
 * Real Finik Implementation Template
 *
 * Once API documentation is available, implement like this:
 *
 * async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
 *   // 1. Sign request
 *   const signature = this.signRequest(request, this.config.privateKey);
 *
 *   // 2. Make API call
 *   const response = await fetch(`${this.config.baseUrl}/payments/create`, {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'X-Account-Id': this.config.accountId,
 *       'X-API-Key': this.config.apiKey,
 *       'X-Signature': signature,
 *     },
 *     body: JSON.stringify({
 *       amount: request.amount,
 *       currency: request.currency,
 *       request_id: request.requestId,
 *       description: request.description,
 *       callback_url: this.config.webhookUrl,
 *       custom_fields: request.customFields,
 *     }),
 *   });
 *
 *   // 3. Parse response
 *   const data = await response.json();
 *   return {
 *     success: response.ok,
 *     paymentUrl: data.payment_url,
 *     qrCodeUrl: data.qr_code_url,
 *     requestId: request.requestId,
 *     error: data.error,
 *   };
 * }
 *
 * private signRequest(request: any, privateKey: string): string {
 *   // Implement according to Finik specification
 *   // Example: HMAC-SHA256
 *   const crypto = require('crypto');
 *   const message = JSON.stringify(request);
 *   return crypto.createHmac('sha256', privateKey).update(message).digest('hex');
 * }
 *
 * async verifyWebhook(request: VerifyWebhookRequest): Promise<VerifyWebhookResponse> {
 *   // Implement according to Finik specification
 *   const crypto = require('crypto');
 *   const payload = typeof request.payload === 'string'
 *     ? request.payload
 *     : JSON.stringify(request.payload);
 *
 *   const expectedSignature = crypto
 *     .createHmac('sha256', this.config.publicKey)
 *     .update(payload)
 *     .digest('hex');
 *
 *   return {
 *     valid: crypto.timingSafeEqual(
 *       Buffer.from(expectedSignature),
 *       Buffer.from(request.signature)
 *     ),
 *   };
 * }
 */

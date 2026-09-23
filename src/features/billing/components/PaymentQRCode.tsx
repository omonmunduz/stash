/**
 * PAYMENT QR CODE
 *
 * Displays QR code for payment with link fallback.
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentQRCodeProps {
  qrCodeUrl: string;
  paymentUrl?: string;
  amount: number;
}

export function PaymentQRCode({ qrCodeUrl, paymentUrl, amount }: PaymentQRCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    if (!paymentUrl) return;

    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="text-center">
        <p className="text-sm font-medium">Scan to Pay</p>
        <p className="text-xs text-muted-foreground">
          {amount.toFixed(2)} KGS
        </p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        <div className="relative h-48 w-48 overflow-hidden rounded-lg border bg-white p-2">
          <Image
            src={qrCodeUrl}
            alt="Payment QR Code"
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      </div>

      {/* Payment Link */}
      {paymentUrl && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open(paymentUrl, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Payment Page
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Or copy the payment link and share it
          </p>
        </div>
      )}
    </div>
  );
}

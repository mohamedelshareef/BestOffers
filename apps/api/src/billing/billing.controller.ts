import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { BillingStatus, CheckoutResponse } from '@bestoffers/shared';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { BillingService } from './billing.service';

/**
 * Billing contract (ADR-004 Slice C):
 *   POST /billing/checkout  (authed)  → { url }
 *   GET  /billing/status    (authed)  → { status, premium, currentPeriodEnd }
 *   POST /billing/webhook   (NO auth; signature-verified) → raw body; updates subscriptions
 */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  @UseGuards(AuthGuard)
  checkout(@Req() req: AuthedRequest): Promise<CheckoutResponse> {
    return this.billing.checkout(req.auth!.userId);
  }

  @Get('status')
  @UseGuards(AuthGuard)
  status(@Req() req: AuthedRequest): Promise<BillingStatus> {
    return this.billing.status(req.auth!.userId);
  }

  /**
   * Webhook is the source of truth — NOT guarded by JWT (Stripe has no JWT); it is authenticated by
   * the signature (verified inside the provider). Raw body is required for signature verification.
   */
  @Post('webhook')
  async webhook(
    @Req() req: AuthedRequest & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
    @Body() body: unknown,
  ): Promise<{ applied: boolean }> {
    const raw =
      req.rawBody ?? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body ?? {}), 'utf8');
    return this.billing.handleWebhook(raw, signature ?? '');
  }
}

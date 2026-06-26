import { HttpException, HttpStatus } from '@nestjs/common';
import { FREE_SEARCH_LIMIT, PaywallError } from '@bestoffers/shared';

/**
 * 402 PAYWALL (ADR-004 Decision 5 / BA F-D2 AC-5). Thrown at the search enforcement point when a
 * free user attempts search #6. The app renders the paywall and routes to /billing/checkout; the
 * blocked intent is preserved client-side so it runs immediately after a successful subscribe.
 */
export class PaywallException extends HttpException {
  constructor(used = FREE_SEARCH_LIMIT) {
    const body: PaywallError = { error: 'PAYWALL', used, limit: FREE_SEARCH_LIMIT };
    super(body, HttpStatus.PAYMENT_REQUIRED);
  }
}

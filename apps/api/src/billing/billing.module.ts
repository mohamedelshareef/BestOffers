import { Module, Provider } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { BILLING_PROVIDER } from './billing-provider.interface';
import { MockBillingProvider } from './mock-billing-provider';
import { StripeBillingProvider } from './stripe-billing-provider';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

/**
 * BillingProvider selector (ADR-004 Decision 4). Offline/dev/test default = MockBillingProvider
 * (no keys). BILLING_PROVIDER=stripe selects the Stripe impl (config-ready; needs STRIPE_* keys).
 */
const billingProvider: Provider = {
  provide: BILLING_PROVIDER,
  useClass: process.env.BILLING_PROVIDER === 'stripe' ? StripeBillingProvider : MockBillingProvider,
};

@Module({
  controllers: [BillingController],
  providers: [DbService, billingProvider, BillingService],
  exports: [BillingService],
})
export class BillingModule {}

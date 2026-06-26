import { Module } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { BillingModule } from '../billing/billing.module';
import { QuotaService } from './quota.service';
import { QuotaController } from './quota.controller';

/** Slice D — depends on BillingService.isPremium (Slice C) for the bypass. */
@Module({
  imports: [BillingModule],
  controllers: [QuotaController],
  providers: [DbService, QuotaService],
  exports: [QuotaService],
})
export class QuotaModule {}

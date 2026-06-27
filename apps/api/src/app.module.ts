import { Controller, Get, Module } from '@nestjs/common';
import { SearchModule } from './search/search.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { BillingModule } from './billing/billing.module';
import { QuotaModule } from './quota/quota.module';
import { AuditModule } from './audit/audit.module';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'bestoffers-api',
      slice: 'S2-Phase2a accounts/billing/freemium (mock)',
      providers: {
        db: process.env.DB_DRIVER === 'pg' ? 'pg' : 'sqlite',
        auth: process.env.AUTH_MODE === 'supabase' ? 'supabase' : 'local',
        storage: process.env.STORAGE_PROVIDER === 'supabase' ? 'supabase' : 'local',
        otp: process.env.OTP_PROVIDER ?? 'mock',
        billing: process.env.BILLING_PROVIDER ?? 'mock',
        claude: process.env.CLAUDE_PROVIDER === 'anthropic' ? 'anthropic' : 'mock',
        liveFetch: process.env.LIVE_FETCH !== 'off' ? 'on' : 'off',
      },
    };
  }
}

@Module({
  // AuthModule is @Global → DbService/JwtService/AuthGuard injectable everywhere. Order: auth first.
  // AuditModule is @Global → records EVERY request (interceptor + filter) via the DbService from AuthModule.
  imports: [AuthModule, AuditModule, AccountsModule, BillingModule, QuotaModule, SearchModule],
  controllers: [HealthController],
})
export class AppModule {}

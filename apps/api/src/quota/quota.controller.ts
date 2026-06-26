import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { QuotaStatus } from '@bestoffers/shared';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { QuotaService } from './quota.service';

/**
 * Freemium status contract (ADR-004 Slice D):
 *   GET /me/quota (authed) → { used, limit, premium }   — drives "N of 5 free searches left" UI.
 */
@Controller('me/quota')
@UseGuards(AuthGuard)
export class QuotaController {
  constructor(private readonly quota: QuotaService) {}

  @Get()
  status(@Req() req: AuthedRequest): Promise<QuotaStatus> {
    return this.quota.status(req.auth!.userId);
  }
}

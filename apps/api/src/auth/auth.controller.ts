import { Body, Controller, Post } from '@nestjs/common';
import {
  OtpRefreshBody,
  OtpRequestBody,
  OtpRequestResponse,
  OtpVerifyBody,
  OtpVerifyResponse,
} from '@bestoffers/shared';
import { AuthService } from './auth.service';

/**
 * Auth contract (ADR-004 Slice B):
 *   POST /auth/otp/request {phoneE164, locale, channel?} → {sent, channel, cooldownSeconds}
 *   POST /auth/otp/verify  {phoneE164, code}             → {access, refresh, pseudoId, localePref, isNewUser}
 *   POST /auth/refresh     {refresh}                     → {access, refresh}
 * Mock mode: code = OTP_DEV_CODE (default 000000).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  request(@Body() body: OtpRequestBody): Promise<OtpRequestResponse> {
    return this.auth.requestOtp(body.phoneE164, body.locale, body.channel ?? 'whatsapp');
  }

  @Post('otp/verify')
  verify(@Body() body: OtpVerifyBody): Promise<OtpVerifyResponse> {
    return this.auth.verifyOtp(body.phoneE164, body.code);
  }

  @Post('refresh')
  refresh(@Body() body: OtpRefreshBody): Promise<{ access: string; refresh: string }> {
    return this.auth.refresh(body.refresh);
  }
}

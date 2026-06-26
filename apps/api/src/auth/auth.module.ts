import { Global, Module, Provider } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { JwtService } from './jwt.service';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OTP_SENDER, MockOtpSender, OtpSender } from './otp-sender.interface';
import { WhatsAppOtpSender } from './providers/whatsapp-otp-sender';
import { TwilioOtpSender } from './providers/twilio-otp-sender';

/**
 * OtpSender selector (ADR-004 Decision 1). Offline/dev/test default = MockOtpSender (no keys).
 * OTP_PROVIDER=meta_whatsapp|twilio|360dialog selects a real impl (config-ready; needs keys).
 */
function selectOtpSender(): OtpSender {
  switch (process.env.OTP_PROVIDER) {
    case 'meta_whatsapp':
      return new WhatsAppOtpSender();
    case 'twilio':
    case '360dialog': // 360dialog is WhatsApp-on-Twilio-compatible REST; Twilio impl covers the contract
      return new TwilioOtpSender();
    default:
      return new MockOtpSender();
  }
}

const otpProvider: Provider = { provide: OTP_SENDER, useFactory: selectOtpSender };

/**
 * Global so DbService + JwtService + AuthGuard are injectable everywhere (accounts/billing/quota all
 * authorize by the same JWT) without re-importing.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [DbService, JwtService, AuthGuard, AuthService, otpProvider],
  exports: [DbService, JwtService, AuthGuard, AuthService, OTP_SENDER],
})
export class AuthModule {}

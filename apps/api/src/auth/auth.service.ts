import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, createHash, randomUUID } from 'crypto';
import {
  Locale,
  OtpChannel,
  OtpRequestResponse,
  OtpVerifyResponse,
} from '@bestoffers/shared';
import { DbService } from '../db/db.service';
import { JwtService } from './jwt.service';
import { OTP_SENDER, OtpSender } from './otp-sender.interface';

const CODE_LENGTH = 6;
const CODE_TTL_MS = 5 * 60 * 1000; // 5 min (F-C1 AC-4)
const MAX_VERIFY_ATTEMPTS = 5; // (F-C1 AC-7)
const RESEND_COOLDOWN_MS = 30 * 1000; // (F-C1 AC-5)
const REQUEST_WINDOW_MS = 60 * 60 * 1000; // (F-C1 AC-6)
const MAX_REQUESTS_PER_WINDOW = 5; // (F-C1 AC-6)
const E164 = /^\+\d{7,15}$/;

interface OtpRow {
  id: string;
  phone_e164: string;
  code_hash: string;
  channel: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
  created_at: string;
}

/**
 * Local identity plane (ADR-004 mock mode). Owns OTP request/verify, session issuance, and
 * first-sign-in user+profile creation. Phone PII lives ONLY in auth_users; downstream gets pseudoId.
 * In Supabase prod, request/verify delegate to Supabase Auth (phone sign-in + custom OTP hook); the
 * OtpSender (delivery channel) and this service's contract stay identical.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dbs: DbService,
    private readonly jwt: JwtService,
    @Inject(OTP_SENDER) private readonly otp: OtpSender,
  ) {}

  private hash(s: string): string {
    return createHash('sha256').update(s).digest('hex');
  }

  /** POST /auth/otp/request — generate code, store hash+TTL, send (WhatsApp → SMS fallback). */
  async requestOtp(phoneE164: string, locale: Locale, channel: OtpChannel = 'whatsapp'): Promise<OtpRequestResponse> {
    if (!E164.test(phoneE164)) throw new BadRequestException('invalid phone format');
    const now = Date.now();

    // Rate-limit: ≤5 requests / hour / phone (F-C1 AC-6).
    const windowStart = new Date(now - REQUEST_WINDOW_MS).toISOString();
    const recent = (await this.dbs.get<{ c: number }>(
      'SELECT COUNT(*) c FROM auth_otps WHERE phone_e164=? AND created_at >= ?',
      [phoneE164, windowStart],
    )) ?? { c: 0 };
    if (recent.c >= MAX_REQUESTS_PER_WINDOW) {
      throw new HttpException('too many requests, try later', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Resend cooldown: 30s since the latest code for this phone (F-C1 AC-5).
    const last = await this.dbs.get<{ created_at: string }>(
      'SELECT created_at FROM auth_otps WHERE phone_e164=? ORDER BY created_at DESC LIMIT 1',
      [phoneE164],
    );
    if (last && now - Date.parse(last.created_at) < RESEND_COOLDOWN_MS) {
      throw new HttpException('please wait before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Resending invalidates prior codes — only the latest is valid (F-C1 AC-5).
    await this.dbs.run('UPDATE auth_otps SET consumed_at=? WHERE phone_e164=? AND consumed_at IS NULL', [
      new Date(now).toISOString(),
      phoneE164,
    ]);

    const code = this.generateCode();
    await this.dbs.run(
      `INSERT INTO auth_otps (id, phone_e164, code_hash, channel, expires_at, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [
        randomUUID(),
        phoneE164,
        this.hash(code),
        channel,
        new Date(now + CODE_TTL_MS).toISOString(),
        new Date(now).toISOString(),
      ],
    );

    // Send with WhatsApp→SMS fallback. Plaintext code is passed to the sender, never persisted/logged here.
    const usedChannel = await this.deliver(phoneE164, code, locale, channel);
    return { sent: true, channel: usedChannel, cooldownSeconds: RESEND_COOLDOWN_MS / 1000 };
  }

  private async deliver(phoneE164: string, code: string, locale: Locale, channel: OtpChannel): Promise<OtpChannel> {
    try {
      const r = await this.otp.send({ phoneE164, code, locale, channel });
      return r.channel;
    } catch (err) {
      if (channel === 'whatsapp') {
        // SMS fallback (F-C1 AC-8): retry the same code over SMS.
        this.logger.warn(`WhatsApp delivery failed, falling back to SMS: ${(err as Error).message}`);
        const r = await this.otp.send({ phoneE164, code, locale, channel: 'sms' });
        return r.channel;
      }
      throw err;
    }
  }

  /** POST /auth/otp/verify — check code (TTL + attempt lock), issue session, create user on first sign-in. */
  async verifyOtp(phoneE164: string, code: string): Promise<OtpVerifyResponse> {
    if (!E164.test(phoneE164)) throw new BadRequestException('invalid phone format');
    const devCode = process.env.OTP_DEV_CODE ?? '000000';
    const isMock = (process.env.OTP_PROVIDER ?? 'mock') === 'mock';

    const row = await this.dbs.get<OtpRow>(
      `SELECT * FROM auth_otps WHERE phone_e164=? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [phoneE164],
    );
    if (!row) throw new UnauthorizedException('no active code — request a new one');

    if (Date.now() > Date.parse(row.expires_at)) {
      await this.dbs.run('UPDATE auth_otps SET consumed_at=? WHERE id=?', [new Date().toISOString(), row.id]);
      throw new UnauthorizedException('code expired, request a new one');
    }
    if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.dbs.run('UPDATE auth_otps SET consumed_at=? WHERE id=?', [new Date().toISOString(), row.id]);
      throw new UnauthorizedException('too many attempts, request a new code');
    }

    // Dev universal code accepted ONLY in mock mode (ADR-004 Decision 1).
    const matches = this.hash(code) === row.code_hash || (isMock && code === devCode);
    if (!matches) {
      await this.dbs.run('UPDATE auth_otps SET attempts=attempts+1 WHERE id=?', [row.id]);
      const remaining = MAX_VERIFY_ATTEMPTS - (row.attempts + 1);
      throw new UnauthorizedException(`incorrect code${remaining > 0 ? ` (${remaining} attempts left)` : ''}`);
    }

    await this.dbs.run('UPDATE auth_otps SET consumed_at=? WHERE id=?', [new Date().toISOString(), row.id]);
    return this.issueSessionForPhone(phoneE164);
  }

  /** Creates the user + profile on first sign-in; returns access + refresh + pseudoId. */
  private async issueSessionForPhone(phoneE164: string): Promise<OtpVerifyResponse> {
    const now = new Date().toISOString();
    let user = await this.dbs.get<{ id: string }>('SELECT id FROM auth_users WHERE phone_e164=?', [phoneE164]);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const id = randomUUID();
      const pseudoId = randomUUID();
      await this.dbs.tx(async (t) => {
        await t.run('INSERT INTO auth_users (id, phone_e164, created_at, last_login_at) VALUES (?,?,?,?)', [
          id,
          phoneE164,
          now,
          now,
        ]);
        await t.run('INSERT INTO profiles (id, pseudo_id, locale_pref, created_at) VALUES (?,?,?,?)', [
          id,
          pseudoId,
          'ar',
          now,
        ]);
        await t.run('INSERT INTO search_quota (user_id, used_count, updated_at) VALUES (?,0,?)', [id, now]);
        await t.run('INSERT INTO subscriptions (user_id, status, updated_at) VALUES (?,?,?)', [id, 'none', now]);
      });
      user = { id };
    } else {
      await this.dbs.run('UPDATE auth_users SET last_login_at=? WHERE id=?', [now, user.id]);
    }

    const profile = (await this.dbs.get<{ pseudo_id: string; locale_pref: Locale }>(
      'SELECT pseudo_id, locale_pref FROM profiles WHERE id=?',
      [user.id],
    ))!;

    const access = this.jwt.signAccess(user.id, profile.pseudo_id);
    const refresh = await this.issueRefresh(user.id);
    return {
      access,
      refresh,
      pseudoId: profile.pseudo_id,
      localePref: profile.locale_pref,
      isNewUser,
    };
  }

  /** POST /auth/refresh — rotate refresh token, mint a fresh access JWT (F-A2 biometric re-auth). */
  async refresh(refreshToken: string): Promise<{ access: string; refresh: string }> {
    const hash = this.hash(refreshToken);
    const row = await this.dbs.get<{
      id: string;
      user_id: string;
      expires_at: string;
      revoked_at: string | null;
    }>('SELECT id, user_id, expires_at, revoked_at FROM auth_sessions WHERE refresh_token_hash=?', [hash]);
    if (!row || row.revoked_at || Date.now() > Date.parse(row.expires_at)) {
      throw new UnauthorizedException('invalid or expired refresh token');
    }
    // Rotate: revoke old, issue new.
    await this.dbs.run('UPDATE auth_sessions SET revoked_at=? WHERE id=?', [new Date().toISOString(), row.id]);
    const profile = (await this.dbs.get<{ pseudo_id: string }>('SELECT pseudo_id FROM profiles WHERE id=?', [
      row.user_id,
    ]))!;
    const access = this.jwt.signAccess(row.user_id, profile.pseudo_id);
    const refresh = await this.issueRefresh(row.user_id);
    return { access, refresh };
  }

  private async issueRefresh(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    await this.dbs.run(
      'INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at, created_at) VALUES (?,?,?,?,?)',
      [
        randomUUID(),
        userId,
        this.hash(token),
        new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(now).toISOString(),
      ],
    );
    return token;
  }

  private generateCode(): string {
    let s = '';
    for (let i = 0; i < CODE_LENGTH; i++) s += Math.floor(Math.random() * 10);
    return s;
  }
}

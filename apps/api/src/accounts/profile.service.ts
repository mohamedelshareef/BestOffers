import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Profile, ProfileUpdate } from '@bestoffers/shared';
import { DbService } from '../db/db.service';
import { STORAGE, Storage } from './storage.interface';

const NAME_RE = /^[\p{L}\p{M}\s'-]{1,60}$/u; // Arabic+Latin letters, spaces, hyphen, apostrophe (F-A1 AC-2)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // RFC-5322-practical (F-A1 AC-3)
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h (F-A1 AC-6)

interface ProfileRow {
  id: string;
  pseudo_id: string;
  display_name: string | null;
  email: string | null;
  email_verified: number;
  email_pending: string | null;
  avatar_url: string | null;
  locale_pref: string;
  notif_enabled: number;
  notif_prefs: string;
  biometric_enabled: number;
}

/**
 * Profile read/update (ADR-004 Slice A). EVERY method takes `userId` from the auth context and scopes
 * its SQL to that id — the RLS-equivalent ownership check (a caller can never read/write another
 * user's row). Email change → re-verification flow (F-A1 AC-4/5/6).
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly dbs: DbService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  async getProfile(userId: string): Promise<Profile> {
    const row = await this.dbs.get<ProfileRow>('SELECT * FROM profiles WHERE id=?', [userId]);
    if (!row) throw new NotFoundException('profile not found');
    return this.toProfile(row);
  }

  async updateProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
    const existing = await this.dbs.get<ProfileRow>('SELECT * FROM profiles WHERE id=?', [userId]);
    if (!existing) throw new NotFoundException('profile not found');

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (patch.displayName !== undefined) {
      const name = patch.displayName.trim();
      if (!NAME_RE.test(name)) throw new BadRequestException('name must be 1–60 letters/spaces');
      sets.push('display_name=?');
      vals.push(name);
    }

    if (patch.email !== undefined) {
      await this.applyEmailChange(userId, existing, patch.email, sets, vals);
    }

    if (patch.avatarUrl !== undefined) {
      // Ownership: an avatar path must be prefixed with the caller's own userId (Storage RLS parity).
      if (patch.avatarUrl !== null && !patch.avatarUrl.startsWith(`${userId}/`)) {
        throw new BadRequestException('avatar path must belong to the caller');
      }
      // Removing avatar → GC old object (F-A1 AC-10).
      if (patch.avatarUrl === null && existing.avatar_url) {
        void this.storage.remove(existing.avatar_url).catch(() => undefined);
      }
      sets.push('avatar_url=?');
      vals.push(patch.avatarUrl);
    }

    if (patch.localePref !== undefined) {
      if (patch.localePref !== 'ar' && patch.localePref !== 'en') throw new BadRequestException('bad locale');
      sets.push('locale_pref=?');
      vals.push(patch.localePref);
    }
    if (patch.notifEnabled !== undefined) {
      sets.push('notif_enabled=?');
      vals.push(patch.notifEnabled ? 1 : 0);
    }
    if (patch.notifPrefs !== undefined) {
      sets.push('notif_prefs=?');
      vals.push(JSON.stringify(patch.notifPrefs));
    }
    if (patch.biometricEnabled !== undefined) {
      sets.push('biometric_enabled=?');
      vals.push(patch.biometricEnabled ? 1 : 0);
    }

    if (sets.length > 0) {
      await this.dbs.run(`UPDATE profiles SET ${sets.join(', ')} WHERE id=?`, [...vals, userId]);
    }
    return this.getProfile(userId);
  }

  private async applyEmailChange(
    userId: string,
    existing: ProfileRow,
    email: string | null,
    sets: string[],
    vals: unknown[],
  ): Promise<void> {
    if (email === null || email.trim() === '') {
      // Clear email → cancels any pending verification (F-A1 edge case).
      sets.push('email=?', 'email_verified=?', 'email_pending=?', 'email_verify_token_hash=?', 'email_verify_expires_at=?');
      vals.push(null, 0, null, null, null);
      return;
    }
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) throw new BadRequestException('invalid email address');
    if (normalized === existing.email && existing.email_verified) return; // no-op, already verified

    // Uniqueness across accounts (F-A1 edge: do not leak which account).
    const clash = await this.dbs.get<{ id: string }>('SELECT id FROM profiles WHERE email=? AND id<>?', [
      normalized,
      userId,
    ]);
    if (clash) throw new ConflictException('email already in use');

    // New/changed email → store as pending, keep prior verified email effective (F-A1 AC-4).
    const token = randomUUID().replace(/-/g, '');
    sets.push('email_pending=?', 'email_verify_token_hash=?', 'email_verify_expires_at=?');
    vals.push(
      normalized,
      createHash('sha256').update(token).digest('hex'),
      new Date(Date.now() + EMAIL_VERIFY_TTL_MS).toISOString(),
    );
    // NOTE: real impl emails the link/code (Supabase Auth email or mail provider). Mock: surface token.
    // The verify token is returned to the caller ONLY in dev/mock for testability (see controller).
    (this as unknown as { _lastEmailToken?: string })._lastEmailToken = token;
  }

  /** GET /me/email-verify?token= — completes re-verification (F-A1 AC-4/5/6). */
  async verifyEmail(userId: string, token: string): Promise<Profile> {
    const row = await this.dbs.get<{
      email_pending: string | null;
      email_verify_token_hash: string | null;
      email_verify_expires_at: string | null;
    }>(
      'SELECT email_pending, email_verify_token_hash, email_verify_expires_at FROM profiles WHERE id=?',
      [userId],
    );
    if (!row || !row.email_pending || !row.email_verify_token_hash) {
      throw new BadRequestException('no pending email verification');
    }
    if (row.email_verify_expires_at && Date.now() > Date.parse(row.email_verify_expires_at)) {
      throw new BadRequestException('verification link expired — resend');
    }
    if (createHash('sha256').update(token).digest('hex') !== row.email_verify_token_hash) {
      throw new BadRequestException('invalid verification token');
    }
    // email_verified set via a bind param (1) — Postgres coerces an integer PARAM 1→true on a boolean
    // column (a literal `=1` would NOT; only params/`true` work cross-dialect). SQLite stores 1.
    await this.dbs.run(
      'UPDATE profiles SET email=?, email_verified=?, email_pending=NULL, email_verify_token_hash=NULL, email_verify_expires_at=NULL WHERE id=?',
      [row.email_pending, 1, userId],
    );
    return this.getProfile(userId);
  }

  /** Dev/mock only: surfaces the last issued email-verify token so tests/mobile can complete the flow. */
  lastEmailToken(): string | undefined {
    return (this as unknown as { _lastEmailToken?: string })._lastEmailToken;
  }

  get storageRef(): Storage {
    return this.storage;
  }

  private toProfile(r: ProfileRow): Profile {
    let prefs: Record<string, boolean> = {};
    try {
      prefs = JSON.parse(r.notif_prefs || '{}');
    } catch {
      prefs = {};
    }
    return {
      id: r.id,
      pseudoId: r.pseudo_id,
      displayName: r.display_name,
      email: r.email,
      emailVerified: !!r.email_verified,
      emailPending: r.email_pending,
      avatarUrl: r.avatar_url,
      localePref: r.locale_pref === 'en' ? 'en' : 'ar',
      notifEnabled: !!r.notif_enabled,
      notifPrefs: prefs,
      biometricEnabled: !!r.biometric_enabled,
    };
  }
}

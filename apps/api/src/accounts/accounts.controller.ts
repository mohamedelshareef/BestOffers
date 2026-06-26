import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Profile, ProfileUpdate } from '@bestoffers/shared';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { ProfileService } from './profile.service';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Accounts contract (ADR-004 Slice A) — all guarded; ownership scoped to req.auth.userId:
 *   GET   /me                         → Profile
 *   PATCH /me {ProfileUpdate}         → Profile (email change → pending re-verify)
 *   POST  /me/avatar {base64, contentType} → { avatarUrl } (stored via Storage iface)
 *   POST  /me/email-verify {token}    → Profile (completes re-verification)
 */
@Controller('me')
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  me(@Req() req: AuthedRequest): Promise<Profile> {
    return this.profiles.getProfile(req.auth!.userId);
  }

  @Patch()
  async update(
    @Req() req: AuthedRequest,
    @Body() body: ProfileUpdate,
  ): Promise<Profile & { emailVerifyToken?: string }> {
    const profile = await this.profiles.updateProfile(req.auth!.userId, body);
    // Dev/mock: surface the verify token so the flow is completable with no mail provider.
    const token = body.email ? this.profiles.lastEmailToken() : undefined;
    return token ? { ...profile, emailVerifyToken: token } : profile;
  }

  @Post('avatar')
  async avatar(
    @Req() req: AuthedRequest,
    @Body() body: { base64: string; contentType: string },
  ): Promise<{ avatarUrl: string }> {
    const userId = req.auth!.userId;
    const ext = EXT_BY_MIME[body.contentType] ?? 'bin';
    const bytes = Buffer.from(body.base64, 'base64');
    const { path } = await this.profiles.storageRef.put(userId, ext, bytes, body.contentType);
    await this.profiles.updateProfile(userId, { avatarUrl: path });
    return { avatarUrl: path };
  }

  @Post('email-verify')
  verifyEmail(@Req() req: AuthedRequest, @Body() body: { token: string }): Promise<Profile> {
    return this.profiles.verifyEmail(req.auth!.userId, body.token);
  }

  @Get('email-verify')
  verifyEmailGet(@Req() req: AuthedRequest, @Query('token') token: string): Promise<Profile> {
    return this.profiles.verifyEmail(req.auth!.userId, token);
  }
}

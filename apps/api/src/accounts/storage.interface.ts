import { Logger } from '@nestjs/common';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

export const STORAGE = Symbol('STORAGE');

/**
 * Avatar object storage (ADR-004 Decision 2). FROZEN: path convention is `{userId}/avatar.<ext>`;
 * `put` returns the path stored in profiles.avatar_url; the UI renders via a (signed) URL.
 *
 * STORAGE_PROVIDER = 'local' (mock) | 'supabase'. Local-disk impl writes under STORAGE_DIR; the
 * Supabase Storage impl (config-ready) uploads to the private `avatars` bucket with the same path
 * convention + owner-prefixed policy. Ownership is enforced by the caller (userId prefix), mirroring
 * the Storage RLS policy `(storage.foldername(name))[1] = auth.uid()`.
 */
export interface Storage {
  /** Stores bytes at {userId}/avatar.<ext>; returns the stored path. */
  put(userId: string, ext: string, bytes: Buffer, contentType: string): Promise<{ path: string }>;
  /** Resolves a path to a renderable URL (signed/CDN in prod; file URL locally). */
  url(path: string): Promise<string>;
  remove(path: string): Promise<void>;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB pre-processing (F-A1 AC-7)
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']); // (F-A1 AC-7)

export function assertAvatarUpload(bytes: Buffer, contentType: string): void {
  if (!ALLOWED.has(contentType)) {
    throw new Error(`unsupported avatar type "${contentType}" (allowed: JPEG, PNG, WebP)`);
  }
  if (bytes.length > MAX_BYTES) {
    throw new Error('avatar exceeds 5 MB limit');
  }
}

/** Local-disk mock. Writes under STORAGE_DIR (default apps/api/.storage). No network. */
export class LocalDiskStorage implements Storage {
  private readonly logger = new Logger('LocalDiskStorage');
  private readonly root = process.env.STORAGE_DIR ?? join(__dirname, '..', '..', '.storage', 'avatars');

  async put(userId: string, ext: string, bytes: Buffer, contentType: string): Promise<{ path: string }> {
    assertAvatarUpload(bytes, contentType);
    const dir = join(this.root, userId);
    mkdirSync(dir, { recursive: true });
    const path = `${userId}/avatar.${ext}`;
    writeFileSync(join(this.root, path), bytes);
    return { path };
  }

  async url(path: string): Promise<string> {
    return `file://${join(this.root, path)}`;
  }

  async remove(path: string): Promise<void> {
    const full = join(this.root, path);
    if (existsSync(full)) rmSync(full);
  }
}

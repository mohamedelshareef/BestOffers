import { Module, Provider } from '@nestjs/common';
import { STORAGE, selectStorage } from './storage.interface';
import { ProfileService } from './profile.service';
import { AccountsController } from './accounts.controller';

/**
 * Storage selector (ADR-004 Decision 2). Offline/dev/test default = LocalDiskStorage (no keys).
 * STORAGE_PROVIDER=supabase → SupabaseStorage (uploads to the live private `avatars` bucket).
 */
const storageProvider: Provider = { provide: STORAGE, useFactory: selectStorage };

@Module({
  controllers: [AccountsController],
  providers: [storageProvider, ProfileService],
  exports: [ProfileService],
})
export class AccountsModule {}

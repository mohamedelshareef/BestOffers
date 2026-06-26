import { Module, Provider } from '@nestjs/common';
import { STORAGE, LocalDiskStorage, Storage } from './storage.interface';
import { ProfileService } from './profile.service';
import { AccountsController } from './accounts.controller';

/**
 * Storage selector (ADR-004 Decision 2). Offline/dev/test default = LocalDiskStorage (no keys).
 * STORAGE_PROVIDER=supabase selects the Supabase Storage impl (config-ready; needs SUPABASE keys).
 */
function selectStorage(): Storage {
  // Supabase impl is config-ready; until wired, fall through to local disk so the app boots keyless.
  return new LocalDiskStorage();
}

const storageProvider: Provider = { provide: STORAGE, useFactory: selectStorage };

@Module({
  controllers: [AccountsController],
  providers: [storageProvider, ProfileService],
  exports: [ProfileService],
})
export class AccountsModule {}

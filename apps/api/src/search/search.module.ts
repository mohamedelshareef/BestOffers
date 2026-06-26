import { Module, Provider } from '@nestjs/common';
import { CLAUDE_CLIENT } from '../ai/claude-client.interface';
import { MockClaudeClient } from '../ai/mock-claude-client';
import { AnthropicClaudeClient } from '../ai/anthropic-claude-client';
import { OffersService } from '../offers/offers.service';
import { EventsService } from '../events/events.service';
import { SessionStore } from './session.store';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { QuotaModule } from '../quota/quota.module';

/**
 * Claude binding selector. Offline/dev/test default = MockClaudeClient (no API key needed).
 * Set CLAUDE_PROVIDER=anthropic (with ANTHROPIC_API_KEY) to use the live client.
 */
const claudeProvider: Provider = {
  provide: CLAUDE_CLIENT,
  useClass:
    process.env.CLAUDE_PROVIDER === 'anthropic' ? AnthropicClaudeClient : MockClaudeClient,
};

@Module({
  imports: [QuotaModule], // Slice D — freemium gate (QuotaService) + JwtService (AuthModule global)
  controllers: [SearchController],
  providers: [
    claudeProvider,
    SearchService,
    OffersService,
    SessionStore,
    EventsService,
  ],
  exports: [SearchService, EventsService],
})
export class SearchModule {}

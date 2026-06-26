import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  const provider = process.env.CLAUDE_PROVIDER === 'anthropic' ? 'anthropic' : 'mock';
  Logger.log(`BestOffers API on :${port} (claude=${provider})`, 'Bootstrap');
}

bootstrap();

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

// Fix: JSON.stringify cannot handle BigInt (used for chatId).
// This patches BigInt globally so NestJS response serialization works.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const logger = new Logger('Bootstrap');

// Fix: nestjs-telegraf crashes the Node process with ETIMEDOUT when
// api.telegram.org is unreachable (e.g. no VPN). Catch these so the
// REST API stays alive even when the Telegram bot is offline.
function isInfraConnectionError(reason: any, msg: string): boolean {
  return (
    reason?.code === 'ECONNREFUSED' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes("Can't reach database server") ||
    msg.includes('connect ECONNREFUSED')
  );
}

process.on('unhandledRejection', (reason: any) => {
  const msg: string = reason?.message ?? String(reason);
  if (
    reason?.code === 'ETIMEDOUT' ||
    reason?.type === 'system' ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('api.telegram.org')
  ) {
    logger.warn(
      '⚠️  Telegram bot offline (network blocked). REST API is still running. Enable a VPN to activate the bot.',
    );
    return; // Do NOT rethrow — keep the process alive
  }
  if (isInfraConnectionError(reason, msg)) {
    logger.error(
      'Infrastructure unavailable (Postgres/Redis). Start Docker Desktop, then run: docker compose up -d',
    );
    process.exit(1);
  }
  logger.error(`Unhandled rejection: ${msg}`, reason?.stack);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`✅ Backend running on http://localhost:${port}/api`);
}
bootstrap();


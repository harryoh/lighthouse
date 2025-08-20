import { PrismaClient, Prisma } from '@prisma/client';
import { getDatabaseConfig, isProduction } from './config/env';

declare global {
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  const config = getDatabaseConfig();

  return new PrismaClient({
    log: config.log as Prisma.LogLevel[],
    datasources: {
      db: {
        url: config.url,
      },
    },
  });
};

// Prevent multiple instances of Prisma Client in development
export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (!isProduction()) {
  globalThis.prisma = prisma;
}

// Graceful shutdown
const shutdownHandlers = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

shutdownHandlers.forEach((signal) => {
  process.on(signal, async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

export default prisma;

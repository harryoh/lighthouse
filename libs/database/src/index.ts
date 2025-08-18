// Prisma client and types
export { prisma, prisma as default } from './prisma';
export * from '@prisma/client';

// Environment configuration
export {
  env,
  Env,
  isProduction,
  isDevelopment,
  isTest,
  getDatabaseConfig,
  getRedisConfig,
  getAWSConfig,
  getCrawlerConfig,
  getQueueConfig,
} from './config/env';

// Health check utilities
export {
  performHealthCheck,
  healthCheckHandler,
  HealthCheckResult,
  ServiceHealth,
} from './health';

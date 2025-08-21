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

// Services
export { ContentService, contentService } from './services/ContentService';

// Types (explicitly export to avoid ContentVersion naming conflict)
export type {
  ContentInput,
  ContentFilters,
  PaginationOptions,
  SearchOptions,
  PaginatedResponse,
  ContentWithRelations,
  ContentUpdateInput,
  ServiceResponse,
  HashOptions,
  SoftDeleteOptions,
  RestoreOptions,
  VersioningOptions,
  ContentUpdateInputWithVersion,
  VersionDiff,
  CleanupOptions,
  ContentVersion,
} from './types/content.types';

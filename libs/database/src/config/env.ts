import { z } from 'zod';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });

/**
 * Environment variable validation schema using Zod
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().describe('MySQL database connection URL'),

  // Redis
  REDIS_URL: z.string().url().describe('Redis connection URL'),

  // AWS/LocalStack
  AWS_ENDPOINT: z
    .string()
    .url()
    .optional()
    .describe('LocalStack endpoint for local development'),
  AWS_ACCESS_KEY_ID: z.string().default('test').describe('AWS access key ID'),
  AWS_SECRET_ACCESS_KEY: z
    .string()
    .default('test')
    .describe('AWS secret access key'),
  AWS_DEFAULT_REGION: z
    .string()
    .default('us-east-1')
    .describe('AWS default region'),

  // Application
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.string().regex(/^\d+$/).default('3000').transform(Number),

  // Security
  JWT_SECRET: z
    .string()
    .min(32)
    .optional()
    .default('development-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Crawler Configuration
  CRAWLER_USER_AGENT: z
    .string()
    .default(
      'Mozilla/5.0 (compatible; Lighthouse/1.0; +http://lighthouse.com/bot)'
    ),
  CRAWLER_CONCURRENT_REQUESTS: z
    .string()
    .regex(/^\d+$/)
    .default('5')
    .transform(Number),
  CRAWLER_REQUEST_DELAY: z
    .string()
    .regex(/^\d+$/)
    .default('1000')
    .transform(Number), // milliseconds

  // Queue Configuration
  QUEUE_MAX_RETRIES: z.string().regex(/^\d+$/).default('3').transform(Number),
  QUEUE_RETRY_DELAY: z
    .string()
    .regex(/^\d+$/)
    .default('5000')
    .transform(Number), // milliseconds
});

/**
 * Validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 */
function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues;
      const missingVars = issues
        .filter(
          (issue) =>
            issue.code === 'invalid_type' &&
            (issue as z.ZodIssue & { received?: string }).received ===
              'undefined'
        )
        .map((issue) => issue.path.join('.'));

      const invalidVars = issues
        .filter(
          (issue) =>
            !(
              issue.code === 'invalid_type' &&
              (issue as z.ZodIssue & { received?: string }).received ===
                'undefined'
            )
        )
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`);

      console.error('❌ Environment validation failed:');

      if (missingVars.length > 0) {
        console.error('\nMissing required environment variables:');
        missingVars.forEach((varName: string) => {
          console.error(`  - ${varName}`);
        });
      }

      if (invalidVars.length > 0) {
        console.error('\nInvalid environment variables:');
        invalidVars.forEach((msg: string) => {
          console.error(`  - ${msg}`);
        });
      }

      console.error(
        '\n💡 Create a .env file in the project root with the required variables.'
      );
      console.error('   See .env.example for reference.\n');

      process.exit(1);
    }
    throw error;
  }
}

/**
 * Singleton instance of validated environment variables
 */
export const env = validateEnv();

/**
 * Helper function to check if running in production
 */
export const isProduction = () => env.NODE_ENV === 'production';

/**
 * Helper function to check if running in development
 */
export const isDevelopment = () => env.NODE_ENV === 'development';

/**
 * Helper function to check if running in test
 */
export const isTest = () => env.NODE_ENV === 'test';

/**
 * Get database configuration
 */
export const getDatabaseConfig = () => ({
  url: env.DATABASE_URL,
  // Additional Prisma configuration based on environment
  log: isDevelopment() ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Get Redis configuration
 */
export const getRedisConfig = () => ({
  url: env.REDIS_URL,
});

/**
 * Get AWS configuration
 */
export const getAWSConfig = () => ({
  endpoint: env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  region: env.AWS_DEFAULT_REGION,
});

/**
 * Get crawler configuration
 */
export const getCrawlerConfig = () => ({
  userAgent: env.CRAWLER_USER_AGENT,
  concurrentRequests: env.CRAWLER_CONCURRENT_REQUESTS,
  requestDelay: env.CRAWLER_REQUEST_DELAY,
});

/**
 * Get queue configuration
 */
export const getQueueConfig = () => ({
  maxRetries: env.QUEUE_MAX_RETRIES,
  retryDelay: env.QUEUE_RETRY_DELAY,
});

export default env;

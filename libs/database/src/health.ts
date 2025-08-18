import { prisma } from './prisma';
import { env } from './config/env';
import { createClient } from 'redis';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    environment: ServiceHealth;
  };
  version: string;
  uptime: number;
}

export interface ServiceHealth {
  status: 'up' | 'down';
  message?: string;
  responseTime?: number;
  details?: Record<string, any>;
}

/**
 * Check database connectivity and health
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // Execute a simple query to verify connection
    await prisma.$queryRaw`SELECT 1 as health`;
    const responseTime = Date.now() - startTime;

    return {
      status: 'up',
      message: 'Database is healthy',
      responseTime,
      details: {
        connected: true,
        query: 'SELECT 1',
      },
    };
  } catch (error) {
    return {
      status: 'down',
      message: `Database connection failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      responseTime: Date.now() - startTime,
      details: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Check Redis connectivity and health
 */
async function checkRedis(): Promise<ServiceHealth> {
  const startTime = Date.now();
  const redis = createClient({ url: env.REDIS_URL });

  try {
    await redis.connect();
    await redis.ping();
    const responseTime = Date.now() - startTime;

    await redis.quit();

    return {
      status: 'up',
      message: 'Redis is healthy',
      responseTime,
      details: {
        connected: true,
        command: 'PING',
      },
    };
  } catch (error) {
    return {
      status: 'down',
      message: `Redis connection failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      responseTime: Date.now() - startTime,
      details: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  } finally {
    try {
      await redis.quit();
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check environment configuration
 */
function checkEnvironment(): ServiceHealth {
  const requiredVars = ['DATABASE_URL', 'REDIS_URL'];
  const missingVars = requiredVars.filter(
    (varName) => !env[varName as keyof typeof env]
  );

  if (missingVars.length > 0) {
    return {
      status: 'down',
      message: `Missing required environment variables: ${missingVars.join(
        ', '
      )}`,
      details: {
        missingVars,
        nodeEnv: env.NODE_ENV,
      },
    };
  }

  return {
    status: 'up',
    message: 'Environment configured correctly',
    details: {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      awsEndpoint: env.AWS_ENDPOINT,
    },
  };
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const [database, redis] = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
  ]);

  const environment = checkEnvironment();

  const getDatabaseResult = (): ServiceHealth => {
    if (database.status === 'fulfilled') {
      return database.value;
    }
    return {
      status: 'down',
      message: 'Database check failed',
      details: { error: 'Promise rejected' },
    };
  };

  const getRedisResult = (): ServiceHealth => {
    if (redis.status === 'fulfilled') {
      return redis.value;
    }
    return {
      status: 'down',
      message: 'Redis check failed',
      details: { error: 'Promise rejected' },
    };
  };

  const databaseHealth = getDatabaseResult();
  const redisHealth = getRedisResult();

  const isHealthy =
    databaseHealth.status === 'up' &&
    redisHealth.status === 'up' &&
    environment.status === 'up';

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date(),
    services: {
      database: databaseHealth,
      redis: redisHealth,
      environment,
    },
    version: '1.0.0',
    uptime: process.uptime(),
  };
}

/**
 * Express middleware for health check endpoint
 */
export async function healthCheckHandler(_req: any, res: any) {
  try {
    const health = await performHealthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

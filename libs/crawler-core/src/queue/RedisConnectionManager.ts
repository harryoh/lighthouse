/**
 * Redis connection manager for queue system
 */

import { Redis } from 'ioredis';
import * as winston from 'winston';
import { QueueHealth } from './QueueInterface';

/**
 * Redis connection configuration
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  retryStrategy?: (times: number) => number | void;
  reconnectOnError?: (err: Error) => boolean | 1 | 2;
  lazyConnect?: boolean;
  keepAlive?: number;
  connectionName?: string;
}

/**
 * Connection pool options
 */
export interface ConnectionPoolOptions {
  min?: number;
  max?: number;
  acquireTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  healthCheckIntervalMillis?: number;
}

/**
 * Manages Redis connections with pooling and health checks
 */
export class RedisConnectionManager {
  private connections: Map<string, Redis> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private logger: winston.Logger;
  private defaultConfig: Partial<RedisConfig>;
  private isShuttingDown = false;

  constructor(defaultConfig?: Partial<RedisConfig>, logger?: winston.Logger) {
    this.defaultConfig = defaultConfig || {};
    this.logger = logger || this.createDefaultLogger();
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): winston.Logger {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'RedisConnectionManager' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  /**
   * Create a new Redis connection
   */
  public createConnection(name: string, config?: RedisConfig): Redis {
    if (this.connections.has(name)) {
      this.logger.warn(`Connection ${name} already exists`);
      return this.connections.get(name)!;
    }

    const finalConfig = {
      ...this.defaultConfig,
      ...config,
      connectionName: name,
      retryStrategy:
        config?.retryStrategy || this.defaultRetryStrategy.bind(this),
      reconnectOnError:
        config?.reconnectOnError || this.defaultReconnectOnError.bind(this),
      enableReadyCheck: config?.enableReadyCheck ?? true,
      lazyConnect: config?.lazyConnect ?? false,
      keepAlive: config?.keepAlive ?? 30000,
    };

    const redis = new Redis(finalConfig as any);

    // Set up event handlers
    this.setupEventHandlers(redis, name);

    this.connections.set(name, redis);
    this.logger.info(`Created Redis connection: ${name}`);

    return redis;
  }

  /**
   * Default retry strategy
   */
  private defaultRetryStrategy(times: number): number | void {
    if (this.isShuttingDown) {
      return;
    }

    const maxRetryTime = 1000 * 60 * 2; // 2 minutes
    const retryTime = Math.min(times * 1000, maxRetryTime);

    this.logger.warn(
      `Redis reconnection attempt ${times}, retrying in ${retryTime}ms`
    );
    return retryTime;
  }

  /**
   * Default reconnect on error handler
   */
  private defaultReconnectOnError(err: Error): boolean {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];

    if (targetErrors.some((targetError) => err.message.includes(targetError))) {
      this.logger.warn(`Reconnecting due to error: ${err.message}`);
      return true;
    }

    return false;
  }

  /**
   * Set up event handlers for a Redis connection
   */
  private setupEventHandlers(redis: Redis, name: string): void {
    redis.on('connect', () => {
      this.logger.info(`Redis connection ${name} connected`);
    });

    redis.on('ready', () => {
      this.logger.info(`Redis connection ${name} ready`);
    });

    redis.on('error', (error: Error) => {
      this.logger.error(`Redis connection ${name} error:`, error);
    });

    redis.on('close', () => {
      this.logger.warn(`Redis connection ${name} closed`);
    });

    redis.on('reconnecting', (delay: number) => {
      this.logger.info(`Redis connection ${name} reconnecting in ${delay}ms`);
    });

    redis.on('end', () => {
      this.logger.info(`Redis connection ${name} ended`);
    });
  }

  /**
   * Get a connection by name
   */
  public getConnection(name: string): Redis | undefined {
    return this.connections.get(name);
  }

  /**
   * Get or create a connection
   */
  public getOrCreateConnection(name: string, config?: RedisConfig): Redis {
    const existing = this.connections.get(name);
    if (existing) {
      return existing;
    }

    return this.createConnection(name, config);
  }

  /**
   * Check health of a specific connection
   */
  public async checkConnectionHealth(name: string): Promise<boolean> {
    const redis = this.connections.get(name);
    if (!redis) {
      this.logger.warn(`Connection ${name} not found`);
      return false;
    }

    try {
      const result = await redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error(`Health check failed for connection ${name}:`, error);
      return false;
    }
  }

  /**
   * Perform health check on all connections
   */
  public async healthCheck(): Promise<QueueHealth> {
    const health: QueueHealth = {
      isConnected: false,
      lastHealthCheck: new Date(),
    };

    try {
      // Check all connections
      const connectionChecks = await Promise.all(
        Array.from(this.connections.keys()).map((name) =>
          this.checkConnectionHealth(name)
        )
      );

      health.isConnected = connectionChecks.every((check) => check);

      // Get Redis info from first available connection
      const firstConnection = Array.from(this.connections.values())[0];
      if (firstConnection && health.isConnected) {
        const info = await firstConnection.info();
        const infoLines = info.split('\r\n');

        health.redisInfo = {
          version: this.extractInfoValue(infoLines, 'redis_version'),
          usedMemory: this.extractInfoValue(infoLines, 'used_memory_human'),
          connectedClients: parseInt(
            this.extractInfoValue(infoLines, 'connected_clients') || '0'
          ),
          uptimeInSeconds: parseInt(
            this.extractInfoValue(infoLines, 'uptime_in_seconds') || '0'
          ),
        };
      }
    } catch (error) {
      health.isConnected = false;
      health.error = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Health check failed:', error);
    }

    return health;
  }

  /**
   * Extract value from Redis INFO output
   */
  private extractInfoValue(
    infoLines: string[],
    key: string
  ): string | undefined {
    const line = infoLines.find((l) => l.startsWith(`${key}:`));
    return line ? line.split(':')[1]?.trim() : undefined;
  }

  /**
   * Start periodic health checks
   */
  public startHealthChecks(intervalMs = 30000): void {
    if (this.healthCheckInterval) {
      this.logger.warn('Health checks already running');
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      const health = await this.healthCheck();
      if (!health.isConnected) {
        this.logger.error('Redis health check failed', health.error);
      } else {
        this.logger.debug('Redis health check passed');
      }
    }, intervalMs);

    this.logger.info(`Started health checks with interval ${intervalMs}ms`);
  }

  /**
   * Stop periodic health checks
   */
  public stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      this.logger.info('Stopped health checks');
    }
  }

  /**
   * Close a specific connection
   */
  public async closeConnection(name: string): Promise<void> {
    const redis = this.connections.get(name);
    if (!redis) {
      this.logger.warn(`Connection ${name} not found`);
      return;
    }

    await redis.quit();
    this.connections.delete(name);
    this.logger.info(`Closed connection ${name}`);
  }

  /**
   * Close all connections
   */
  public async closeAll(): Promise<void> {
    this.isShuttingDown = true;
    this.stopHealthChecks();

    const promises = Array.from(this.connections.entries()).map(
      async ([name, redis]) => {
        try {
          await redis.quit();
          this.logger.info(`Closed connection ${name}`);
        } catch (error) {
          this.logger.error(`Error closing connection ${name}:`, error);
        }
      }
    );

    await Promise.all(promises);
    this.connections.clear();
    this.logger.info('All Redis connections closed');
  }

  /**
   * Get all connection names
   */
  public getConnectionNames(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get connection count
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Test connection with config
   */
  public async testConnection(config: RedisConfig): Promise<boolean> {
    try {
      const testRedis = new Redis({
        ...config,
        lazyConnect: true,
        enableReadyCheck: true,
        maxRetriesPerRequest: 1,
      });

      await testRedis.connect();
      const result = await testRedis.ping();
      await testRedis.quit();

      return result === 'PONG';
    } catch (error) {
      this.logger.error('Connection test failed:', error);
      return false;
    }
  }
}

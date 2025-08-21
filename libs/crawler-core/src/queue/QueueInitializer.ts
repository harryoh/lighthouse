/**
 * Queue system initializer for application startup
 */

import * as winston from 'winston';
import { QueueFactory } from './QueueFactory';
import { RedisConnectionManager, RedisConfig } from './RedisConnectionManager';
import { QueueManager } from './QueueManager';
import {
  ExtendedQueueConfig,
  CrawlJobProcessor,
  AnalysisJobProcessor,
  ScheduledJobProcessor,
} from './QueueInterface';

/**
 * Application configuration for queue system
 */
export interface QueueSystemConfig {
  redis: RedisConfig;
  queues?: {
    crawl?: {
      enabled?: boolean;
      concurrency?: number;
      maxAttempts?: number;
    };
    analysis?: {
      enabled?: boolean;
      concurrency?: number;
      maxAttempts?: number;
    };
    scheduled?: {
      enabled?: boolean;
      concurrency?: number;
      maxAttempts?: number;
    };
  };
  deadLetterQueue?: {
    enabled?: boolean;
    maxRetries?: number;
    ttl?: number;
  };
  healthCheck?: {
    enabled?: boolean;
    intervalMs?: number;
  };
  enableMetrics?: boolean;
}

/**
 * Job processors configuration
 */
export interface JobProcessors {
  crawl?: CrawlJobProcessor;
  analysis?: AnalysisJobProcessor;
  scheduled?: ScheduledJobProcessor;
}

/**
 * Initializes and manages the queue system
 */
export class QueueInitializer {
  private queueFactory: QueueFactory;
  private redisManager: RedisConnectionManager;
  private queueManagers: Map<string, QueueManager> = new Map();
  private logger: winston.Logger;
  private config?: QueueSystemConfig;
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(logger?: winston.Logger) {
    this.logger = logger || this.createDefaultLogger();
    this.queueFactory = new QueueFactory(this.logger);
    this.redisManager = new RedisConnectionManager(undefined, this.logger);
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
      defaultMeta: { service: 'QueueInitializer' },
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
   * Initialize the queue system
   */
  public async initialize(
    config: QueueSystemConfig,
    processors?: JobProcessors
  ): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Queue system already initialized');
      return;
    }

    this.config = config;
    this.logger.info('Initializing queue system...');

    try {
      // 1. Setup Redis connections
      await this.setupRedisConnections();

      // 2. Create queues
      await this.createQueues();

      // 3. Setup workers with processors
      if (processors) {
        await this.setupWorkers(processors);
      }

      // 4. Start health monitoring
      if (config.healthCheck?.enabled) {
        await this.startHealthMonitoring(config.healthCheck.intervalMs);
      }

      // 5. Load scheduled jobs from database (if needed)
      // This would be implemented based on your database schema
      // await this.loadScheduledJobs();

      this.isInitialized = true;
      this.logger.info('Queue system initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize queue system:', error);
      await this.shutdown();
      throw error;
    }
  }

  /**
   * Setup Redis connections
   */
  private async setupRedisConnections(): Promise<void> {
    if (!this.config?.redis) {
      throw new Error('Redis configuration is required');
    }

    // Create main Redis connection
    this.redisManager.createConnection('main', this.config.redis);

    // Test connection
    const isConnected = await this.redisManager.checkConnectionHealth('main');
    if (!isConnected) {
      throw new Error('Failed to connect to Redis');
    }

    this.logger.info('Redis connections established');
  }

  /**
   * Create all required queues
   */
  private async createQueues(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not set');
    }

    const baseConfig: ExtendedQueueConfig = {
      name: 'lighthouse',
      connection: this.config.redis,
      enableMetrics: this.config.enableMetrics,
      deadLetterQueue: this.config.deadLetterQueue,
    };

    // Create crawl queue
    if (this.config.queues?.crawl?.enabled !== false) {
      const crawlConfig: ExtendedQueueConfig = {
        ...baseConfig,
        queueType: 'crawl',
        defaultJobOptions: {
          attempts: this.config.queues?.crawl?.maxAttempts || 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
        workerOptions: {
          concurrency: this.config.queues?.crawl?.concurrency || 5,
        },
      };

      this.queueFactory.createCrawlQueue(crawlConfig);

      const crawlManager = new QueueManager(crawlConfig, this.logger);
      this.queueManagers.set('crawl', crawlManager);

      this.logger.info('Crawl queue created');
    }

    // Create analysis queue
    if (this.config.queues?.analysis?.enabled !== false) {
      const analysisConfig: ExtendedQueueConfig = {
        ...baseConfig,
        queueType: 'analysis',
        defaultJobOptions: {
          attempts: this.config.queues?.analysis?.maxAttempts || 2,
          backoff: {
            type: 'fixed',
            delay: 3000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
        workerOptions: {
          concurrency: this.config.queues?.analysis?.concurrency || 10,
        },
      };

      this.queueFactory.createAnalysisQueue(analysisConfig);

      const analysisManager = new QueueManager(analysisConfig, this.logger);
      this.queueManagers.set('analysis', analysisManager);

      this.logger.info('Analysis queue created');
    }

    // Create scheduled queue
    if (this.config.queues?.scheduled?.enabled !== false) {
      const scheduledConfig: ExtendedQueueConfig = {
        ...baseConfig,
        queueType: 'scheduled',
        defaultJobOptions: {
          attempts: this.config.queues?.scheduled?.maxAttempts || 1,
          removeOnComplete: 50,
          removeOnFail: 25,
        },
        workerOptions: {
          concurrency: this.config.queues?.scheduled?.concurrency || 2,
        },
      };

      this.queueFactory.createScheduledQueue(scheduledConfig);

      const scheduledManager = new QueueManager(scheduledConfig, this.logger);
      this.queueManagers.set('scheduled', scheduledManager);

      this.logger.info('Scheduled queue created');
    }

    // Create dead letter queue
    if (this.config.deadLetterQueue?.enabled) {
      this.queueFactory.createDeadLetterQueue(baseConfig);
      this.logger.info('Dead letter queue created');
    }
  }

  /**
   * Setup workers with processors
   */
  private async setupWorkers(processors: JobProcessors): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not set');
    }

    const baseConfig: ExtendedQueueConfig = {
      name: 'lighthouse',
      connection: this.config.redis,
    };

    // Setup crawl worker
    if (processors.crawl && this.config.queues?.crawl?.enabled !== false) {
      const crawlConfig: ExtendedQueueConfig = {
        ...baseConfig,
        workerOptions: {
          concurrency: this.config.queues?.crawl?.concurrency || 5,
        },
      };

      this.queueFactory.createCrawlWorker(crawlConfig, processors.crawl);
      this.logger.info('Crawl worker started');
    }

    // Setup analysis worker
    if (
      processors.analysis &&
      this.config.queues?.analysis?.enabled !== false
    ) {
      const analysisConfig: ExtendedQueueConfig = {
        ...baseConfig,
        workerOptions: {
          concurrency: this.config.queues?.analysis?.concurrency || 10,
        },
      };

      this.queueFactory.createAnalysisWorker(
        analysisConfig,
        processors.analysis
      );
      this.logger.info('Analysis worker started');
    }

    // Setup scheduled worker
    if (
      processors.scheduled &&
      this.config.queues?.scheduled?.enabled !== false
    ) {
      const scheduledConfig: ExtendedQueueConfig = {
        ...baseConfig,
        workerOptions: {
          concurrency: this.config.queues?.scheduled?.concurrency || 2,
        },
      };

      this.queueFactory.createScheduledWorker(
        scheduledConfig,
        processors.scheduled
      );
      this.logger.info('Scheduled worker started');
    }
  }

  /**
   * Start health monitoring
   */
  private async startHealthMonitoring(intervalMs = 30000): Promise<void> {
    // Initial health check
    await this.performHealthCheck();

    // Start periodic health checks
    this.redisManager.startHealthChecks(intervalMs);

    // Monitor queue metrics
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);

    this.logger.info(`Health monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const redisHealth = await this.redisManager.healthCheck();
      const queueMetrics = await this.queueFactory.getAllMetrics();

      if (!redisHealth.isConnected) {
        this.logger.error('Redis health check failed', redisHealth.error);
      }

      this.logger.debug('Health check completed', {
        redis: redisHealth,
        queues: queueMetrics,
      });
    } catch (error) {
      this.logger.error('Health check error:', error);
    }
  }

  /**
   * Get queue manager by type
   */
  public getQueueManager(
    type: 'crawl' | 'analysis' | 'scheduled'
  ): QueueManager | undefined {
    return this.queueManagers.get(type);
  }

  /**
   * Get queue factory
   */
  public getQueueFactory(): QueueFactory {
    return this.queueFactory;
  }

  /**
   * Get Redis connection manager
   */
  public getRedisManager(): RedisConnectionManager {
    return this.redisManager;
  }

  /**
   * Check if system is initialized
   */
  public isSystemInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get system metrics
   */
  public async getSystemMetrics(): Promise<{
    redis: any;
    queues: any;
    managers: Record<string, any>;
  }> {
    const redisHealth = await this.redisManager.healthCheck();
    const queueMetrics = await this.queueFactory.getAllMetrics();

    const managerMetrics: Record<string, any> = {};
    for (const [name, manager] of this.queueManagers) {
      managerMetrics[name] = await manager.getExtendedMetrics();
    }

    return {
      redis: redisHealth,
      queues: queueMetrics,
      managers: managerMetrics,
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down queue system...');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    this.redisManager.stopHealthChecks();

    // Close queue managers
    for (const [name, manager] of this.queueManagers) {
      try {
        await manager.close();
        this.logger.info(`Closed queue manager: ${name}`);
      } catch (error) {
        this.logger.error(`Error closing queue manager ${name}:`, error);
      }
    }
    this.queueManagers.clear();

    // Close all queues and workers
    await this.queueFactory.closeAll();

    // Close Redis connections
    await this.redisManager.closeAll();

    this.isInitialized = false;
    this.logger.info('Queue system shutdown complete');
  }

  /**
   * Pause all queues
   */
  public async pauseAll(): Promise<void> {
    await this.queueFactory.pauseAll();
    for (const manager of this.queueManagers.values()) {
      await manager.pause();
    }
    this.logger.info('All queues paused');
  }

  /**
   * Resume all queues
   */
  public async resumeAll(): Promise<void> {
    await this.queueFactory.resumeAll();
    for (const manager of this.queueManagers.values()) {
      await manager.resume();
    }
    this.logger.info('All queues resumed');
  }
}

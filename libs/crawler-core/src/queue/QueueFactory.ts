/**
 * Factory for creating and managing different types of queues
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import * as winston from 'winston';
import {
  CrawlJobData,
  CrawlJobResult,
  AnalysisJobData,
  AnalysisJobResult,
  ScheduledCrawlJobData,
  ExtendedQueueConfig,
  CrawlJobProcessor,
  AnalysisJobProcessor,
  ScheduledJobProcessor,
} from './QueueInterface';

/**
 * Factory for creating and managing multiple queue types
 */
export class QueueFactory {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private logger: winston.Logger;

  constructor(logger?: winston.Logger) {
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
      defaultMeta: { service: 'QueueFactory' },
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
   * Create a crawl queue
   */
  public createCrawlQueue(
    config: ExtendedQueueConfig
  ): Queue<CrawlJobData, CrawlJobResult> {
    const queueName = `${config.name}-crawl`;

    if (this.queues.has(queueName)) {
      this.logger.warn(`Queue ${queueName} already exists`);
      return this.queues.get(queueName) as Queue<CrawlJobData, CrawlJobResult>;
    }

    const queue = new Queue<CrawlJobData, CrawlJobResult>(queueName, {
      connection: config.connection,
      defaultJobOptions: {
        ...config.defaultJobOptions,
        attempts: config.defaultJobOptions?.attempts || 3,
        backoff: config.defaultJobOptions?.backoff || {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    this.queues.set(queueName, queue);
    this.createQueueEvents(queueName, config);

    this.logger.info(`Created crawl queue: ${queueName}`);
    return queue;
  }

  /**
   * Create an analysis queue
   */
  public createAnalysisQueue(
    config: ExtendedQueueConfig
  ): Queue<AnalysisJobData, AnalysisJobResult> {
    const queueName = `${config.name}-analysis`;

    if (this.queues.has(queueName)) {
      this.logger.warn(`Queue ${queueName} already exists`);
      return this.queues.get(queueName) as Queue<
        AnalysisJobData,
        AnalysisJobResult
      >;
    }

    const queue = new Queue<AnalysisJobData, AnalysisJobResult>(queueName, {
      connection: config.connection,
      defaultJobOptions: {
        ...config.defaultJobOptions,
        attempts: config.defaultJobOptions?.attempts || 2,
        backoff: config.defaultJobOptions?.backoff || {
          type: 'fixed',
          delay: 3000,
        },
      },
    });

    this.queues.set(queueName, queue);
    this.createQueueEvents(queueName, config);

    this.logger.info(`Created analysis queue: ${queueName}`);
    return queue;
  }

  /**
   * Create a scheduled queue
   */
  public createScheduledQueue(
    config: ExtendedQueueConfig
  ): Queue<ScheduledCrawlJobData, CrawlJobResult> {
    const queueName = `${config.name}-scheduled`;

    if (this.queues.has(queueName)) {
      this.logger.warn(`Queue ${queueName} already exists`);
      return this.queues.get(queueName) as Queue<
        ScheduledCrawlJobData,
        CrawlJobResult
      >;
    }

    const queue = new Queue<ScheduledCrawlJobData, CrawlJobResult>(queueName, {
      connection: config.connection,
      defaultJobOptions: {
        ...config.defaultJobOptions,
        attempts: config.defaultJobOptions?.attempts || 1,
        removeOnComplete: config.defaultJobOptions?.removeOnComplete ?? {
          count: 100,
        },
        removeOnFail: config.defaultJobOptions?.removeOnFail ?? { count: 50 },
      },
    });

    this.queues.set(queueName, queue);
    this.createQueueEvents(queueName, config);

    this.logger.info(`Created scheduled queue: ${queueName}`);
    return queue;
  }

  /**
   * Create a dead letter queue
   */
  public createDeadLetterQueue(
    config: ExtendedQueueConfig
  ): Queue<unknown, unknown> {
    const queueName = `${config.name}-dlq`;

    if (this.queues.has(queueName)) {
      this.logger.warn(`Queue ${queueName} already exists`);
      return this.queues.get(queueName) as Queue<unknown, unknown>;
    }

    const queue = new Queue(queueName, {
      connection: config.connection,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 1,
      },
    });

    this.queues.set(queueName, queue);
    this.createQueueEvents(queueName, config);

    this.logger.info(`Created dead letter queue: ${queueName}`);
    return queue;
  }

  /**
   * Create queue events for monitoring
   */
  private createQueueEvents(
    queueName: string,
    config: ExtendedQueueConfig
  ): void {
    const events = new QueueEvents(queueName, {
      connection: config.connection,
    });

    this.queueEvents.set(queueName, events);

    // Set up event listeners for monitoring
    events.on('completed', ({ jobId }) => {
      this.logger.debug(`Job ${jobId} completed in queue ${queueName}`);
    });

    events.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(
        `Job ${jobId} failed in queue ${queueName}: ${failedReason}`
      );
    });

    events.on('stalled', ({ jobId }) => {
      this.logger.warn(`Job ${jobId} stalled in queue ${queueName}`);
    });
  }

  /**
   * Create a worker for crawl queue
   */
  public createCrawlWorker(
    config: ExtendedQueueConfig,
    processor: CrawlJobProcessor
  ): Worker<CrawlJobData, CrawlJobResult> {
    const queueName = `${config.name}-crawl`;
    const workerName = `${queueName}-worker`;

    if (this.workers.has(workerName)) {
      this.logger.warn(`Worker ${workerName} already exists`);
      return this.workers.get(workerName) as Worker<
        CrawlJobData,
        CrawlJobResult
      >;
    }

    const worker = new Worker<CrawlJobData, CrawlJobResult>(
      queueName,
      processor,
      {
        connection: config.connection,
        concurrency: config.workerOptions?.concurrency || 5,
        maxStalledCount: config.workerOptions?.maxStalledCount || 3,
        stalledInterval: config.workerOptions?.stalledInterval || 30000,
      }
    );

    this.setupWorkerEventHandlers(worker, workerName);
    this.workers.set(workerName, worker);

    this.logger.info(`Created crawl worker: ${workerName}`);
    return worker;
  }

  /**
   * Create a worker for analysis queue
   */
  public createAnalysisWorker(
    config: ExtendedQueueConfig,
    processor: AnalysisJobProcessor
  ): Worker<AnalysisJobData, AnalysisJobResult> {
    const queueName = `${config.name}-analysis`;
    const workerName = `${queueName}-worker`;

    if (this.workers.has(workerName)) {
      this.logger.warn(`Worker ${workerName} already exists`);
      return this.workers.get(workerName) as Worker<
        AnalysisJobData,
        AnalysisJobResult
      >;
    }

    const worker = new Worker<AnalysisJobData, AnalysisJobResult>(
      queueName,
      processor,
      {
        connection: config.connection,
        concurrency: config.workerOptions?.concurrency || 10,
        maxStalledCount: config.workerOptions?.maxStalledCount || 2,
        stalledInterval: config.workerOptions?.stalledInterval || 20000,
      }
    );

    this.setupWorkerEventHandlers(worker, workerName);
    this.workers.set(workerName, worker);

    this.logger.info(`Created analysis worker: ${workerName}`);
    return worker;
  }

  /**
   * Create a worker for scheduled queue
   */
  public createScheduledWorker(
    config: ExtendedQueueConfig,
    processor: ScheduledJobProcessor
  ): Worker<ScheduledCrawlJobData, CrawlJobResult> {
    const queueName = `${config.name}-scheduled`;
    const workerName = `${queueName}-worker`;

    if (this.workers.has(workerName)) {
      this.logger.warn(`Worker ${workerName} already exists`);
      return this.workers.get(workerName) as Worker<
        ScheduledCrawlJobData,
        CrawlJobResult
      >;
    }

    const worker = new Worker<ScheduledCrawlJobData, CrawlJobResult>(
      queueName,
      processor,
      {
        connection: config.connection,
        concurrency: config.workerOptions?.concurrency || 2,
        maxStalledCount: config.workerOptions?.maxStalledCount || 1,
        stalledInterval: config.workerOptions?.stalledInterval || 60000,
      }
    );

    this.setupWorkerEventHandlers(worker, workerName);
    this.workers.set(workerName, worker);

    this.logger.info(`Created scheduled worker: ${workerName}`);
    return worker;
  }

  /**
   * Set up common worker event handlers
   */
  private setupWorkerEventHandlers(worker: Worker, workerName: string): void {
    worker.on('completed', (job) => {
      this.logger.info(`Worker ${workerName}: Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
      this.logger.error(`Worker ${workerName}: Job ${job?.id} failed`, {
        error: error.message,
        stack: error.stack,
      });
    });

    worker.on('active', (job) => {
      this.logger.debug(`Worker ${workerName}: Job ${job.id} started`);
    });

    worker.on('stalled', (jobId) => {
      this.logger.warn(`Worker ${workerName}: Job ${jobId} stalled`);
    });

    worker.on('error', (error) => {
      this.logger.error(`Worker ${workerName} error:`, error);
    });
  }

  /**
   * Get a queue by name
   */
  public getQueue(queueName: string): Queue | undefined {
    return this.queues.get(queueName);
  }

  /**
   * Get a worker by name
   */
  public getWorker(workerName: string): Worker | undefined {
    return this.workers.get(workerName);
  }

  /**
   * Get all queues
   */
  public getAllQueues(): Map<string, Queue> {
    return this.queues;
  }

  /**
   * Get all workers
   */
  public getAllWorkers(): Map<string, Worker> {
    return this.workers;
  }

  /**
   * Pause all queues
   */
  public async pauseAll(): Promise<void> {
    const promises = Array.from(this.queues.values()).map((queue) =>
      queue.pause()
    );
    await Promise.all(promises);
    this.logger.info('All queues paused');
  }

  /**
   * Resume all queues
   */
  public async resumeAll(): Promise<void> {
    const promises = Array.from(this.queues.values()).map((queue) =>
      queue.resume()
    );
    await Promise.all(promises);
    this.logger.info('All queues resumed');
  }

  /**
   * Close all queues, workers, and event listeners
   */
  public async closeAll(): Promise<void> {
    // Close all workers first
    const workerPromises = Array.from(this.workers.values()).map((worker) =>
      worker.close()
    );
    await Promise.all(workerPromises);
    this.workers.clear();

    // Close all queue events
    const eventPromises = Array.from(this.queueEvents.values()).map((events) =>
      events.close()
    );
    await Promise.all(eventPromises);
    this.queueEvents.clear();

    // Close all queues
    const queuePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close()
    );
    await Promise.all(queuePromises);
    this.queues.clear();

    this.logger.info('All queues, workers, and events closed');
  }

  /**
   * Get metrics for all queues
   */
  public async getAllMetrics(): Promise<Record<string, unknown>> {
    const metrics: Record<string, unknown> = {};

    for (const [name, queue] of this.queues) {
      const [waiting, active, completed, failed, delayed, paused] =
        await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.isPaused(),
        ]);

      metrics[name] = {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
      };
    }

    return metrics;
  }
}

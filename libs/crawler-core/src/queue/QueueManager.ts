/**
 * Queue manager implementation using BullMQ
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import * as winston from 'winston';
import {
  IQueueManager,
  IQueueEventListener,
  CrawlJobData,
  CrawlJobResult,
  CrawlJobProcessor,
  QueueConfig,
  QueueEventType,
} from './QueueInterface';

export class QueueManager implements IQueueManager, IQueueEventListener {
  private queue: Queue<CrawlJobData, CrawlJobResult>;
  private worker?: Worker<CrawlJobData, CrawlJobResult>;
  private queueEvents: QueueEvents;
  private logger: winston.Logger;
  private config: QueueConfig;

  constructor(config: QueueConfig, logger?: winston.Logger) {
    this.config = config;
    this.logger = logger || this.createDefaultLogger();

    // Initialize queue
    this.queue = new Queue<CrawlJobData, CrawlJobResult>(config.name, {
      connection: config.connection,
      defaultJobOptions: config.defaultJobOptions,
    });

    // Initialize queue events
    this.queueEvents = new QueueEvents(config.name, {
      connection: config.connection,
    });

    this.logger.info(`Queue manager initialized for queue: ${config.name}`);
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
      defaultMeta: { service: 'QueueManager', queue: this.config.name },
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
   * Start worker to process jobs
   */
  public startWorker(processor: CrawlJobProcessor): void {
    if (this.worker) {
      this.logger.warn('Worker already started');
      return;
    }

    this.worker = new Worker<CrawlJobData, CrawlJobResult>(
      this.config.name,
      processor,
      {
        connection: this.config.connection,
        ...this.config.workerOptions,
      }
    );

    // Set up worker event handlers
    this.worker.on('completed', (job) => {
      this.logger.info(`Job ${job.id} completed successfully`, {
        sourceId: job.data.sourceId,
        duration:
          job.finishedOn && job.processedOn
            ? job.finishedOn - job.processedOn
            : 0,
      });
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed`, {
        sourceId: job?.data.sourceId,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('active', (job) => {
      this.logger.debug(`Job ${job.id} started`, {
        sourceId: job.data.sourceId,
      });
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled`);
    });

    this.logger.info('Worker started');
  }

  /**
   * Stop worker
   */
  public async stopWorker(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.worker.close();
    this.worker = undefined;
    this.logger.info('Worker stopped');
  }

  /**
   * Add a crawl job to the queue
   */
  public async addCrawlJob(
    data: CrawlJobData
  ): Promise<Job<CrawlJobData, CrawlJobResult>> {
    const job = await this.queue.add(`crawl-${data.sourceId}`, data, {
      priority: data.priority,
      attempts: data.attempts || this.config.defaultJobOptions?.attempts,
      delay: data.delay,
    });

    this.logger.info(`Job ${job.id} added to queue`, {
      sourceId: data.sourceId,
      priority: data.priority,
    });

    return job;
  }

  /**
   * Get job by ID
   */
  public async getJob(
    jobId: string
  ): Promise<Job<CrawlJobData, CrawlJobResult> | undefined> {
    return await this.queue.getJob(jobId);
  }

  /**
   * Get all jobs with specific status
   */
  public async getJobs(
    status: 'waiting' | 'active' | 'completed' | 'failed'
  ): Promise<Job<CrawlJobData, CrawlJobResult>[]> {
    switch (status) {
      case 'waiting':
        return await this.queue.getWaiting();
      case 'active':
        return await this.queue.getActive();
      case 'completed':
        return await this.queue.getCompleted();
      case 'failed':
        return await this.queue.getFailed();
      default:
        return [];
    }
  }

  /**
   * Remove a job from the queue
   */
  public async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.info(`Job ${jobId} removed from queue`);
    }
  }

  /**
   * Pause the queue
   */
  public async pause(): Promise<void> {
    await this.queue.pause();
    this.logger.info('Queue paused');
  }

  /**
   * Resume the queue
   */
  public async resume(): Promise<void> {
    await this.queue.resume();
    this.logger.info('Queue resumed');
  }

  /**
   * Clean jobs with specific status
   */
  public async clean(
    grace: number,
    limit: number,
    status?: 'completed' | 'failed'
  ): Promise<string[]> {
    const jobs = await this.queue.clean(grace, limit, status);
    this.logger.info(`Cleaned ${jobs.length} jobs`, { status, grace, limit });
    return jobs;
  }

  /**
   * Get queue metrics
   */
  public async getMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    const [waiting, active, completed, failed, delayed, paused] =
      await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
        this.queue.isPaused(),
      ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
    };
  }

  /**
   * Add event listener
   */
  public on(
    event: QueueEventType,
    callback: (...args: unknown[]) => void
  ): void {
    this.queueEvents.on(event, callback);
  }

  /**
   * Remove event listener
   */
  public off(
    event: QueueEventType,
    callback: (...args: unknown[]) => void
  ): void {
    this.queueEvents.off(event, callback);
  }

  /**
   * Close queue connections
   */
  public async close(): Promise<void> {
    await this.stopWorker();
    await this.queueEvents.close();
    await this.queue.close();
    this.logger.info('Queue manager closed');
  }
}

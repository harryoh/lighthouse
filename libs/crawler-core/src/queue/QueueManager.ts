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
  ScheduledCrawlJobData,
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

  /**
   * Add a scheduled crawl job
   */
  public async addScheduledJob(
    data: ScheduledCrawlJobData
  ): Promise<Job<ScheduledCrawlJobData, CrawlJobResult>> {
    // Calculate next run time based on cron expression
    const jobOptions = {
      repeat: {
        pattern: data.schedule,
        tz: data.timezone || 'UTC',
      },
      priority: data.priority,
      attempts: data.attempts || this.config.defaultJobOptions?.attempts,
    };

    const job = await this.queue.add(
      `scheduled-${data.sourceId}`,
      data as unknown as CrawlJobData,
      jobOptions
    );

    this.logger.info(`Scheduled job ${job.id} added`, {
      sourceId: data.sourceId,
      schedule: data.schedule,
      timezone: data.timezone,
    });

    return job as unknown as Job<ScheduledCrawlJobData, CrawlJobResult>;
  }

  /**
   * Update schedule for an existing job
   */
  public async updateSchedule(
    jobId: string,
    schedule: string,
    timezone?: string
  ): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Remove old job
    await job.remove();

    // Create new job with updated schedule
    const data = job.data as unknown as ScheduledCrawlJobData;
    data.schedule = schedule;
    if (timezone) {
      data.timezone = timezone;
    }

    await this.addScheduledJob(data);
    this.logger.info(`Updated schedule for job ${jobId}`);
  }

  /**
   * Get all scheduled jobs
   */
  public async getScheduledJobs(): Promise<
    Job<ScheduledCrawlJobData, CrawlJobResult>[]
  > {
    const jobs = await this.queue.getRepeatableJobs();
    const scheduledJobs: Job<ScheduledCrawlJobData, CrawlJobResult>[] = [];

    for (const repeatableJob of jobs) {
      if (repeatableJob.id) {
        const job = await this.queue.getJob(repeatableJob.id);
        if (job) {
          scheduledJobs.push(
            job as unknown as Job<ScheduledCrawlJobData, CrawlJobResult>
          );
        }
      }
    }

    return scheduledJobs;
  }

  /**
   * Move a failed job to dead letter queue
   */
  public async moveToDeadLetter(
    job: Job<CrawlJobData, CrawlJobResult>,
    dlqName?: string
  ): Promise<void> {
    const deadLetterQueueName = dlqName || `${this.config.name}-dlq`;

    // Create dead letter queue if it doesn't exist
    const dlq = new Queue(deadLetterQueueName, {
      connection: this.config.connection,
    });

    // Add job to DLQ with original data and failure information
    await dlq.add('failed-job', {
      originalJobId: job.id,
      originalData: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      stacktrace: job.stacktrace,
      movedToDLQAt: new Date(),
    });

    // Remove from original queue
    await job.remove();

    this.logger.warn(`Job ${job.id} moved to dead letter queue`, {
      sourceId: job.data.sourceId,
      failedReason: job.failedReason,
    });

    await dlq.close();
  }

  /**
   * Retry a job from dead letter queue
   */
  public async retryDeadLetterJob(
    dlqJobId: string,
    dlqName?: string
  ): Promise<void> {
    const deadLetterQueueName = dlqName || `${this.config.name}-dlq`;

    const dlq = new Queue(deadLetterQueueName, {
      connection: this.config.connection,
    });

    const dlqJob = await dlq.getJob(dlqJobId);
    if (!dlqJob) {
      throw new Error(`DLQ job ${dlqJobId} not found`);
    }

    // Extract original data from DLQ job
    const dlqData = dlqJob.data as any;
    const originalData = dlqData.originalData as CrawlJobData;

    // Add job back to main queue
    await this.addCrawlJob({
      ...originalData,
      attempts: 1, // Reset attempts for retry
    });

    // Remove from DLQ
    await dlqJob.remove();

    this.logger.info(`Retried DLQ job ${dlqJobId}`, {
      originalJobId: dlqData.originalJobId,
      sourceId: originalData.sourceId,
    });

    await dlq.close();
  }

  /**
   * Get dead letter queue jobs
   */
  public async getDeadLetterJobs(dlqName?: string): Promise<Job[]> {
    const deadLetterQueueName = dlqName || `${this.config.name}-dlq`;

    const dlq = new Queue(deadLetterQueueName, {
      connection: this.config.connection,
    });

    const jobs = await dlq.getJobs([
      'waiting',
      'active',
      'completed',
      'failed',
    ]);

    await dlq.close();
    return jobs;
  }

  /**
   * Clear dead letter queue
   */
  public async clearDeadLetterQueue(dlqName?: string): Promise<void> {
    const deadLetterQueueName = dlqName || `${this.config.name}-dlq`;

    const dlq = new Queue(deadLetterQueueName, {
      connection: this.config.connection,
    });

    await dlq.obliterate({ force: true });

    this.logger.info(`Cleared dead letter queue: ${deadLetterQueueName}`);

    await dlq.close();
  }

  /**
   * Get extended metrics including scheduled and DLQ jobs
   */
  public async getExtendedMetrics(): Promise<{
    basic: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: boolean;
    };
    scheduled: number;
    deadLetter: number;
  }> {
    const basicMetrics = await this.getMetrics();
    const scheduledJobs = await this.getScheduledJobs();
    const dlqJobs = await this.getDeadLetterJobs();

    return {
      basic: basicMetrics,
      scheduled: scheduledJobs.length,
      deadLetter: dlqJobs.length,
    };
  }
}

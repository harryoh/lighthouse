/**
 * Queue monitoring service for tracking job metrics and health
 */

import { Queue, Job, QueueEvents } from 'bullmq';
import { Logger } from 'winston';
import { EventEmitter } from 'events';
import Redis from 'ioredis';

export interface QueueMetrics {
  queueName: string;
  counts: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
    prioritized: number;
  };
  throughput: {
    completedPerMinute: number;
    failedPerMinute: number;
  };
  averageProcessingTime: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
}

export interface JobDetails {
  id: string;
  name: string;
  data: any;
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  timestamp: number;
  finishedOn?: number;
  processedOn?: number;
  returnvalue?: any;
}

export interface AlertConfig {
  type: 'email' | 'webhook' | 'console';
  threshold: {
    failedJobsPercentage?: number;
    queueSizeLimit?: number;
    processingTimeLimit?: number; // in milliseconds
    stalledJobsLimit?: number;
  };
  recipient?: string; // email or webhook URL
}

export interface ArchivedJob {
  id: string;
  name: string;
  data: any;
  result?: any;
  error?: string;
  completedAt: Date;
  processingTime: number;
  attempts: number;
}

/**
 * Queue monitoring service
 */
export class QueueMonitor extends EventEmitter {
  private queue: Queue;
  private queueEvents: QueueEvents;
  private redis: Redis;
  private logger?: Logger;
  private metricsCache: Map<string, QueueMetrics> = new Map();
  private alertConfig: AlertConfig[] = [];
  private completedJobsWindow: number[] = [];
  private failedJobsWindow: number[] = [];
  private processingTimes: number[] = [];
  private readonly WINDOW_SIZE = 60; // 60 seconds window for rate calculation
  private readonly CLEANUP_AGE_DAYS = 7;
  private readonly ARCHIVE_PATH = './archives/jobs';

  constructor(queue: Queue, redis: Redis, logger?: Logger) {
    super();
    this.queue = queue;
    this.redis = redis;
    this.logger = logger;
    this.queueEvents = new QueueEvents(queue.name, {
      connection: redis.duplicate(),
    });

    this.initializeEventListeners();
    this.startMetricsCollection();
  }

  /**
   * Initialize event listeners for job events
   */
  private initializeEventListeners(): void {
    // Job completed event
    this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      this.logger?.info(`Job ${jobId} completed`, { returnvalue });
      this.recordCompletedJob();
      this.emit('job:completed', { jobId, returnvalue });

      const job = await this.queue.getJob(jobId);
      if (job) {
        const processingTime = job.finishedOn! - job.processedOn!;
        this.recordProcessingTime(processingTime);
      }
    });

    // Job failed event
    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      this.logger?.error(`Job ${jobId} failed`, { failedReason });
      this.recordFailedJob();
      this.emit('job:failed', { jobId, failedReason });

      // Check if should move to DLQ
      const job = await this.queue.getJob(jobId);
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        await this.moveToDeadLetterQueue(job);
      }

      // Check alert thresholds
      await this.checkAlertThresholds();
    });

    // Job stalled event
    this.queueEvents.on('stalled', ({ jobId }) => {
      this.logger?.warn(`Job ${jobId} stalled`);
      this.emit('job:stalled', { jobId });
    });

    // Job progress event
    this.queueEvents.on('progress', ({ jobId, data }) => {
      this.logger?.debug(`Job ${jobId} progress`, { progress: data });
      this.emit('job:progress', { jobId, progress: data });
    });

    // Job removed event (for cleanup tracking)
    this.queueEvents.on('removed', ({ jobId }) => {
      this.logger?.debug(`Job ${jobId} removed`);
      this.emit('job:removed', { jobId });
    });
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    // Collect metrics every 5 seconds
    setInterval(async () => {
      const metrics = await this.getQueueMetrics();
      this.metricsCache.set(this.queue.name, metrics);
      this.emit('metrics:updated', metrics);
    }, 5000);

    // Clean up window arrays every minute
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.WINDOW_SIZE * 1000;

      this.completedJobsWindow = this.completedJobsWindow.filter(
        (time) => time > cutoff
      );
      this.failedJobsWindow = this.failedJobsWindow.filter(
        (time) => time > cutoff
      );

      // Keep only last 100 processing times
      if (this.processingTimes.length > 100) {
        this.processingTimes = this.processingTimes.slice(-100);
      }
    }, 60000);
  }

  /**
   * Get current queue metrics
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    const counts = await this.queue.getJobCounts();
    const failed = counts['failed'] || 0;
    const completed = counts['completed'] || 0;

    // Calculate throughput
    const now = Date.now();
    const minuteAgo = now - 60000;
    const completedPerMinute = this.completedJobsWindow.filter(
      (time) => time > minuteAgo
    ).length;
    const failedPerMinute = this.failedJobsWindow.filter(
      (time) => time > minuteAgo
    ).length;

    // Calculate average processing time
    const avgProcessingTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) /
          this.processingTimes.length
        : 0;

    // Determine health status
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const failureRate = failed / (completed + failed || 1);

    if (failureRate > 0.5 || failed > 100) {
      healthStatus = 'unhealthy';
    } else if (failureRate > 0.2 || failed > 50) {
      healthStatus = 'degraded';
    }

    return {
      queueName: this.queue.name,
      counts: {
        active: counts['active'] || 0,
        waiting: counts['waiting'] || 0,
        completed: counts['completed'] || 0,
        failed: counts['failed'] || 0,
        delayed: counts['delayed'] || 0,
        paused: counts['paused'] || 0,
        prioritized: counts['prioritized'] || 0,
      },
      throughput: {
        completedPerMinute,
        failedPerMinute,
      },
      averageProcessingTime: avgProcessingTime,
      healthStatus,
      lastCheck: new Date(),
    };
  }

  /**
   * Get detailed information about a specific job
   */
  async getJobDetails(jobId: string): Promise<JobDetails | null> {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      return null;
    }

    return {
      id: job.id!,
      name: job.name,
      data: job.data,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      returnvalue: job.returnvalue,
    };
  }

  /**
   * Move failed job to dead letter queue
   */
  private async moveToDeadLetterQueue(job: Job): Promise<void> {
    const dlqName = `${this.queue.name}-dlq`;
    const dlq = new Queue(dlqName, {
      connection: this.redis.duplicate(),
    });

    try {
      // Add job to DLQ with original data and failure information
      await dlq.add('failed-job', {
        originalJobId: job.id,
        originalQueue: this.queue.name,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        failedAt: new Date(),
      });

      this.logger?.info(`Moved job ${job.id} to DLQ`, {
        queue: dlqName,
        reason: job.failedReason,
      });

      // Remove from original queue
      await job.remove();
    } catch (error) {
      this.logger?.error(`Failed to move job ${job.id} to DLQ`, { error });
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(): Promise<number> {
    const cutoffTime = Date.now() - this.CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000;
    const completedJobs = await this.queue.getJobs(['completed']);
    const jobsToArchive: Job[] = [];

    for (const job of completedJobs) {
      if (job.finishedOn && job.finishedOn < cutoffTime) {
        jobsToArchive.push(job);
      }
    }

    // Archive jobs before deletion
    if (jobsToArchive.length > 0) {
      await this.archiveJobs(jobsToArchive);
    }

    // Remove archived jobs
    let removedCount = 0;
    for (const job of jobsToArchive) {
      try {
        await job.remove();
        removedCount++;
      } catch (error) {
        this.logger?.error(`Failed to remove job ${job.id}`, { error });
      }
    }

    this.logger?.info(`Cleaned up ${removedCount} old jobs`);
    return removedCount;
  }

  /**
   * Archive jobs to compressed JSON files
   */
  private async archiveJobs(jobs: Job[]): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const zlib = await import('zlib');
    const { promisify } = await import('util');

    const gzip = promisify(zlib.gzip);

    // Create archive directory if it doesn't exist
    await fs.mkdir(this.ARCHIVE_PATH, { recursive: true });

    // Group jobs by date
    const jobsByDate = new Map<string, ArchivedJob[]>();

    for (const job of jobs) {
      if (!job.finishedOn) continue;

      const date = new Date(job.finishedOn)
        .toISOString()
        .split('T')[0] as string;

      if (!jobsByDate.has(date)) {
        jobsByDate.set(date, []);
      }

      jobsByDate.get(date)!.push({
        id: job.id!,
        name: job.name,
        data: job.data,
        result: job.returnvalue,
        error: job.failedReason,
        completedAt: new Date(job.finishedOn!),
        processingTime: job.finishedOn! - job.processedOn!,
        attempts: job.attemptsMade,
      });
    }

    // Write compressed archive files
    for (const [date, dateJobs] of jobsByDate) {
      const filename = path.join(
        this.ARCHIVE_PATH,
        `jobs-${this.queue.name}-${date}.json.gz`
      );

      const content = JSON.stringify(dateJobs, null, 2);
      const compressed = await gzip(content);

      await fs.writeFile(filename, compressed);
      this.logger?.info(`Archived ${dateJobs.length} jobs to ${filename}`);
    }
  }

  /**
   * Configure alert thresholds
   */
  configureAlerts(configs: AlertConfig[]): void {
    this.alertConfig = configs;
  }

  /**
   * Check if any alert thresholds are breached
   */
  private async checkAlertThresholds(): Promise<void> {
    const metrics = await this.getQueueMetrics();

    for (const config of this.alertConfig) {
      let shouldAlert = false;
      let alertMessage = '';

      // Check failed jobs percentage
      if (config.threshold.failedJobsPercentage) {
        const total =
          (metrics.counts.completed || 0) + (metrics.counts.failed || 0);
        const failedPercentage = (metrics.counts.failed / total) * 100;

        if (failedPercentage > config.threshold.failedJobsPercentage) {
          shouldAlert = true;
          alertMessage = `Failed jobs percentage (${failedPercentage.toFixed(
            2
          )}%) exceeded threshold (${config.threshold.failedJobsPercentage}%)`;
        }
      }

      // Check queue size limit
      if (config.threshold.queueSizeLimit) {
        const queueSize = metrics.counts.waiting + metrics.counts.active;

        if (queueSize > config.threshold.queueSizeLimit) {
          shouldAlert = true;
          alertMessage = `Queue size (${queueSize}) exceeded threshold (${config.threshold.queueSizeLimit})`;
        }
      }

      // Check processing time limit
      if (config.threshold.processingTimeLimit) {
        if (
          metrics.averageProcessingTime > config.threshold.processingTimeLimit
        ) {
          shouldAlert = true;
          alertMessage = `Average processing time (${metrics.averageProcessingTime}ms) exceeded threshold (${config.threshold.processingTimeLimit}ms)`;
        }
      }

      if (shouldAlert) {
        await this.sendAlert(config, alertMessage, metrics);
      }
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(
    config: AlertConfig,
    message: string,
    metrics: QueueMetrics
  ): Promise<void> {
    const alertData = {
      queue: this.queue.name,
      message,
      metrics,
      timestamp: new Date(),
    };

    switch (config.type) {
      case 'console':
        console.error('🚨 QUEUE ALERT:', alertData);
        break;

      case 'webhook':
        if (config.recipient) {
          try {
            // Simple webhook notification using console log for now
            // In production, use a proper HTTP client library
            const fetch = globalThis.fetch;
            if (!fetch) {
              this.logger?.warn(
                'Fetch API not available, logging webhook data',
                {
                  url: config.recipient,
                  data: alertData,
                }
              );
              break;
            }
            await fetch(config.recipient, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(alertData),
            });
          } catch (error) {
            this.logger?.error('Failed to send webhook alert', { error });
          }
        }
        break;

      case 'email':
        // Email implementation would go here
        this.logger?.warn('Email alerts not implemented', { alertData });
        break;
    }

    this.emit('alert:sent', { config, message, metrics });
  }

  /**
   * Get health check status
   */
  async getHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    redis: boolean;
    queue: boolean;
    metrics: QueueMetrics | null;
  }> {
    let redisHealthy = false;
    let queueHealthy = false;
    let metrics: QueueMetrics | null = null;

    try {
      // Check Redis connection
      await this.redis.ping();
      redisHealthy = true;

      // Check queue
      metrics = await this.getQueueMetrics();
      queueHealthy = metrics.healthStatus !== 'unhealthy';
    } catch (error) {
      this.logger?.error('Health check failed', { error });
    }

    const status = redisHealthy && queueHealthy ? 'healthy' : 'unhealthy';

    return {
      status,
      redis: redisHealthy,
      queue: queueHealthy,
      metrics,
    };
  }

  /**
   * Record completed job for throughput calculation
   */
  private recordCompletedJob(): void {
    this.completedJobsWindow.push(Date.now());
  }

  /**
   * Record failed job for throughput calculation
   */
  private recordFailedJob(): void {
    this.failedJobsWindow.push(Date.now());
  }

  /**
   * Record processing time for average calculation
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    await this.queueEvents.close();
    this.removeAllListeners();
  }
}

export default QueueMonitor;

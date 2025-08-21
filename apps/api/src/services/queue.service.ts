/**
 * Queue service for managing crawl and analysis jobs
 */

import {
  QueueInitializer,
  QueueFactory,
  type CrawlJobData,
  type AnalysisJobData,
} from '@lighthouse/crawler-core';
import { Job } from 'bullmq';

class QueueService {
  private static instance: QueueService;
  private queueInitializer?: QueueInitializer;
  private queueFactory?: QueueFactory;
  private initialized = false;

  private constructor() {
    // Singleton constructor intentionally empty
  }

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize queue factory
      this.queueFactory = new QueueFactory();

      // Initialize queue system
      this.queueInitializer = new QueueInitializer();
      const config = {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: 3,
        },
      };
      await this.queueInitializer.initialize(config);

      this.initialized = true;
      console.log('✅ Queue system initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize queue system:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.queueInitializer) {
      await this.queueInitializer.shutdown();
    }
    this.initialized = false;
  }

  async addCrawlJob(data: CrawlJobData): Promise<Job> {
    if (!this.queueFactory) {
      throw new Error('Queue system not initialized');
    }

    const queue = this.queueFactory.getQueue('crawl');
    if (!queue) {
      throw new Error('Crawl queue not found');
    }

    return queue.add('crawl', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async addAnalysisJob(data: AnalysisJobData): Promise<Job> {
    if (!this.queueFactory) {
      throw new Error('Queue system not initialized');
    }

    const queue = this.queueFactory.getQueue('analysis');
    if (!queue) {
      throw new Error('Analysis queue not found');
    }

    return queue.add('analyze', data, {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }

  async getQueueHealth(queueName: string): Promise<{
    name: string;
    counts: Record<string, number>;
    isPaused: boolean;
    isHealthy: boolean;
  }> {
    if (!this.queueFactory) {
      throw new Error('Queue system not initialized');
    }

    const queue = this.queueFactory.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const counts = await queue.getJobCounts();
    const isPaused = await queue.isPaused();

    return {
      name: queueName,
      counts,
      isPaused,
      isHealthy: true,
    };
  }

  async getAllQueuesHealth(): Promise<
    Array<{
      name: string;
      counts?: Record<string, number>;
      isPaused?: boolean;
      isHealthy: boolean;
      error?: string;
    }>
  > {
    if (!this.queueFactory) {
      throw new Error('Queue system not initialized');
    }

    const queueNames = ['crawl', 'analysis', 'scheduled', 'dead-letter'];
    const healthStatuses = await Promise.all(
      queueNames.map(async (name) => {
        try {
          return await this.getQueueHealth(name);
        } catch (error) {
          return {
            name,
            error: error instanceof Error ? error.message : 'Unknown error',
            isHealthy: false,
          };
        }
      })
    );

    return healthStatuses;
  }

  async getJobs(
    queueName: string,
    status?: string,
    limit = 20
  ): Promise<Job[]> {
    if (!this.queueFactory) {
      throw new Error('Queue system not initialized');
    }

    const queue = this.queueFactory.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    switch (status) {
      case 'completed':
        return queue.getCompleted(0, limit - 1);
      case 'failed':
        return queue.getFailed(0, limit - 1);
      case 'delayed':
        return queue.getDelayed(0, limit - 1);
      case 'active':
        return queue.getActive(0, limit - 1);
      case 'waiting':
        return queue.getWaiting(0, limit - 1);
      default:
        return queue.getJobs(
          ['completed', 'failed', 'delayed', 'active', 'waiting'],
          0,
          limit - 1
        );
    }
  }

  async retryJob(queueName: string, jobId: string): Promise<void> {
    if (!this.queueFactory) {
      throw new Error('Queue system not initialized');
    }

    const queue = this.queueFactory.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    await job.retry();
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    if (!this.queueFactory) {
      throw new Error('Queue system not initialized');
    }

    const queue = this.queueFactory.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    await job.remove();
  }
}

export const queueService = QueueService.getInstance();

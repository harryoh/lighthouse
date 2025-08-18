/**
 * Queue integration interface for crawler job management
 */

import { Job } from 'bullmq';
import { SourceConfig, CrawlResult } from '../types/crawler.types';

/**
 * Job data for crawl jobs
 */
export interface CrawlJobData {
  sourceId: string;
  source: SourceConfig;
  priority?: number;
  attempts?: number;
  delay?: number;
}

/**
 * Job result for crawl jobs
 */
export interface CrawlJobResult extends CrawlResult {
  sourceId: string;
  processedAt: Date;
}

/**
 * Queue manager interface
 */
export interface IQueueManager {
  /**
   * Add a crawl job to the queue
   */
  addCrawlJob(data: CrawlJobData): Promise<Job<CrawlJobData, CrawlJobResult>>;

  /**
   * Get job by ID
   */
  getJob(jobId: string): Promise<Job<CrawlJobData, CrawlJobResult> | undefined>;

  /**
   * Get all jobs with specific status
   */
  getJobs(
    status: 'waiting' | 'active' | 'completed' | 'failed'
  ): Promise<Job<CrawlJobData, CrawlJobResult>[]>;

  /**
   * Remove a job from the queue
   */
  removeJob(jobId: string): Promise<void>;

  /**
   * Pause the queue
   */
  pause(): Promise<void>;

  /**
   * Resume the queue
   */
  resume(): Promise<void>;

  /**
   * Clean jobs with specific status
   */
  clean(
    grace: number,
    limit: number,
    status?: 'completed' | 'failed'
  ): Promise<string[]>;

  /**
   * Get queue metrics
   */
  getMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }>;
}

/**
 * Worker processor function type
 */
export type CrawlJobProcessor = (
  job: Job<CrawlJobData, CrawlJobResult>
) => Promise<CrawlJobResult>;

/**
 * Queue configuration
 */
export interface QueueConfig {
  /**
   * Queue name
   */
  name: string;

  /**
   * Redis connection options
   */
  connection: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };

  /**
   * Default job options
   */
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  };

  /**
   * Worker configuration
   */
  workerOptions?: {
    concurrency?: number;
    maxStalledCount?: number;
    stalledInterval?: number;
  };
}

/**
 * Queue event types
 */
export enum QueueEventType {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PROGRESS = 'progress',
  DRAINED = 'drained',
  PAUSED = 'paused',
  RESUMED = 'resumed',
  CLEANED = 'cleaned',
  STALLED = 'stalled',
}

/**
 * Queue event listener
 */
export interface IQueueEventListener {
  on(event: QueueEventType, callback: (...args: unknown[]) => void): void;
  off(event: QueueEventType, callback: (...args: unknown[]) => void): void;
}

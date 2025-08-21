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

/**
 * Scheduled crawl job data - extends CrawlJobData with scheduling information
 */
export interface ScheduledCrawlJobData extends CrawlJobData {
  /**
   * Cron expression for scheduling (e.g., "0 0 * * *" for daily at midnight)
   */
  schedule: string;
  /**
   * Timezone for the schedule (e.g., "Asia/Seoul")
   */
  timezone?: string;
  /**
   * Last execution time
   */
  lastRunAt?: Date;
  /**
   * Next scheduled execution time
   */
  nextRunAt?: Date;
  /**
   * Whether the scheduled job is active
   */
  isActive?: boolean;
}

/**
 * Analysis job types
 */
export type AnalysisType =
  | 'SEO'
  | 'READABILITY'
  | 'KEYWORDS'
  | 'SENTIMENT'
  | 'QUALITY';

/**
 * Analysis job data for content analysis
 */
export interface AnalysisJobData {
  /**
   * Content ID to analyze
   */
  contentId: string;
  /**
   * Type of analysis to perform
   */
  analysisType: AnalysisType;
  /**
   * URL of the content (for reference)
   */
  url?: string;
  /**
   * Job priority (higher number = higher priority)
   */
  priority?: number;
  /**
   * Additional metadata for the analysis
   */
  metadata?: Record<string, unknown>;
  /**
   * Maximum number of retry attempts
   */
  attempts?: number;
}

/**
 * Analysis job result
 */
export interface AnalysisJobResult {
  /**
   * Content ID that was analyzed
   */
  contentId: string;
  /**
   * Type of analysis performed
   */
  analysisType: AnalysisType;
  /**
   * Analysis results (structure depends on analysis type)
   */
  results: {
    score?: number;
    details?: Record<string, unknown>;
    suggestions?: string[];
    metrics?: Record<string, number>;
  };
  /**
   * Processing timestamp
   */
  processedAt: Date;
  /**
   * Processing duration in milliseconds
   */
  processingTime?: number;
}

/**
 * Queue health status
 */
export interface QueueHealth {
  /**
   * Whether the queue is connected to Redis
   */
  isConnected: boolean;
  /**
   * Last health check timestamp
   */
  lastHealthCheck: Date;
  /**
   * Queue metrics
   */
  queueMetrics?: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  };
  /**
   * Redis server information
   */
  redisInfo?: {
    version?: string;
    usedMemory?: string;
    connectedClients?: number;
    uptimeInSeconds?: number;
  };
  /**
   * Worker status
   */
  workerStatus?: {
    isRunning: boolean;
    currentConcurrency: number;
    maxConcurrency: number;
  };
  /**
   * Any error messages
   */
  error?: string;
}

/**
 * Job processor function types
 */
export type AnalysisJobProcessor = (
  job: Job<AnalysisJobData, AnalysisJobResult>
) => Promise<AnalysisJobResult>;

export type ScheduledJobProcessor = (
  job: Job<ScheduledCrawlJobData, CrawlJobResult>
) => Promise<CrawlJobResult>;

/**
 * Dead letter queue configuration
 */
export interface DeadLetterQueueConfig {
  /**
   * Maximum number of retries before moving to DLQ
   */
  maxRetries?: number;
  /**
   * TTL for jobs in DLQ (in seconds)
   */
  ttl?: number;
  /**
   * Whether to automatically retry DLQ jobs
   */
  autoRetry?: boolean;
  /**
   * Retry interval for DLQ jobs (in seconds)
   */
  retryInterval?: number;
}

/**
 * Extended queue configuration with new options
 */
export interface ExtendedQueueConfig extends QueueConfig {
  /**
   * Dead letter queue configuration
   */
  deadLetterQueue?: DeadLetterQueueConfig;
  /**
   * Health check interval (in seconds)
   */
  healthCheckInterval?: number;
  /**
   * Enable metrics collection
   */
  enableMetrics?: boolean;
  /**
   * Queue type identifier
   */
  queueType?: 'crawl' | 'analysis' | 'scheduled';
}

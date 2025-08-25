/**
 * Scheduler interfaces and types for cron-based job scheduling
 */

import { JobsOptions } from 'bullmq';
import { CrawlJobData, CrawlJobResult } from '../QueueInterface';

/**
 * Configuration for a scheduled job
 */
export interface ScheduledJobConfig {
  /** Unique identifier for the scheduled job */
  id: string;

  /** Human-readable name for the scheduled job */
  name: string;

  /** Cron expression string (e.g., "0 *\/6 * * *" for every 6 hours) */
  cronExpression: string;

  /** Timezone for the cron expression (e.g., "Asia/Seoul") */
  timezone?: string;

  /** Job data to be passed when the scheduled job runs */
  data: CrawlJobData;

  /** Additional job options */
  options?: JobsOptions;

  /** Whether the schedule is active */
  enabled?: boolean;

  /** Start date for the schedule (optional) */
  startDate?: Date;

  /** End date for the schedule (optional) */
  endDate?: Date;

  /** Maximum number of times to run this schedule */
  maxRuns?: number;

  /** Metadata for the scheduled job */
  metadata?: Record<string, unknown>;
}

/**
 * Schedule conflict detection result
 */
export interface ScheduleConflict {
  conflictingJobId: string;
  conflictingJobName: string;
  reason: 'duplicate_time' | 'overlapping_resource' | 'duplicate_id';
  details?: string;
}

/**
 * Schedule validation result
 */
export interface ScheduleValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  conflicts?: ScheduleConflict[];
}

/**
 * Information about a scheduled job
 */
export interface ScheduledJobInfo {
  id: string;
  name: string;
  cronExpression: string;
  timezone?: string;
  enabled: boolean;
  nextRunTime?: Date;
  lastRunTime?: Date;
  runCount: number;
  maxRuns?: number;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Schedule execution history entry
 */
export interface ScheduleExecutionHistory {
  id: string;
  scheduleId: string;
  executionTime: Date;
  completionTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: CrawlJobResult;
  error?: string;
  duration?: number;
  attemptNumber?: number;
}

/**
 * Options for updating a schedule
 */
export interface ScheduleUpdateOptions {
  cronExpression?: string;
  timezone?: string;
  enabled?: boolean;
  data?: CrawlJobData;
  options?: JobsOptions;
  startDate?: Date | null;
  endDate?: Date | null;
  maxRuns?: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * Options for querying scheduled jobs
 */
export interface ScheduleQueryOptions {
  enabled?: boolean;
  sourceId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'nextRunTime' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Next run time calculation result
 */
export interface NextRunTimeInfo {
  scheduleId: string;
  nextRunTime: Date | null;
  occurrences: Date[];
  isActive: boolean;
  reason?: string; // If not active, why
}

/**
 * Interface for the job scheduler
 */
export interface IJobScheduler {
  /**
   * Add a new scheduled job
   */
  addScheduledJob(config: ScheduledJobConfig): Promise<ScheduledJobInfo>;

  /**
   * Remove a scheduled job
   */
  removeScheduledJob(scheduleId: string): Promise<boolean>;

  /**
   * Update an existing schedule
   */
  updateSchedule(
    scheduleId: string,
    updates: ScheduleUpdateOptions
  ): Promise<ScheduledJobInfo>;

  /**
   * Get all scheduled jobs
   */
  getScheduledJobs(options?: ScheduleQueryOptions): Promise<ScheduledJobInfo[]>;

  /**
   * Get a specific scheduled job
   */
  getScheduledJob(scheduleId: string): Promise<ScheduledJobInfo | null>;

  /**
   * Calculate next run times for a schedule
   */
  getNextRunTime(scheduleId: string, count?: number): Promise<NextRunTimeInfo>;

  /**
   * Validate a cron expression
   */
  validateCronExpression(
    expression: string,
    timezone?: string
  ): ScheduleValidationResult;

  /**
   * Check for schedule conflicts
   */
  checkScheduleConflicts(
    config: ScheduledJobConfig
  ): Promise<ScheduleConflict[]>;

  /**
   * Get execution history for a schedule
   */
  getExecutionHistory(
    scheduleId: string,
    limit?: number
  ): Promise<ScheduleExecutionHistory[]>;

  /**
   * Enable or disable a schedule
   */
  toggleSchedule(scheduleId: string, enabled: boolean): Promise<boolean>;

  /**
   * Trigger immediate execution of a scheduled job
   */
  triggerScheduledJob(scheduleId: string): Promise<string>; // Returns job ID

  /**
   * Clear execution history for a schedule
   */
  clearExecutionHistory(scheduleId: string, beforeDate?: Date): Promise<number>;

  /**
   * Get schedules that will run in a specific time window
   */
  getUpcomingSchedules(
    startTime: Date,
    endTime: Date
  ): Promise<ScheduledJobInfo[]>;
}

/**
 * Cron expression presets for common schedules
 */
export const CRON_PRESETS = {
  EVERY_MINUTE: '* * * * *',
  EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_15_MINUTES: '*/15 * * * *',
  EVERY_30_MINUTES: '*/30 * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_2_HOURS: '0 */2 * * *',
  EVERY_6_HOURS: '0 */6 * * *',
  EVERY_12_HOURS: '0 */12 * * *',
  DAILY_MIDNIGHT: '0 0 * * *',
  DAILY_NOON: '0 12 * * *',
  WEEKLY_MONDAY: '0 0 * * 1',
  MONTHLY_FIRST: '0 0 1 * *',
  BUSINESS_HOURS: '0 9-18 * * 1-5',
  WEEKDAYS_MORNING: '0 9 * * 1-5',
  WEEKENDS_MORNING: '0 9 * * 0,6',
} as const;

/**
 * Common timezones for Korean services
 */
export const TIMEZONES = {
  SEOUL: 'Asia/Seoul',
  UTC: 'UTC',
  NEW_YORK: 'America/New_York',
  LONDON: 'Europe/London',
  TOKYO: 'Asia/Tokyo',
} as const;

/**
 * Job scheduler implementation with cron support
 */

import { Queue, RepeatOptions } from 'bullmq';
import moment from 'moment-timezone';
import { v4 as uuidv4 } from 'uuid';
import * as winston from 'winston';
import {
  IJobScheduler,
  ScheduledJobConfig,
  ScheduledJobInfo,
  ScheduleUpdateOptions,
  ScheduleQueryOptions,
  ScheduleValidationResult,
  ScheduleConflict,
  ScheduleExecutionHistory,
  NextRunTimeInfo,
  TIMEZONES,
} from './SchedulerInterface';
import { CrawlJobData, CrawlJobResult } from '../QueueInterface';

// Helper to load cron-parser (handles both runtime and test environments)
function getCronParser() {
  try {
    return require('cron-parser');
  } catch (error) {
    // Return a mock implementation for environments where cron-parser isn't available
    return {
      parseExpression: (_expr: string, _options?: any) => {
        throw new Error('cron-parser not available');
      },
    };
  }
}

const cronParser = getCronParser();

/**
 * JobScheduler class for managing cron-based scheduled jobs
 */
export class JobScheduler implements IJobScheduler {
  private queue: Queue<CrawlJobData, CrawlJobResult>;
  private logger: winston.Logger;
  private scheduledJobs: Map<string, ScheduledJobInfo>;
  private executionHistory: Map<string, ScheduleExecutionHistory[]>;

  constructor(
    queue: Queue<CrawlJobData, CrawlJobResult>,
    logger?: winston.Logger
  ) {
    this.queue = queue;
    this.logger = logger || this.createDefaultLogger();
    this.scheduledJobs = new Map();
    this.executionHistory = new Map();

    this.logger.info('JobScheduler initialized');
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
      defaultMeta: { service: 'JobScheduler' },
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
   * Add a new scheduled job
   */
  async addScheduledJob(config: ScheduledJobConfig): Promise<ScheduledJobInfo> {
    // Validate the configuration
    const validation = this.validateCronExpression(
      config.cronExpression,
      config.timezone
    );
    if (!validation.isValid) {
      throw new Error(
        `Invalid schedule configuration: ${validation.errors?.join(', ')}`
      );
    }

    // Check for conflicts
    const conflicts = await this.checkScheduleConflicts(config);
    if (conflicts.length > 0) {
      throw new Error(
        `Schedule conflicts detected: ${conflicts
          .map((c) => c.reason)
          .join(', ')}`
      );
    }

    // Create repeat options for BullMQ
    const repeatOptions: RepeatOptions = {
      pattern: config.cronExpression,
      tz: config.timezone || TIMEZONES.SEOUL,
      startDate: config.startDate,
      endDate: config.endDate,
      limit: config.maxRuns,
    };

    // Add the job to the queue with repeat options
    const jobName = `scheduled_${config.id}`;
    await this.queue.add(jobName, config.data, {
      ...config.options,
      repeat: repeatOptions,
      jobId: config.id,
    });

    // Create scheduled job info
    const defaultTimezone = config.timezone || TIMEZONES.SEOUL;
    const scheduledJobInfo: ScheduledJobInfo = {
      id: config.id,
      name: config.name,
      cronExpression: config.cronExpression,
      timezone: defaultTimezone,
      enabled: config.enabled !== false,
      nextRunTime: this.calculateNextRunTime(
        config.cronExpression,
        defaultTimezone
      ),
      lastRunTime: undefined,
      runCount: 0,
      maxRuns: config.maxRuns,
      startDate: config.startDate,
      endDate: config.endDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: config.metadata,
    };

    // Store in memory (in production, this would be stored in database)
    this.scheduledJobs.set(config.id, scheduledJobInfo);

    this.logger.info(`Scheduled job added: ${config.name} (${config.id})`, {
      cronExpression: config.cronExpression,
      timezone: config.timezone,
      nextRunTime: scheduledJobInfo.nextRunTime,
    });

    return scheduledJobInfo;
  }

  /**
   * Remove a scheduled job
   */
  async removeScheduledJob(scheduleId: string): Promise<boolean> {
    const jobInfo = this.scheduledJobs.get(scheduleId);
    if (!jobInfo) {
      this.logger.warn(`Scheduled job not found: ${scheduleId}`);
      return false;
    }

    // Remove repeatable job from queue
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const jobToRemove = repeatableJobs.find((job) => job.id === scheduleId);

    if (jobToRemove) {
      await this.queue.removeRepeatableByKey(jobToRemove.key);
    }

    // Remove from memory
    this.scheduledJobs.delete(scheduleId);
    this.executionHistory.delete(scheduleId);

    this.logger.info(`Scheduled job removed: ${jobInfo.name} (${scheduleId})`);
    return true;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(
    scheduleId: string,
    updates: ScheduleUpdateOptions
  ): Promise<ScheduledJobInfo> {
    const existingJob = this.scheduledJobs.get(scheduleId);
    if (!existingJob) {
      throw new Error(`Scheduled job not found: ${scheduleId}`);
    }

    // Validate new cron expression if provided
    if (updates.cronExpression) {
      const validation = this.validateCronExpression(
        updates.cronExpression,
        updates.timezone || existingJob.timezone
      );
      if (!validation.isValid) {
        throw new Error(
          `Invalid cron expression: ${validation.errors?.join(', ')}`
        );
      }
    }

    // Remove the old repeatable job
    await this.removeScheduledJob(scheduleId);

    // Create new configuration with updates
    const newConfig: ScheduledJobConfig = {
      id: scheduleId,
      name: existingJob.name,
      cronExpression: updates.cronExpression || existingJob.cronExpression,
      timezone:
        updates.timezone !== undefined
          ? updates.timezone
          : existingJob.timezone,
      data: updates.data || ({} as CrawlJobData),
      options: updates.options,
      enabled:
        updates.enabled !== undefined ? updates.enabled : existingJob.enabled,
      startDate:
        updates.startDate !== undefined
          ? updates.startDate || undefined
          : existingJob.startDate,
      endDate:
        updates.endDate !== undefined
          ? updates.endDate || undefined
          : existingJob.endDate,
      maxRuns:
        updates.maxRuns !== undefined
          ? updates.maxRuns || undefined
          : existingJob.maxRuns,
      metadata: { ...existingJob.metadata, ...updates.metadata },
    };

    // Add the updated job
    const updatedJob = await this.addScheduledJob(newConfig);

    // Preserve run count and history
    updatedJob.runCount = existingJob.runCount;
    updatedJob.lastRunTime = existingJob.lastRunTime;

    this.logger.info(
      `Scheduled job updated: ${updatedJob.name} (${scheduleId})`
    );
    return updatedJob;
  }

  /**
   * Get all scheduled jobs
   */
  async getScheduledJobs(
    options?: ScheduleQueryOptions
  ): Promise<ScheduledJobInfo[]> {
    let jobs = Array.from(this.scheduledJobs.values());

    // Apply filters
    if (options?.enabled !== undefined) {
      jobs = jobs.filter((job) => job.enabled === options.enabled);
    }

    // Apply sorting
    if (options?.sortBy) {
      jobs.sort((a, b) => {
        const order = options.sortOrder === 'desc' ? -1 : 1;
        switch (options.sortBy) {
          case 'name':
            return order * a.name.localeCompare(b.name);
          case 'nextRunTime':
            return (
              order *
              ((a.nextRunTime?.getTime() || 0) -
                (b.nextRunTime?.getTime() || 0))
            );
          case 'createdAt':
            return order * (a.createdAt.getTime() - b.createdAt.getTime());
          case 'updatedAt':
            return order * (a.updatedAt.getTime() - b.updatedAt.getTime());
          default:
            return 0;
        }
      });
    }

    // Apply pagination
    if (options?.limit) {
      const offset = options.offset || 0;
      jobs = jobs.slice(offset, offset + options.limit);
    }

    return jobs;
  }

  /**
   * Get a specific scheduled job
   */
  async getScheduledJob(scheduleId: string): Promise<ScheduledJobInfo | null> {
    return this.scheduledJobs.get(scheduleId) || null;
  }

  /**
   * Calculate next run times for a schedule
   */
  async getNextRunTime(
    scheduleId: string,
    count = 5
  ): Promise<NextRunTimeInfo> {
    const job = this.scheduledJobs.get(scheduleId);
    if (!job) {
      throw new Error(`Scheduled job not found: ${scheduleId}`);
    }

    const occurrences: Date[] = [];
    let isActive = job.enabled;
    let reason: string | undefined;

    if (!isActive) {
      reason = 'Schedule is disabled';
    } else if (job.endDate && job.endDate < new Date()) {
      isActive = false;
      reason = 'Schedule has ended';
    } else if (job.maxRuns && job.runCount >= job.maxRuns) {
      isActive = false;
      reason = 'Maximum run count reached';
    } else {
      try {
        const options = {
          currentDate: job.startDate || new Date(),
          tz: job.timezone || TIMEZONES.SEOUL,
          endDate: job.endDate,
        };

        const interval = cronParser.parseExpression(
          job.cronExpression,
          options
        );

        for (let i = 0; i < count; i++) {
          if (interval.hasNext()) {
            occurrences.push(interval.next().toDate());
          }
        }
      } catch (error) {
        isActive = false;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        reason = `Invalid cron expression: ${errorMessage}`;
      }
    }

    return {
      scheduleId,
      nextRunTime: occurrences[0] || null,
      occurrences,
      isActive,
      reason,
    };
  }

  /**
   * Validate a cron expression
   */
  validateCronExpression(
    expression: string,
    timezone?: string
  ): ScheduleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if expression is empty
    if (!expression || expression.trim().length === 0) {
      errors.push('Cron expression cannot be empty');
      return { isValid: false, errors };
    }

    // Validate cron expression format
    try {
      const options = {
        currentDate: new Date(),
        tz: timezone || TIMEZONES.SEOUL,
      };

      const interval = cronParser.parseExpression(expression, options);

      // Check if it produces valid dates
      const next = interval.next();
      if (!next || !next.toDate()) {
        errors.push('Cron expression does not produce valid execution times');
      }

      // Check frequency warnings
      const parts = expression.split(' ');
      if (parts[0] === '*' && parts[1] === '*') {
        warnings.push('Schedule runs every minute - this may cause high load');
      } else if (parts[0] === '*/5' || parts[0] === '*/10') {
        warnings.push(
          'Schedule runs very frequently - consider if this is necessary'
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Invalid cron expression: ${errorMessage}`);
    }

    // Validate timezone if provided
    if (timezone) {
      try {
        // Check if timezone exists in the moment-timezone database
        const validTimezones = moment.tz.names();
        if (!validTimezones.includes(timezone)) {
          errors.push(
            `Invalid timezone: ${timezone} - not found in timezone database`
          );
        } else {
          // Additional check by trying to format a date
          moment.tz(timezone);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push(`Invalid timezone: ${timezone} - ${errorMessage}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Check for schedule conflicts
   */
  async checkScheduleConflicts(
    config: ScheduledJobConfig
  ): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];

    // Check for duplicate ID
    if (this.scheduledJobs.has(config.id)) {
      conflicts.push({
        conflictingJobId: config.id,
        conflictingJobName:
          this.scheduledJobs.get(config.id)?.name || 'Unknown',
        reason: 'duplicate_id',
        details: 'A schedule with this ID already exists',
      });
    }

    // Check for duplicate schedules at the same time for the same resource
    for (const [existingId, existingJob] of this.scheduledJobs) {
      if (existingId === config.id) continue;

      // Check if cron expressions are identical
      if (
        existingJob.cronExpression === config.cronExpression &&
        existingJob.timezone === config.timezone
      ) {
        // Check if they target the same resource
        if (
          config.data &&
          existingJob.metadata?.['sourceId'] === config.data.sourceId
        ) {
          conflicts.push({
            conflictingJobId: existingId,
            conflictingJobName: existingJob.name,
            reason: 'duplicate_time',
            details:
              'Another schedule runs at the same time for the same source',
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Get execution history for a schedule
   */
  async getExecutionHistory(
    scheduleId: string,
    limit = 10
  ): Promise<ScheduleExecutionHistory[]> {
    const history = this.executionHistory.get(scheduleId) || [];
    return history.slice(0, limit);
  }

  /**
   * Enable or disable a schedule
   */
  async toggleSchedule(scheduleId: string, enabled: boolean): Promise<boolean> {
    const job = this.scheduledJobs.get(scheduleId);
    if (!job) {
      return false;
    }

    job.enabled = enabled;
    job.updatedAt = new Date();

    if (enabled) {
      // Re-enable the schedule
      await this.updateSchedule(scheduleId, { enabled: true });
      this.logger.info(`Schedule enabled: ${job.name} (${scheduleId})`);
    } else {
      // Pause the repeatable job
      const repeatableJobs = await this.queue.getRepeatableJobs();
      const jobToToggle = repeatableJobs.find((j) => j.id === scheduleId);
      if (jobToToggle) {
        await this.queue.removeRepeatableByKey(jobToToggle.key);
      }
      this.logger.info(`Schedule disabled: ${job.name} (${scheduleId})`);
    }

    return true;
  }

  /**
   * Trigger immediate execution of a scheduled job
   */
  async triggerScheduledJob(scheduleId: string): Promise<string> {
    const scheduledJob = this.scheduledJobs.get(scheduleId);
    if (!scheduledJob) {
      throw new Error(`Scheduled job not found: ${scheduleId}`);
    }

    // Add a one-time job with the same data
    const jobId = `manual_${scheduleId}_${uuidv4()}`;
    const job = await this.queue.add(
      `manual_${scheduledJob.name}`,
      {} as CrawlJobData, // In production, this would use the actual job data
      {
        jobId,
        priority: 10, // Higher priority for manual triggers
      }
    );

    this.logger.info(
      `Manually triggered scheduled job: ${scheduledJob.name} (${scheduleId})`,
      {
        jobId,
      }
    );

    return job.id || jobId;
  }

  /**
   * Clear execution history for a schedule
   */
  async clearExecutionHistory(
    scheduleId: string,
    beforeDate?: Date
  ): Promise<number> {
    const history = this.executionHistory.get(scheduleId);
    if (!history || history.length === 0) {
      return 0;
    }

    let clearedCount = 0;

    if (beforeDate) {
      const filtered = history.filter(
        (entry) => entry.executionTime >= beforeDate
      );
      clearedCount = history.length - filtered.length;
      this.executionHistory.set(scheduleId, filtered);
    } else {
      clearedCount = history.length;
      this.executionHistory.delete(scheduleId);
    }

    this.logger.info(
      `Cleared ${clearedCount} history entries for schedule: ${scheduleId}`
    );
    return clearedCount;
  }

  /**
   * Get schedules that will run in a specific time window
   */
  async getUpcomingSchedules(
    startTime: Date,
    endTime: Date
  ): Promise<ScheduledJobInfo[]> {
    const upcomingSchedules: ScheduledJobInfo[] = [];

    for (const [scheduleId, job] of this.scheduledJobs) {
      if (!job.enabled) continue;

      try {
        const options = {
          currentDate: startTime,
          endDate: endTime,
          tz: job.timezone || TIMEZONES.SEOUL,
        };

        const interval = cronParser.parseExpression(
          job.cronExpression,
          options
        );

        if (interval.hasNext()) {
          const nextRun = interval.next().toDate();
          if (nextRun >= startTime && nextRun <= endTime) {
            upcomingSchedules.push({
              ...job,
              nextRunTime: nextRun,
            });
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error calculating upcoming schedule for ${scheduleId}:`,
          errorMessage
        );
      }
    }

    return upcomingSchedules;
  }

  /**
   * Calculate the next run time for a cron expression
   */
  private calculateNextRunTime(
    expression: string,
    timezone?: string
  ): Date | undefined {
    try {
      const options = {
        currentDate: new Date(),
        tz: timezone || TIMEZONES.SEOUL,
      };

      const interval = cronParser.parseExpression(expression, options);
      return interval.next().toDate();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error calculating next run time: ${errorMessage}`);
      return undefined;
    }
  }

  /**
   * Record execution in history
   */
  public recordExecution(
    scheduleId: string,
    execution: ScheduleExecutionHistory
  ): void {
    if (!this.executionHistory.has(scheduleId)) {
      this.executionHistory.set(scheduleId, []);
    }

    const history = this.executionHistory.get(scheduleId);
    if (!history) {
      return;
    }
    history.unshift(execution); // Add to beginning

    // Keep only last 100 executions
    if (history.length > 100) {
      history.splice(100);
    }

    // Update job info
    const job = this.scheduledJobs.get(scheduleId);
    if (job) {
      job.lastRunTime = execution.executionTime;
      job.runCount++;
      job.nextRunTime = this.calculateNextRunTime(
        job.cronExpression,
        job.timezone
      );
      job.updatedAt = new Date();
    }
  }
}

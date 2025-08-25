/**
 * JobScheduler unit tests
 */

import { Queue } from 'bullmq';
import { JobScheduler } from './JobScheduler';
import {
  ScheduledJobConfig,
  CRON_PRESETS,
  TIMEZONES,
} from './SchedulerInterface';

// Mock BullMQ
jest.mock('bullmq');

// Mock cron-parser module
jest.mock(
  'cron-parser',
  () => {
    const mockNext = () => {
      const date = new Date(Date.now() + 3600000); // 1 hour from now
      return {
        toDate: () => date,
        toISOString: () => date.toISOString(),
        getTime: () => date.getTime(),
      };
    };

    return {
      parseExpression: jest.fn((expr: string, _options?: any) => {
        // Simple mock implementation that validates basic cron patterns
        const validPatterns = [
          '0 * * * *', // Every hour
          '0 */2 * * *', // Every 2 hours
          '0 */6 * * *', // Every 6 hours
          '0 0 * * *', // Daily
          '0 0 * * 1', // Weekly
          '0 0 1 * *', // Monthly
          '*/5 * * * *', // Every 5 minutes
          '*/10 * * * *', // Every 10 minutes
          '*/30 * * * *', // Every 30 minutes
          '0 0,12 * * *', // Twice daily
        ];

        // Allow any valid cron expression pattern
        if (
          !validPatterns.includes(expr) &&
          !expr.match(
            /^(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)$/
          )
        ) {
          throw new Error(`Invalid cron expression: ${expr}`);
        }

        return {
          next: mockNext,
          hasNext: jest.fn(() => true),
          iterate: jest.fn((count: number) => {
            const dates = [];
            const startTime = Date.now();
            for (let i = 0; i < (count || 10); i++) {
              // Generate strictly increasing timestamps
              const timestamp = startTime + (i + 1) * 3600000 + (i + 1) * 1000;
              dates.push(new Date(timestamp));
            }
            return dates;
          }),
        };
      }),
    };
  },
  { virtual: true }
);

describe('JobScheduler', () => {
  let scheduler: JobScheduler;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    // Create mock queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn().mockResolvedValue(true),
    } as any;

    // Create scheduler instance
    scheduler = new JobScheduler(mockQueue);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCronExpression', () => {
    it('should validate correct cron expressions', () => {
      const result = scheduler.validateCronExpression('0 */6 * * *');
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject invalid cron expressions', () => {
      const result = scheduler.validateCronExpression('invalid');
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should reject empty cron expressions', () => {
      const result = scheduler.validateCronExpression('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cron expression cannot be empty');
    });

    it('should warn about high frequency schedules', () => {
      const result = scheduler.validateCronExpression('* * * * *');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain(
        'Schedule runs every minute - this may cause high load'
      );
    });

    it('should validate with timezone', () => {
      const result = scheduler.validateCronExpression(
        '0 12 * * *',
        TIMEZONES.SEOUL
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid timezone', () => {
      const result = scheduler.validateCronExpression(
        '0 12 * * *',
        'Invalid/Timezone'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('addScheduledJob', () => {
    it('should add a valid scheduled job', async () => {
      const config: ScheduledJobConfig = {
        id: 'test-schedule-1',
        name: 'Test Schedule',
        cronExpression: CRON_PRESETS.EVERY_HOUR,
        timezone: TIMEZONES.SEOUL,
        data: { sourceId: 'test-source', source: {} as any },
        enabled: true,
      };

      const result = await scheduler.addScheduledJob(config);

      expect(result).toBeDefined();
      expect(result.id).toBe(config.id);
      expect(result.name).toBe(config.name);
      expect(result.cronExpression).toBe(config.cronExpression);
      expect(result.enabled).toBe(true);
      expect(result.nextRunTime).toBeDefined();
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should reject invalid cron expression', async () => {
      const config: ScheduledJobConfig = {
        id: 'test-schedule-2',
        name: 'Invalid Schedule',
        cronExpression: 'invalid cron',
        data: { sourceId: 'test-source', source: {} as any },
      };

      await expect(scheduler.addScheduledJob(config)).rejects.toThrow(
        'Invalid schedule configuration'
      );
    });

    it('should set default timezone to Seoul', async () => {
      const config: ScheduledJobConfig = {
        id: 'test-schedule-3',
        name: 'No Timezone Schedule',
        cronExpression: CRON_PRESETS.DAILY_MIDNIGHT,
        data: { sourceId: 'test-source', source: {} as any },
      };

      const result = await scheduler.addScheduledJob(config);
      expect(result.timezone).toBe(TIMEZONES.SEOUL);
    });

    it('should support start and end dates', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const config: ScheduledJobConfig = {
        id: 'test-schedule-4',
        name: 'Limited Schedule',
        cronExpression: CRON_PRESETS.DAILY_NOON,
        data: { sourceId: 'test-source', source: {} as any },
        startDate,
        endDate,
      };

      const result = await scheduler.addScheduledJob(config);
      expect(result.startDate).toEqual(startDate);
      expect(result.endDate).toEqual(endDate);
    });

    it('should support max runs limit', async () => {
      const config: ScheduledJobConfig = {
        id: 'test-schedule-5',
        name: 'Limited Runs Schedule',
        cronExpression: CRON_PRESETS.EVERY_HOUR,
        data: { sourceId: 'test-source', source: {} as any },
        maxRuns: 10,
      };

      const result = await scheduler.addScheduledJob(config);
      expect(result.maxRuns).toBe(10);
      expect(result.runCount).toBe(0);
    });
  });

  describe('removeScheduledJob', () => {
    beforeEach(async () => {
      // Add a test schedule
      const config: ScheduledJobConfig = {
        id: 'test-remove-1',
        name: 'Schedule to Remove',
        cronExpression: CRON_PRESETS.EVERY_HOUR,
        data: { sourceId: 'test-source', source: {} as any },
      };
      await scheduler.addScheduledJob(config);
    });

    it('should remove an existing scheduled job', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValueOnce([
        {
          id: 'test-remove-1',
          key: 'repeat:test-remove-1',
          name: 'test',
        } as any,
      ]);

      const result = await scheduler.removeScheduledJob('test-remove-1');
      expect(result).toBe(true);
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith(
        'repeat:test-remove-1'
      );
    });

    it('should return false for non-existent job', async () => {
      const result = await scheduler.removeScheduledJob('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('updateSchedule', () => {
    beforeEach(async () => {
      // Add a test schedule
      const config: ScheduledJobConfig = {
        id: 'test-update-1',
        name: 'Schedule to Update',
        cronExpression: CRON_PRESETS.EVERY_HOUR,
        data: { sourceId: 'test-source', source: {} as any },
        enabled: true,
      };
      await scheduler.addScheduledJob(config);
    });

    it('should update cron expression', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValueOnce([
        {
          id: 'test-update-1',
          key: 'repeat:test-update-1',
          name: 'test',
        } as any,
      ]);

      const result = await scheduler.updateSchedule('test-update-1', {
        cronExpression: CRON_PRESETS.EVERY_6_HOURS,
      });

      expect(result.cronExpression).toBe(CRON_PRESETS.EVERY_6_HOURS);
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should update timezone', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValueOnce([
        {
          id: 'test-update-1',
          key: 'repeat:test-update-1',
          name: 'test',
        } as any,
      ]);

      const result = await scheduler.updateSchedule('test-update-1', {
        timezone: TIMEZONES.NEW_YORK,
      });

      expect(result.timezone).toBe(TIMEZONES.NEW_YORK);
    });

    it('should toggle enabled status', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValueOnce([
        {
          id: 'test-update-1',
          key: 'repeat:test-update-1',
          name: 'test',
        } as any,
      ]);

      const result = await scheduler.updateSchedule('test-update-1', {
        enabled: false,
      });

      expect(result.enabled).toBe(false);
    });

    it('should reject invalid updates', async () => {
      await expect(
        scheduler.updateSchedule('test-update-1', {
          cronExpression: 'invalid cron',
        })
      ).rejects.toThrow('Invalid cron expression');
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(
        scheduler.updateSchedule('non-existent', {
          enabled: false,
        })
      ).rejects.toThrow('Scheduled job not found');
    });
  });

  describe('getScheduledJobs', () => {
    beforeEach(async () => {
      // Add multiple test schedules
      for (let i = 1; i <= 5; i++) {
        const config: ScheduledJobConfig = {
          id: `test-list-${i}`,
          name: `Schedule ${i}`,
          cronExpression: CRON_PRESETS.EVERY_HOUR,
          data: { sourceId: `source-${i}`, source: {} as any },
          enabled: i % 2 === 0, // Even numbers are enabled
        };
        await scheduler.addScheduledJob(config);
      }
    });

    it('should return all schedules', async () => {
      const result = await scheduler.getScheduledJobs();
      expect(result).toHaveLength(5);
    });

    it('should filter by enabled status', async () => {
      const enabled = await scheduler.getScheduledJobs({ enabled: true });
      expect(enabled).toHaveLength(2);
      expect(enabled.every((j) => j.enabled)).toBe(true);

      const disabled = await scheduler.getScheduledJobs({ enabled: false });
      expect(disabled).toHaveLength(3);
      expect(disabled.every((j) => !j.enabled)).toBe(true);
    });

    it('should sort by name', async () => {
      const result = await scheduler.getScheduledJobs({
        sortBy: 'name',
        sortOrder: 'asc',
      });

      for (let i = 0; i < result.length - 1; i++) {
        const current = result[i];
        const next = result[i + 1];
        if (current && next) {
          expect(current.name <= next.name).toBe(true);
        }
      }
    });

    it('should support pagination', async () => {
      const page1 = await scheduler.getScheduledJobs({
        limit: 2,
        offset: 0,
      });
      expect(page1).toHaveLength(2);

      const page2 = await scheduler.getScheduledJobs({
        limit: 2,
        offset: 2,
      });
      expect(page2).toHaveLength(2);

      const page3 = await scheduler.getScheduledJobs({
        limit: 2,
        offset: 4,
      });
      expect(page3).toHaveLength(1);
    });
  });

  describe('getNextRunTime', () => {
    beforeEach(async () => {
      const config: ScheduledJobConfig = {
        id: 'test-next-run',
        name: 'Next Run Test',
        cronExpression: CRON_PRESETS.EVERY_HOUR,
        data: { sourceId: 'test-source', source: {} as any },
        enabled: true,
      };
      await scheduler.addScheduledJob(config);
    });

    it('should calculate next run times', async () => {
      const result = await scheduler.getNextRunTime('test-next-run', 5);

      expect(result.scheduleId).toBe('test-next-run');
      expect(result.isActive).toBe(true);
      expect(result.occurrences).toHaveLength(5);
      expect(result.nextRunTime).toBeDefined();

      // Check that all occurrences are valid dates in the future
      result.occurrences.forEach((occurrence, index) => {
        expect(occurrence).toBeInstanceOf(Date);
        expect(occurrence.getTime()).toBeGreaterThan(
          new Date('2024-01-01').getTime()
        );

        // For dates after the first, ensure they're not in the past relative to previous
        if (index > 0) {
          const previous = result.occurrences[index - 1];
          if (previous) {
            expect(occurrence.getTime()).toBeGreaterThanOrEqual(
              previous.getTime()
            );
          }
        }
      });
    });

    it('should handle disabled schedules', async () => {
      await scheduler.toggleSchedule('test-next-run', false);

      const result = await scheduler.getNextRunTime('test-next-run', 5);
      expect(result.isActive).toBe(false);
      expect(result.reason).toBe('Schedule is disabled');
    });

    it('should throw for non-existent schedule', async () => {
      await expect(scheduler.getNextRunTime('non-existent')).rejects.toThrow(
        'Scheduled job not found'
      );
    });
  });

  describe('checkScheduleConflicts', () => {
    beforeEach(async () => {
      const config: ScheduledJobConfig = {
        id: 'existing-schedule',
        name: 'Existing Schedule',
        cronExpression: CRON_PRESETS.EVERY_HOUR,
        data: { sourceId: 'source-1', source: {} as any },
      };
      await scheduler.addScheduledJob(config);
    });

    it('should detect duplicate ID conflicts', async () => {
      const config: ScheduledJobConfig = {
        id: 'existing-schedule',
        name: 'Duplicate ID',
        cronExpression: CRON_PRESETS.EVERY_2_HOURS,
        data: { sourceId: 'source-2', source: {} as any },
      };

      const conflicts = await scheduler.checkScheduleConflicts(config);
      expect(conflicts).toHaveLength(1);
      if (conflicts[0]) {
        expect(conflicts[0].reason).toBe('duplicate_id');
      }
    });

    it('should detect duplicate time conflicts for same resource', async () => {
      // First add a job that the new one will conflict with
      const existingConfig: ScheduledJobConfig = {
        id: 'existing-hourly',
        name: 'Existing Hourly Job',
        cronExpression: CRON_PRESETS.EVERY_HOUR,
        timezone: TIMEZONES.SEOUL,
        data: { sourceId: 'source-1', source: {} as any },
        metadata: { sourceId: 'source-1' }, // Metadata for conflict detection
      };
      await scheduler.addScheduledJob(existingConfig);

      // Now try to add a conflicting job
      const config: ScheduledJobConfig = {
        id: 'new-schedule',
        name: 'Same Time Same Source',
        cronExpression: CRON_PRESETS.EVERY_HOUR, // Same cron
        timezone: TIMEZONES.SEOUL, // Same timezone
        data: { sourceId: 'source-1', source: {} as any }, // Same source
        metadata: { sourceId: 'source-1' }, // Metadata for conflict detection
      };

      const conflicts = await scheduler.checkScheduleConflicts(config);
      expect(conflicts).toHaveLength(1);
      if (conflicts[0]) {
        expect(conflicts[0].reason).toBe('duplicate_time');
      }
    });

    it('should allow same time for different resources', async () => {
      const config: ScheduledJobConfig = {
        id: 'new-schedule',
        name: 'Same Time Different Source',
        cronExpression: CRON_PRESETS.EVERY_HOUR,
        data: { sourceId: 'source-2', source: {} as any },
      };

      const conflicts = await scheduler.checkScheduleConflicts(config);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('triggerScheduledJob', () => {
    beforeEach(async () => {
      const config: ScheduledJobConfig = {
        id: 'test-trigger',
        name: 'Trigger Test',
        cronExpression: CRON_PRESETS.EVERY_HOUR,
        data: { sourceId: 'test-source', source: {} as any },
      };
      await scheduler.addScheduledJob(config);
    });

    it('should trigger a manual execution', async () => {
      // Mock the queue.add to return the job ID we expect
      mockQueue.add.mockImplementation(
        (_name: string, _data: any, options: any) => {
          return Promise.resolve({ id: options.jobId } as any);
        }
      );

      const jobId = await scheduler.triggerScheduledJob('test-trigger');

      expect(jobId).toBeDefined();
      expect(jobId).toContain('manual_test-trigger');
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.stringContaining('manual_'),
        expect.any(Object),
        expect.objectContaining({
          priority: 10,
          jobId: expect.stringContaining('manual_test-trigger'),
        })
      );
    });

    it('should throw for non-existent schedule', async () => {
      await expect(
        scheduler.triggerScheduledJob('non-existent')
      ).rejects.toThrow('Scheduled job not found');
    });
  });

  describe('CRON_PRESETS', () => {
    it('should have valid cron expressions for all presets', () => {
      Object.values(CRON_PRESETS).forEach((preset) => {
        const result = scheduler.validateCronExpression(preset);
        expect(result.isValid).toBe(true);
      });
    });
  });
});

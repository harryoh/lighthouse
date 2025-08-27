/**
 * Queue monitoring tests
 */

import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { QueueMonitor } from './QueueMonitor';

// Mock Redis
jest.mock('ioredis');

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    name: 'test-queue',
    add: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
    getJobCounts: jest.fn(),
    isPaused: jest.fn(),
    remove: jest.fn(),
  })),
  QueueEvents: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
  Job: jest.fn(),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}));

// Mock zlib
jest.mock('zlib', () => ({
  gzip: jest.fn((data: any) => Buffer.from(data)),
}));

// Mock util
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn(
    (_fn: any) => (data: any) => Promise.resolve(Buffer.from(data))
  ),
}));

// Mock fetch
global.fetch = jest.fn();

describe('QueueMonitor', () => {
  let queue: jest.Mocked<Queue>;
  let redis: jest.Mocked<Redis>;
  let queueEvents: jest.Mocked<QueueEvents>;
  let monitor: QueueMonitor;

  jest.useFakeTimers();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Redis mock
    redis = new Redis() as jest.Mocked<Redis>;
    redis.duplicate = jest.fn().mockReturnValue(redis);
    redis.ping = jest.fn().mockResolvedValue('PONG');

    // Setup Queue mock
    queue = new Queue('test-queue') as jest.Mocked<Queue>;
    Object.defineProperty(queue, 'name', {
      value: 'test-queue',
      writable: false,
      configurable: true,
    });
    queue.getJobCounts = jest.fn().mockResolvedValue({
      active: 5,
      waiting: 10,
      completed: 100,
      failed: 2,
      delayed: 3,
      paused: 0,
      prioritized: 1,
    });
    queue.getJobs = jest.fn().mockResolvedValue([]);
    queue.getJob = jest.fn();

    // Setup QueueEvents mock
    queueEvents = new QueueEvents('test-queue') as jest.Mocked<QueueEvents>;

    // Create monitor
    monitor = new QueueMonitor(queue, redis);
  });

  afterEach(async () => {
    if (monitor) {
      await monitor.close();
    }
    jest.clearAllTimers();
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const metrics = await monitor.getQueueMetrics();

      expect(metrics).toMatchObject({
        queueName: 'test-queue',
        counts: {
          active: 5,
          waiting: 10,
          completed: 100,
          failed: 2,
          delayed: 3,
          paused: 0,
          prioritized: 1,
        },
        throughput: {
          completedPerMinute: 0,
          failedPerMinute: 0,
        },
        averageProcessingTime: 0,
        healthStatus: 'healthy',
      });

      expect(metrics.lastCheck).toBeInstanceOf(Date);
    });

    it('should determine unhealthy status for high failure rate', async () => {
      queue.getJobCounts.mockResolvedValue({
        active: 0,
        waiting: 0,
        completed: 50,
        failed: 60,
        delayed: 0,
        paused: 0,
        prioritized: 0,
      });

      const metrics = await monitor.getQueueMetrics();

      expect(metrics.healthStatus).toBe('unhealthy');
    });

    it('should determine degraded status for moderate failure rate', async () => {
      queue.getJobCounts.mockResolvedValue({
        active: 0,
        waiting: 0,
        completed: 80,
        failed: 25,
        delayed: 0,
        paused: 0,
        prioritized: 0,
      });

      const metrics = await monitor.getQueueMetrics();

      expect(metrics.healthStatus).toBe('degraded');
    });
  });

  describe('getJobDetails', () => {
    it('should return job details', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: { test: 'data' },
        progress: 50,
        attemptsMade: 1,
        failedReason: undefined,
        timestamp: Date.now(),
        finishedOn: undefined,
        processedOn: Date.now(),
        returnvalue: undefined,
      };

      queue.getJob.mockResolvedValue(mockJob as any);

      const details = await monitor.getJobDetails('job-123');

      expect(details).toMatchObject({
        id: 'job-123',
        name: 'test-job',
        data: { test: 'data' },
        progress: 50,
        attemptsMade: 1,
      });
    });

    it('should return null for non-existent job', async () => {
      queue.getJob.mockResolvedValue(null);

      const details = await monitor.getJobDetails('non-existent');

      expect(details).toBeNull();
    });
  });

  describe('cleanupOldJobs', () => {
    it('should remove old completed jobs', async () => {
      const oldJob = {
        id: 'old-job',
        name: 'test-job',
        data: {},
        finishedOn: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        processedOn: Date.now() - 8 * 24 * 60 * 60 * 1000,
        returnvalue: { result: 'success' },
        failedReason: undefined,
        attemptsMade: 1,
        remove: jest.fn().mockResolvedValue(true),
      };

      const recentJob = {
        id: 'recent-job',
        name: 'test-job',
        data: {},
        finishedOn: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
        processedOn: Date.now() - 1 * 24 * 60 * 60 * 1000,
        returnvalue: { result: 'success' },
        failedReason: undefined,
        attemptsMade: 1,
        remove: jest.fn().mockResolvedValue(true),
      };

      queue.getJobs.mockResolvedValue([oldJob, recentJob] as any);

      const removedCount = await monitor.cleanupOldJobs();

      expect(removedCount).toBe(1);
      expect(oldJob.remove).toHaveBeenCalled();
      expect(recentJob.remove).not.toHaveBeenCalled();
    });

    it('should archive jobs before deletion', async () => {
      const fs = await import('fs/promises');
      const oldJob = {
        id: 'old-job',
        name: 'test-job',
        data: { test: 'data' },
        finishedOn: Date.now() - 8 * 24 * 60 * 60 * 1000,
        processedOn: Date.now() - 8 * 24 * 60 * 60 * 1000,
        returnvalue: { result: 'success' },
        failedReason: undefined,
        attemptsMade: 1,
        remove: jest.fn().mockResolvedValue(true),
      };

      queue.getJobs.mockResolvedValue([oldJob] as any);

      await monitor.cleanupOldJobs();

      expect(fs.mkdir).toHaveBeenCalledWith('./archives/jobs', {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('getHealthCheck', () => {
    it('should return healthy status', async () => {
      const health = await monitor.getHealthCheck();

      expect(health).toMatchObject({
        status: 'healthy',
        redis: true,
        queue: true,
      });
      expect(health.metrics).toBeDefined();
    });

    it('should return unhealthy status on Redis failure', async () => {
      redis.ping.mockRejectedValue(new Error('Redis connection failed'));

      const health = await monitor.getHealthCheck();

      expect(health).toMatchObject({
        status: 'unhealthy',
        redis: false,
        queue: false,
      });
    });

    it('should return unhealthy status for unhealthy queue', async () => {
      queue.getJobCounts.mockResolvedValue({
        active: 0,
        waiting: 0,
        completed: 10,
        failed: 90,
        delayed: 0,
        paused: 0,
        prioritized: 0,
      });

      const health = await monitor.getHealthCheck();

      expect(health).toMatchObject({
        status: 'unhealthy',
        redis: true,
        queue: false,
      });
    });
  });

  describe('Alert system', () => {
    it('should configure alerts', () => {
      const alertConfigs = [
        {
          type: 'console' as const,
          threshold: {
            failedJobsPercentage: 20,
            queueSizeLimit: 100,
          },
        },
      ];

      expect(() => monitor.configureAlerts(alertConfigs)).not.toThrow();
    });

    it('should emit alert event when threshold breached', async () => {
      const alertSpy = jest.fn();
      monitor.on('alert:sent', alertSpy);

      monitor.configureAlerts([
        {
          type: 'console' as const,
          threshold: {
            failedJobsPercentage: 10,
          },
        },
      ]);

      queue.getJobCounts.mockResolvedValue({
        active: 0,
        waiting: 0,
        completed: 70,
        failed: 30,
        delayed: 0,
        paused: 0,
        prioritized: 0,
      });

      // Trigger alert check by emitting failed event
      const failedHandler = (queueEvents.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'failed'
      )?.[1];

      if (failedHandler) {
        await failedHandler({
          jobId: 'test-job',
          failedReason: 'Test failure',
        });
      }

      // Wait for async operations
      jest.advanceTimersByTime(1);

      expect(alertSpy).toHaveBeenCalled();
    });

    it('should send webhook alert', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      monitor.configureAlerts([
        {
          type: 'webhook' as const,
          threshold: {
            queueSizeLimit: 5,
          },
          recipient: 'https://example.com/webhook',
        },
      ]);

      queue.getJobCounts.mockResolvedValue({
        active: 3,
        waiting: 10,
        completed: 100,
        failed: 2,
        delayed: 0,
        paused: 0,
        prioritized: 0,
      });

      // Trigger alert check
      const failedHandler = (queueEvents.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'failed'
      )?.[1];

      if (failedHandler) {
        await failedHandler({
          jobId: 'test-job',
          failedReason: 'Test failure',
        });
      }

      // Wait for async operations
      jest.advanceTimersByTime(1);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('Event listeners', () => {
    it('should listen for job events', () => {
      const events = ['completed', 'failed', 'stalled', 'progress', 'removed'];

      for (const event of events) {
        const handler = (queueEvents.on as jest.Mock).mock.calls.find(
          (call) => call[0] === event
        );
        expect(handler).toBeDefined();
      }
    });

    it('should emit custom events', async () => {
      const completedSpy = jest.fn();
      const failedSpy = jest.fn();

      monitor.on('job:completed', completedSpy);
      monitor.on('job:failed', failedSpy);

      // Trigger completed event
      const completedHandler = (queueEvents.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'completed'
      )?.[1];

      if (completedHandler) {
        await completedHandler({
          jobId: 'job-1',
          returnvalue: { result: 'success' },
        });
      }

      expect(completedSpy).toHaveBeenCalledWith({
        jobId: 'job-1',
        returnvalue: { result: 'success' },
      });

      // Trigger failed event
      const failedHandler = (queueEvents.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'failed'
      )?.[1];

      if (failedHandler) {
        await failedHandler({ jobId: 'job-2', failedReason: 'Error occurred' });
      }

      expect(failedSpy).toHaveBeenCalledWith({
        jobId: 'job-2',
        failedReason: 'Error occurred',
      });
    });

    it('should move failed job to DLQ after max retries', async () => {
      const failedJob = {
        id: 'failed-job',
        name: 'test-job',
        data: { test: 'data' },
        attemptsMade: 3,
        opts: { attempts: 3 },
        failedReason: 'Max retries exceeded',
        remove: jest.fn().mockResolvedValue(true),
      };

      queue.getJob.mockResolvedValue(failedJob as any);

      const dlqQueue = new Queue('test-queue-dlq') as jest.Mocked<Queue>;
      dlqQueue.add = jest.fn().mockResolvedValue({ id: 'dlq-job' });

      // Mock Queue constructor to return DLQ
      (Queue as unknown as jest.Mock).mockImplementationOnce(() => dlqQueue);

      const failedHandler = (queueEvents.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'failed'
      )?.[1];

      if (failedHandler) {
        await failedHandler({
          jobId: 'failed-job',
          failedReason: 'Max retries exceeded',
        });
      }

      // Wait for async operations
      jest.advanceTimersByTime(1);

      expect(dlqQueue.add).toHaveBeenCalledWith(
        'failed-job',
        expect.objectContaining({
          originalJobId: 'failed-job',
          originalQueue: 'test-queue',
          data: { test: 'data' },
          failedReason: 'Max retries exceeded',
        })
      );

      expect(failedJob.remove).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should clean up resources', async () => {
      // Get the actual queueEvents instance from the monitor
      const actualQueueEvents = (monitor as any).queueEvents;
      actualQueueEvents.close = jest.fn();

      await monitor.close();

      expect(actualQueueEvents.close).toHaveBeenCalled();
    });
  });
});

/**
 * Tests for QueueFactory
 */

import { QueueFactory } from './QueueFactory';
import { Queue, Worker } from 'bullmq';
import * as winston from 'winston';
import { ExtendedQueueConfig } from './QueueInterface';

// Mock bullmq
jest.mock('bullmq');

describe('QueueFactory', () => {
  let factory: QueueFactory;
  let mockLogger: jest.Mocked<winston.Logger>;
  let mockQueue: jest.Mocked<Queue>;
  let mockWorker: jest.Mocked<Worker>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create mock Queue
    mockQueue = {
      close: jest.fn().mockResolvedValue(undefined),
      name: 'test-queue',
    } as any;

    // Create mock Worker
    mockWorker = {
      close: jest.fn().mockResolvedValue(undefined),
      name: 'test-worker',
      on: jest.fn(),
    } as any;

    // Mock Queue constructor
    (Queue as any).mockImplementation(() => mockQueue);

    // Mock Worker constructor
    (Worker as any).mockImplementation(() => mockWorker);

    factory = new QueueFactory(mockLogger);
  });

  describe('createCrawlQueue', () => {
    it('should create a crawl queue with default config', async () => {
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      const queue = await factory.createCrawlQueue(config);

      expect(queue).toBe(mockQueue);
      expect(Queue).toHaveBeenCalledWith(
        'test-crawl',
        expect.objectContaining({
          connection: expect.any(Object),
          defaultJobOptions: expect.objectContaining({
            attempts: 3,
            backoff: expect.objectContaining({
              type: 'exponential',
              delay: 5000,
            }),
          }),
        })
      );
    });

    it('should reuse existing crawl queue', async () => {
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      const queue1 = await factory.createCrawlQueue(config);
      const queue2 = await factory.createCrawlQueue(config);

      expect(queue1).toBe(queue2);
      expect(Queue).toHaveBeenCalledTimes(1);
    });
  });

  describe('createAnalysisQueue', () => {
    it('should create an analysis queue with default config', async () => {
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      const queue = await factory.createAnalysisQueue(config);

      expect(queue).toBe(mockQueue);
      expect(Queue).toHaveBeenCalledWith(
        'test-analysis',
        expect.objectContaining({
          connection: expect.any(Object),
          defaultJobOptions: expect.objectContaining({
            attempts: 2,
            backoff: expect.objectContaining({
              type: 'fixed',
              delay: 3000,
            }),
          }),
        })
      );
    });

    it('should reuse existing analysis queue', async () => {
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      const queue1 = await factory.createAnalysisQueue(config);
      const queue2 = await factory.createAnalysisQueue(config);

      expect(queue1).toBe(queue2);
      expect(Queue).toHaveBeenCalledTimes(1);
    });
  });

  describe('createScheduledQueue', () => {
    it('should create a scheduled queue', async () => {
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      const queue = await factory.createScheduledQueue(config);

      expect(queue).toBe(mockQueue);
      expect(Queue).toHaveBeenCalledWith(
        'test-scheduled',
        expect.objectContaining({
          connection: expect.any(Object),
        })
      );
    });
  });

  describe('createDeadLetterQueue', () => {
    it('should create a dead-letter queue', async () => {
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      const queue = await factory.createDeadLetterQueue(config);

      expect(queue).toBe(mockQueue);
      expect(Queue).toHaveBeenCalledWith(
        'test-dlq',
        expect.objectContaining({
          connection: expect.any(Object),
        })
      );
    });
  });

  describe('createCrawlWorker', () => {
    it('should create a crawler worker with processor', async () => {
      const processor = jest.fn();
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      const worker = await factory.createCrawlWorker(config, processor);

      expect(worker).toBe(mockWorker);
      expect(Worker).toHaveBeenCalledWith(
        'test-crawl',
        processor,
        expect.objectContaining({
          connection: expect.any(Object),
          concurrency: 5,
        })
      );
    });

    it('should reuse existing crawler worker', async () => {
      const processor = jest.fn();
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      const worker1 = await factory.createCrawlWorker(config, processor);
      const worker2 = await factory.createCrawlWorker(config, processor);

      expect(worker1).toBe(worker2);
      expect(Worker).toHaveBeenCalledTimes(1);
    });
  });

  describe('createAnalysisWorker', () => {
    it('should create an analysis worker with processor', async () => {
      const processor = jest.fn();
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      const worker = await factory.createAnalysisWorker(config, processor);

      expect(worker).toBe(mockWorker);
      expect(Worker).toHaveBeenCalledWith(
        'test-analysis',
        processor,
        expect.objectContaining({
          connection: expect.any(Object),
          concurrency: 10,
        })
      );
    });
  });

  describe('createScheduledWorker', () => {
    it('should create a scheduled worker with processor', async () => {
      const processor = jest.fn();
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      const worker = await factory.createScheduledWorker(config, processor);

      expect(worker).toBe(mockWorker);
      expect(Worker).toHaveBeenCalledWith(
        'test-scheduled',
        processor,
        expect.objectContaining({
          connection: expect.any(Object),
          concurrency: 2,
        })
      );
    });
  });

  describe('getQueue', () => {
    it('should return existing queue', async () => {
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      await factory.createCrawlQueue(config);
      const queue = factory.getQueue('test-crawl');

      expect(queue).toBe(mockQueue);
    });

    it('should return undefined for non-existent queue', () => {
      const queue = factory.getQueue('non-existent');

      expect(queue).toBeUndefined();
    });
  });

  describe('getWorker', () => {
    it('should return existing worker', async () => {
      const processor = jest.fn();
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      await factory.createCrawlWorker(config, processor);
      const worker = factory.getWorker('test-crawl-worker');

      expect(worker).toBe(mockWorker);
    });

    it('should return undefined for non-existent worker', () => {
      const worker = factory.getWorker('non-existent');

      expect(worker).toBeUndefined();
    });
  });

  describe('getAllQueues', () => {
    it('should return all queues', async () => {
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      await factory.createCrawlQueue(config);
      await factory.createAnalysisQueue(config);

      const queues = factory.getAllQueues();

      expect(queues.size).toBe(2);
      expect(queues.has('test-crawl')).toBe(true);
      expect(queues.has('test-analysis')).toBe(true);
    });

    it('should return empty map when no queues', () => {
      const queues = factory.getAllQueues();

      expect(queues.size).toBe(0);
    });
  });

  describe('getAllWorkers', () => {
    it('should return all workers', async () => {
      const processor = jest.fn();
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      await factory.createCrawlWorker(config, processor);
      await factory.createAnalysisWorker(config, processor);

      const workers = factory.getAllWorkers();

      expect(workers.size).toBe(2);
      expect(workers.has('test-crawl-worker')).toBe(true);
      expect(workers.has('test-analysis-worker')).toBe(true);
    });

    it('should return empty map when no workers', () => {
      const workers = factory.getAllWorkers();

      expect(workers.size).toBe(0);
    });
  });

  describe('closeAll', () => {
    it('should close all queues and workers', async () => {
      const config: ExtendedQueueConfig = {
        name: 'test',
        connection: { host: 'localhost', port: 6379 },
      };
      await factory.createCrawlQueue(config);
      await factory.createAnalysisQueue(config);
      const processor = jest.fn();
      await factory.createCrawlWorker(config, processor);

      await factory.closeAll();

      expect(mockQueue.close).toHaveBeenCalledTimes(2);
      expect(mockWorker.close).toHaveBeenCalledTimes(1);
    });
  });
});

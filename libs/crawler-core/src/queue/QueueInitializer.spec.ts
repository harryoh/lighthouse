/**
 * Tests for QueueInitializer
 */

import {
  QueueInitializer,
  QueueSystemConfig,
  JobProcessors,
} from './QueueInitializer';
import { QueueFactory } from './QueueFactory';
import { RedisConnectionManager } from './RedisConnectionManager';
import { QueueManager } from './QueueManager';
import { Queue, Worker } from 'bullmq';
import * as winston from 'winston';

// Mock the queue factory and redis manager
jest.mock('./QueueFactory');
jest.mock('./RedisConnectionManager');
jest.mock('./QueueManager');

describe('QueueInitializer', () => {
  let initializer: QueueInitializer;
  let mockQueueFactory: jest.Mocked<QueueFactory>;
  let mockRedisManager: jest.Mocked<RedisConnectionManager>;
  let mockQueueManager: jest.Mocked<QueueManager>;
  let mockQueue: jest.Mocked<Queue>;
  let mockWorker: jest.Mocked<Worker>;
  let mockLogger: jest.Mocked<winston.Logger>;
  let defaultConfig: QueueSystemConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create default config
    defaultConfig = {
      redis: {
        host: 'localhost',
        port: 6379,
      },
      queues: {
        crawl: { enabled: true },
        analysis: { enabled: true },
        scheduled: { enabled: true },
      },
      deadLetterQueue: { enabled: true },
      healthCheck: { enabled: false }, // Disable health checks to prevent intervals
    };

    // Create mock queue
    mockQueue = {
      close: jest.fn().mockResolvedValue(undefined),
      name: 'test-queue',
    } as any;

    // Create mock worker
    mockWorker = {
      close: jest.fn().mockResolvedValue(undefined),
      name: 'test-worker',
    } as any;

    // Create mock queue manager
    mockQueueManager = {
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create mock queue factory
    mockQueueFactory = {
      createCrawlQueue: jest.fn().mockReturnValue(mockQueue),
      createAnalysisQueue: jest.fn().mockReturnValue(mockQueue),
      createScheduledQueue: jest.fn().mockReturnValue(mockQueue),
      createDeadLetterQueue: jest.fn().mockReturnValue(mockQueue),
      createCrawlWorker: jest.fn().mockReturnValue(mockWorker),
      createAnalysisWorker: jest.fn().mockReturnValue(mockWorker),
      createScheduledWorker: jest.fn().mockReturnValue(mockWorker),
      getQueue: jest.fn().mockReturnValue(mockQueue),
      getWorker: jest.fn().mockReturnValue(mockWorker),
      closeAll: jest.fn().mockResolvedValue(undefined),
      getAllQueues: jest.fn().mockReturnValue(new Map()),
      getAllWorkers: jest.fn().mockReturnValue(new Map()),
    } as any;

    // Create mock redis manager
    mockRedisManager = {
      createConnection: jest.fn().mockReturnValue({}),
      getConnection: jest.fn().mockReturnValue({}),
      closeConnection: jest.fn().mockResolvedValue(undefined),
      closeAll: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest
        .fn()
        .mockResolvedValue({ isConnected: true, lastHealthCheck: new Date() }),
      checkConnectionHealth: jest.fn().mockResolvedValue(true),
      startHealthChecks: jest.fn(),
      stopHealthChecks: jest.fn(),
    } as any;

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Mock the constructors to return our mocks
    (QueueFactory as any).mockImplementation(() => mockQueueFactory);
    (RedisConnectionManager as any).mockImplementation(() => mockRedisManager);
    (QueueManager as any).mockImplementation(() => mockQueueManager);

    initializer = new QueueInitializer(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize all queues and workers', async () => {
      const processors: JobProcessors = {
        crawl: jest.fn(),
        analysis: jest.fn(),
        scheduled: jest.fn(),
      };

      await initializer.initialize(defaultConfig, processors);

      // Verify queues are created
      expect(mockQueueFactory.createCrawlQueue).toHaveBeenCalled();
      expect(mockQueueFactory.createAnalysisQueue).toHaveBeenCalled();
      expect(mockQueueFactory.createScheduledQueue).toHaveBeenCalled();
      expect(mockQueueFactory.createDeadLetterQueue).toHaveBeenCalled();

      // Verify workers are created with correct parameters
      expect(mockQueueFactory.createCrawlWorker).toHaveBeenCalledWith(
        expect.any(Object),
        processors.crawl
      );
      expect(mockQueueFactory.createAnalysisWorker).toHaveBeenCalledWith(
        expect.any(Object),
        processors.analysis
      );
      expect(mockQueueFactory.createScheduledWorker).toHaveBeenCalledWith(
        expect.any(Object),
        processors.scheduled
      );
    });

    it('should not initialize twice', async () => {
      await initializer.initialize(defaultConfig);
      await initializer.initialize(defaultConfig);

      // Should only be called once
      expect(mockQueueFactory.createCrawlQueue).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      // Make checkConnectionHealth fail
      mockRedisManager.checkConnectionHealth = jest
        .fn()
        .mockResolvedValue(false);

      await expect(initializer.initialize(defaultConfig)).rejects.toThrow(
        'Failed to connect to Redis'
      );
    });
  });

  describe('shutdown', () => {
    it('should shutdown all queues and connections', async () => {
      await initializer.initialize(defaultConfig);
      await initializer.shutdown();

      expect(mockQueueFactory.closeAll).toHaveBeenCalled();
      expect(mockRedisManager.closeAll).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(initializer.shutdown()).resolves.not.toThrow();
    });

    it('should throw when shutdown fails', async () => {
      await initializer.initialize(defaultConfig);
      mockQueueFactory.closeAll.mockRejectedValue(new Error('Close failed'));

      // Should throw the error
      await expect(initializer.shutdown()).rejects.toThrow('Close failed');
    });
  });

  // Note: getHealth and getStats methods were removed from QueueInitializer
  // These tests are removed as the methods no longer exist
});

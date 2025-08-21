/**
 * Tests for RedisConnectionManager
 */

// Mock ioredis module BEFORE importing modules that use it
jest.mock('ioredis', () => {
  return {
    __esModule: true,
    Redis: jest.fn(),
  };
});

import { RedisConnectionManager } from './RedisConnectionManager';
import type { Redis } from 'ioredis';

// Get the mocked Redis constructor
const RedisMock = require('ioredis').Redis;

describe('RedisConnectionManager', () => {
  let manager: RedisConnectionManager;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Redis instance
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
      on: jest.fn(),
      duplicate: jest.fn(),
      info: jest
        .fn()
        .mockResolvedValue(
          'redis_version:6.2.0\r\nused_memory_human:10M\r\nconnected_clients:5\r\nuptime_in_seconds:3600'
        ),
    } as any;

    // Mock Redis constructor
    RedisMock.mockImplementation(() => mockRedis);

    manager = new RedisConnectionManager({
      host: 'localhost',
      port: 6379,
    });
  });

  afterEach(async () => {
    await manager.closeAll();
  });

  describe('createConnection', () => {
    it('should create and return a new connection', () => {
      const connection = manager.createConnection('test');

      expect(connection).toBeDefined();
      expect(RedisMock).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          connectionName: 'test',
        })
      );
    });

    it('should reuse existing connection for same key', () => {
      const connection1 = manager.createConnection('test');
      const connection2 = manager.createConnection('test');

      expect(connection1).toBe(connection2);
      expect(RedisMock).toHaveBeenCalledTimes(1);
    });

    it('should create different connections for different keys', () => {
      const mockRedis2 = { ...mockRedis } as any;
      let callCount = 0;
      RedisMock.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockRedis : mockRedis2;
      });

      const connection1 = manager.createConnection('test1');
      const connection2 = manager.createConnection('test2');

      expect(connection1).not.toBe(connection2);
      expect(RedisMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('closeConnection', () => {
    it('should close and remove a connection', async () => {
      manager.createConnection('test');
      await manager.closeConnection('test');

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle closing non-existent connection gracefully', async () => {
      await expect(
        manager.closeConnection('non-existent')
      ).resolves.not.toThrow();
    });
  });

  describe('closeAll', () => {
    it('should close all connections', async () => {
      manager.createConnection('test1');
      manager.createConnection('test2');
      await manager.closeAll();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when Redis responds to ping', async () => {
      manager.createConnection('test');
      const health = await manager.healthCheck();

      expect(health.isConnected).toBe(true);
      expect(health.lastHealthCheck).toBeInstanceOf(Date);
      expect(health.redisInfo).toBeDefined();
      expect(health.redisInfo?.version).toBe('6.2.0');
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should return unhealthy when Redis ping fails', async () => {
      manager.createConnection('test');
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const health = await manager.healthCheck();

      expect(health.isConnected).toBe(false);
    });

    it('should return healthy when no connections exist (empty array)', async () => {
      const emptyManager = new RedisConnectionManager({
        host: 'localhost',
        port: 6379,
      });

      const health = await emptyManager.healthCheck();

      // Note: This returns true because .every() on empty array returns true
      // This is actually correct behavior - no connections means no failures
      expect(health.isConnected).toBe(true);
    });
  });

  describe('getConnection', () => {
    it('should return an existing connection', () => {
      manager.createConnection('test');
      const connection = manager.getConnection('test');

      expect(connection).toBe(mockRedis);
    });

    it('should return undefined for non-existent connection', () => {
      const connection = manager.getConnection('non-existent');

      expect(connection).toBeUndefined();
    });
  });
});

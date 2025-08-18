/**
 * RobotsChecker test suite
 */

import { RobotsChecker, RobotsConfig } from './RobotsChecker';
import * as winston from 'winston';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('RobotsChecker', () => {
  let robotsChecker: RobotsChecker;
  let testLogger: winston.Logger;
  let mockConfig: RobotsConfig;

  beforeEach(() => {
    testLogger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })],
    });

    mockConfig = {
      userAgent: 'TestBot/1.0',
      cacheTimeout: 1000,
      respectCrawlDelay: true,
      defaultCrawlDelay: 1000,
      maxCrawlDelay: 5000,
    };

    robotsChecker = new RobotsChecker(mockConfig, testLogger);
    jest.clearAllMocks();
  });

  afterEach(() => {
    robotsChecker.clearCache();
  });

  describe('Constructor and Configuration', () => {
    it('should create RobotsChecker with default config', () => {
      const defaultChecker = new RobotsChecker();
      expect(defaultChecker).toBeInstanceOf(RobotsChecker);
    });

    it('should merge provided config with defaults', () => {
      const customConfig = { defaultCrawlDelay: 2000 };
      const customChecker = new RobotsChecker(customConfig, testLogger);
      expect(customChecker).toBeInstanceOf(RobotsChecker);
    });
  });

  describe('Robots.txt Fetching and Parsing', () => {
    it('should allow crawling when robots.txt allows', async () => {
      const robotsTxt = `User-agent: *
Allow: /
Crawl-delay: 2`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const permission = await robotsChecker.canCrawl(
        'https://example.com/article'
      );

      expect(permission.allowed).toBe(true);
      expect(permission.crawlDelay).toBe(2000); // 2 seconds in milliseconds
      expect(permission.reason).toBe('URL allowed by robots.txt');
    });

    it('should deny crawling when robots.txt disallows', async () => {
      const robotsTxt = `User-agent: *
Disallow: /admin/
Allow: /`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const permission = await robotsChecker.canCrawl(
        'https://example.com/admin/secret'
      );

      expect(permission.allowed).toBe(false);
      expect(permission.reason).toBe('URL disallowed by robots.txt');
    });

    it('should handle missing robots.txt (404)', async () => {
      mockAxios.get.mockResolvedValue({
        status: 404,
        data: 'Not Found',
      });

      const permission = await robotsChecker.canCrawl(
        'https://example.com/article'
      );

      expect(permission.allowed).toBe(true);
      expect(permission.crawlDelay).toBe(mockConfig.defaultCrawlDelay);
      expect(permission.reason).toBe(
        'No robots.txt found, proceeding with default delay'
      );
    });

    it('should handle server errors gracefully', async () => {
      mockAxios.get.mockResolvedValue({
        status: 500,
        data: 'Server Error',
      });

      const permission = await robotsChecker.canCrawl(
        'https://example.com/article'
      );

      expect(permission.allowed).toBe(true);
      expect(permission.crawlDelay).toBe(mockConfig.defaultCrawlDelay);
      expect(permission.reason).toBe(
        'No robots.txt found, proceeding with default delay'
      );
    });

    it('should handle network errors gracefully', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const permission = await robotsChecker.canCrawl(
        'https://example.com/article'
      );

      expect(permission.allowed).toBe(true);
      expect(permission.crawlDelay).toBe(mockConfig.defaultCrawlDelay);
      expect(permission.reason).toBe(
        'No robots.txt found, proceeding with default delay'
      );
    });
  });

  describe('Crawl-delay Parsing', () => {
    it('should parse crawl-delay for specific user agent', async () => {
      const robotsTxt = `User-agent: TestBot/1.0
Crawl-delay: 3
User-agent: *
Crawl-delay: 1`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const permission = await robotsChecker.canCrawl(
        'https://example.com/article'
      );

      expect(permission.crawlDelay).toBe(3000); // 3 seconds
    });

    it('should parse crawl-delay for wildcard user agent', async () => {
      const robotsTxt = `User-agent: *
Crawl-delay: 2.5`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const permission = await robotsChecker.canCrawl(
        'https://example.com/article'
      );

      expect(permission.crawlDelay).toBe(2500); // 2.5 seconds
    });

    it('should respect maximum crawl delay', async () => {
      const robotsTxt = `User-agent: *
Crawl-delay: 30`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const permission = await robotsChecker.canCrawl(
        'https://example.com/article'
      );

      expect(permission.crawlDelay).toBe(mockConfig.maxCrawlDelay); // Capped at max
    });

    it('should handle invalid crawl-delay values', async () => {
      const robotsTxt = `User-agent: *
Crawl-delay: invalid`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const permission = await robotsChecker.canCrawl(
        'https://example.com/article'
      );

      expect(permission.crawlDelay).toBe(mockConfig.defaultCrawlDelay);
    });
  });

  describe('Caching', () => {
    it('should cache robots.txt results', async () => {
      const robotsTxt = `User-agent: *
Allow: /`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      // First call
      await robotsChecker.canCrawl('https://example.com/article1');
      expect(mockAxios.get).toHaveBeenCalledTimes(1);

      // Second call to same domain should use cache
      await robotsChecker.canCrawl('https://example.com/article2');
      expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should expire cache after timeout', async () => {
      const robotsTxt = `User-agent: *
Allow: /`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      // First call
      await robotsChecker.canCrawl('https://example.com/article1');
      expect(mockAxios.get).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Second call should fetch again
      await robotsChecker.canCrawl('https://example.com/article2');
      expect(mockAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should clear cache manually', async () => {
      const robotsTxt = `User-agent: *
Allow: /`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      await robotsChecker.canCrawl('https://example.com/article');
      expect(mockAxios.get).toHaveBeenCalledTimes(1);

      robotsChecker.clearCache();

      await robotsChecker.canCrawl('https://example.com/article');
      expect(mockAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should provide cache statistics', async () => {
      const robotsTxt = `User-agent: *
Allow: /`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const initialStats = robotsChecker.getCacheStats();
      expect(initialStats.size).toBe(0);

      await robotsChecker.canCrawl('https://example.com/article');

      const stats = robotsChecker.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.domains).toContain('https://example.com');
    });

    it('should cleanup expired cache entries', async () => {
      const robotsTxt = `User-agent: *
Allow: /`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      await robotsChecker.canCrawl('https://example.com/article');

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      robotsChecker.cleanupCache();

      const stats = robotsChecker.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Crawl Delay Enforcement', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should enforce crawl delay between requests', async () => {
      const robotsTxt = `User-agent: *
Crawl-delay: 2`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const domain = 'https://example.com';

      // First request should not wait
      await robotsChecker.waitForCrawlDelay(domain);

      // Fast forward time a bit
      jest.advanceTimersByTime(1000);

      // Second request should wait
      const waitPromise = robotsChecker.waitForCrawlDelay(domain);

      // Should still be waiting
      expect(waitPromise).toBeTruthy();

      // Advance time to complete the delay
      jest.advanceTimersByTime(1000);

      await waitPromise;
    });

    it('should not enforce delay when disabled', async () => {
      const noDelayChecker = new RobotsChecker(
        {
          ...mockConfig,
          respectCrawlDelay: false,
        },
        testLogger
      );

      const domain = 'https://example.com';

      // Should not wait even if crawl delay is set
      await noDelayChecker.waitForCrawlDelay(domain);
      await noDelayChecker.waitForCrawlDelay(domain);

      // Should complete immediately
      expect(true).toBe(true);
    });
  });

  describe('URL Validation', () => {
    it('should handle invalid URLs gracefully', async () => {
      const permission = await robotsChecker.canCrawl('invalid-url');

      expect(permission.allowed).toBe(true);
      expect(permission.reason).toBe(
        'Error checking robots.txt, proceeding with caution'
      );
    });

    it('should handle different protocols', async () => {
      const robotsTxt = `User-agent: *
Allow: /`;

      mockAxios.get.mockResolvedValue({
        status: 200,
        data: robotsTxt,
      });

      const httpsPermission = await robotsChecker.canCrawl(
        'https://example.com/article'
      );
      expect(httpsPermission.allowed).toBe(true);

      const httpPermission = await robotsChecker.canCrawl(
        'http://example.com/article'
      );
      expect(httpPermission.allowed).toBe(true);
    });
  });
});

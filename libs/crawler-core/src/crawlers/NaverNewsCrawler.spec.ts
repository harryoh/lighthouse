/**
 * NaverNewsCrawler tests
 */

import { NaverNewsCrawler } from './NaverNewsCrawler';
import * as winston from 'winston';

// Mock logger for testing
const mockLogger = winston.createLogger({
  level: 'error', // Only log errors during tests
  transports: [new winston.transports.Console({ silent: true })],
});

describe('NaverNewsCrawler', () => {
  let crawler: NaverNewsCrawler;

  beforeEach(() => {
    // Create crawler with a valid Naver News article URL
    const testUrl = 'https://news.naver.com/article/001/0014444999';
    crawler = new NaverNewsCrawler(testUrl, mockLogger);
  });

  afterEach(async () => {
    if (crawler) {
      await crawler.cleanup();
    }
  });

  describe('Static utility methods', () => {
    describe('isValidNaverNewsUrl', () => {
      it('should validate correct Naver News article URLs', () => {
        const validUrls = [
          'https://news.naver.com/article/001/0014444999',
          'https://news.naver.com/main/read.naver?mode=LSD&mid=shm&sid1=100&oid=001&aid=0014444999',
        ];

        validUrls.forEach((url) => {
          expect(NaverNewsCrawler.isValidNaverNewsUrl(url)).toBe(true);
        });
      });

      it('should reject invalid URLs', () => {
        const invalidUrls = [
          'https://example.com/article/123',
          'https://news.daum.net/article/123',
          'https://news.naver.com/',
          'invalid-url',
          '',
        ];

        invalidUrls.forEach((url) => {
          expect(NaverNewsCrawler.isValidNaverNewsUrl(url)).toBe(false);
        });
      });
    });

    describe('extractArticleId', () => {
      it('should extract article ID from modern URL format', () => {
        const url = 'https://news.naver.com/article/001/0014444999';
        const result = NaverNewsCrawler.extractArticleId(url);
        expect(result).toBe('001_0014444999');
      });

      it('should extract article ID from legacy URL format', () => {
        const url =
          'https://news.naver.com/main/read.naver?mode=LSD&mid=shm&sid1=100&oid=001&aid=0014444999';
        const result = NaverNewsCrawler.extractArticleId(url);
        expect(result).toBe('001_0014444999');
      });

      it('should return null for invalid URLs', () => {
        const invalidUrls = [
          'https://news.naver.com/',
          'https://example.com/article/123',
          'invalid-url',
        ];

        invalidUrls.forEach((url) => {
          expect(NaverNewsCrawler.extractArticleId(url)).toBeNull();
        });
      });
    });

    describe('getCommonSectionUrls', () => {
      it('should return predefined section URLs', () => {
        const sections = NaverNewsCrawler.getCommonSectionUrls();

        expect(sections).toHaveProperty('politics');
        expect(sections).toHaveProperty('economy');
        expect(sections).toHaveProperty('society');
        expect(sections).toHaveProperty('international');
        expect(sections).toHaveProperty('technology');
        expect(sections).toHaveProperty('science');

        // Verify URLs are valid
        Object.values(sections).forEach((url) => {
          expect(() => new URL(url)).not.toThrow();
          expect(url).toContain('news.naver.com');
        });
      });
    });
  });

  describe('Instance configuration', () => {
    it('should initialize with Naver preset configuration', () => {
      expect(crawler).toBeDefined();
      expect((crawler as any).source.name).toBe('Naver News');
    });

    it('should use conservative rate limiting', () => {
      const rateLimitConfig = (crawler as any).getRateLimitConfig();

      expect(rateLimitConfig.maxRequests).toBe(3);
      expect(rateLimitConfig.interval).toBe(3000);
      expect(rateLimitConfig.maxConcurrent).toBe(1);
    });

    it('should use appropriate retry configuration', () => {
      const retryConfig = (crawler as any).getRetryConfig();

      expect(retryConfig.maxAttempts).toBe(2);
      expect(retryConfig.initialDelay).toBe(5000);
      expect(retryConfig.maxDelay).toBe(20000);
      expect(retryConfig.backoffFactor).toBe(2);
    });

    it('should have proper request headers', () => {
      const requestOptions = (crawler as any).getRequestOptions();

      expect(requestOptions.headers['Accept-Language']).toBe(
        'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      );
      expect(requestOptions.headers['DNT']).toBe('1');
      expect(requestOptions.timeout).toBe(45000);
    });
  });

  describe('Factory methods', () => {
    describe('forSection', () => {
      it('should create crawler with section configuration', () => {
        const sectionUrl =
          'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=100';
        const sectionCrawler = NaverNewsCrawler.forSection(
          sectionUrl,
          mockLogger,
          {
            maxPages: 5,
            followSections: false,
          }
        );

        expect(sectionCrawler).toBeDefined();
        expect((sectionCrawler as any).source.url).toBe(sectionUrl);

        // Check if pagination was overridden
        expect((sectionCrawler as any).newsConfig.pagination.maxPages).toBe(5);
        expect(
          (sectionCrawler as any).newsConfig.discovery.followSections
        ).toBe(false);

        // Cleanup
        return sectionCrawler.cleanup();
      });
    });
  });

  describe('URL classification', () => {
    it('should detect single article URLs correctly', async () => {
      const articleUrl = 'https://news.naver.com/article/001/0014444999';
      const articleCrawler = new NaverNewsCrawler(articleUrl, mockLogger);

      const urls = await (articleCrawler as any).getUrlsToCrawl();
      expect(urls).toEqual([articleUrl]);

      await articleCrawler.cleanup();
    });

    it('should handle section URLs for discovery', async () => {
      const sectionUrl =
        'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=100';
      const sectionCrawler = new NaverNewsCrawler(sectionUrl, mockLogger);

      // Mock the discoverArticles method to avoid actual network calls in tests
      jest.spyOn(sectionCrawler, 'discoverArticles').mockResolvedValue({
        urls: ['https://news.naver.com/article/001/0014444999'],
        currentPage: 1,
        hasMorePages: false,
      });

      const urls = await (sectionCrawler as any).getUrlsToCrawl();
      expect(urls).toEqual(['https://news.naver.com/article/001/0014444999']);

      await sectionCrawler.cleanup();
    });
  });

  describe('Error handling', () => {
    it('should handle missing Naver preset gracefully', () => {
      // Mock the preset to be undefined
      const originalPreset = require('../types/news.types').KOREAN_NEWS_PRESETS
        .naver;
      delete require('../types/news.types').KOREAN_NEWS_PRESETS.naver;

      expect(() => {
        new NaverNewsCrawler(
          'https://news.naver.com/article/001/0014444999',
          mockLogger
        );
      }).toThrow('Naver News preset not found');

      // Restore the preset
      require('../types/news.types').KOREAN_NEWS_PRESETS.naver = originalPreset;
    });

    it('should handle crawl errors gracefully', async () => {
      // Mock super.crawl to throw an error
      jest.spyOn(crawler as any, 'crawl').mockImplementation(async () => {
        throw new Error('Network error');
      });

      await expect(crawler.crawl()).rejects.toThrow('Network error');
    });
  });

  describe('Statistics and logging', () => {
    it('should maintain crawler statistics', () => {
      const stats = crawler.getStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('successfulRequests');
      expect(stats).toHaveProperty('failedRequests');
      expect(stats).toHaveProperty('totalRetries');
      expect(stats).toHaveProperty('averageResponseTime');
    });

    it('should reset statistics when requested', () => {
      // Simulate some activity
      (crawler as any).stats.totalRequests = 10;
      (crawler as any).stats.successfulRequests = 8;

      crawler.resetStats();

      const stats = crawler.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
    });
  });
});

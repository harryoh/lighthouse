/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Tests for BaseCrawler
 */

import { BaseCrawler } from './BaseCrawler';
import { SourceConfig, ParsedContent } from '../types/crawler.types';
import { SourceType } from '@prisma/client';

// Test implementation of BaseCrawler
class TestCrawler extends BaseCrawler {
  private urls: string[] = [];
  private contents: Map<string, ParsedContent> = new Map();

  constructor(source: SourceConfig) {
    super(source);
  }

  public setUrls(urls: string[]): void {
    this.urls = urls;
  }

  public setContent(url: string, content: ParsedContent): void {
    this.contents.set(url, content);
  }

  protected async getUrlsToCrawl(): Promise<string[]> {
    return this.urls;
  }

  protected async crawlPage(url: string): Promise<ParsedContent | null> {
    return this.contents.get(url) || null;
  }
}

describe('BaseCrawler', () => {
  let crawler: TestCrawler;
  let source: SourceConfig;

  beforeEach(() => {
    source = {
      id: 'test-source-1',
      name: 'Test Source',
      url: 'https://example.com',
      type: SourceType.NEWS,
      config: {},
    };
    crawler = new TestCrawler(source);
  });

  describe('constructor', () => {
    it('should initialize with source config', () => {
      expect(crawler).toBeDefined();
      expect(crawler.getStats()).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalRetries: 0,
        averageResponseTime: 0,
      });
    });
  });

  describe('crawl', () => {
    it('should crawl all URLs successfully', async () => {
      const urls = ['https://example.com/1', 'https://example.com/2'];
      const content1: ParsedContent = {
        url: urls[0]!,
        title: 'Article 1',
        body: 'Content 1',
        publishedAt: new Date(),
        rawHtml: '<html>1</html>',
        contentHash: 'hash1',
      };
      const content2: ParsedContent = {
        url: urls[1]!,
        title: 'Article 2',
        body: 'Content 2',
        publishedAt: new Date(),
        rawHtml: '<html>2</html>',
        contentHash: 'hash2',
      };

      crawler.setUrls(urls);
      crawler.setContent(urls[0]!, content1);
      crawler.setContent(urls[1]!, content2);

      const result = await crawler.crawl();

      expect(result.success).toBe(true);
      expect(result.contents).toHaveLength(2);
      expect(result.contents).toContainEqual(content1);
      expect(result.contents).toContainEqual(content2);
      expect(result.stats.successCount).toBe(2);
      expect(result.stats.failureCount).toBe(0);
    });

    it('should handle partial failures', async () => {
      const urls = ['https://example.com/1', 'https://example.com/2'];
      const content1: ParsedContent = {
        url: urls[0]!,
        title: 'Article 1',
        body: 'Content 1',
        publishedAt: new Date(),
        rawHtml: '<html>1</html>',
        contentHash: 'hash1',
      };

      crawler.setUrls(urls);
      crawler.setContent(urls[0]!, content1);
      // urls[1] will return null (failure)

      const result = await crawler.crawl();

      expect(result.success).toBe(true);
      expect(result.contents).toHaveLength(1);
      expect(result.contents).toContainEqual(content1);
      expect(result.stats.successCount).toBe(1);
      expect(result.stats.failureCount).toBe(0);
    });

    it('should handle complete failure', async () => {
      const urls = ['https://example.com/1'];
      crawler.setUrls(urls);
      // No content set, will return null

      const result = await crawler.crawl();

      expect(result.success).toBe(false);
      expect(result.contents).toBeUndefined();
      expect(result.stats.successCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return current statistics', () => {
      const stats = crawler.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', async () => {
      // First do some crawling
      const urls = ['https://example.com/1'];
      const content: ParsedContent = {
        url: urls[0]!,
        title: 'Article',
        body: 'Content',
        publishedAt: new Date(),
        rawHtml: '<html></html>',
        contentHash: 'hash',
      };

      crawler.setUrls(urls);
      crawler.setContent(urls[0]!, content);
      await crawler.crawl();

      // Stats should have some values
      let stats = crawler.getStats();
      expect(stats.lastCrawlTime).toBeDefined();

      // Reset stats
      crawler.resetStats();

      // Stats should be back to initial values
      stats = crawler.getStats();
      expect(stats).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalRetries: 0,
        averageResponseTime: 0,
      });
    });
  });
});

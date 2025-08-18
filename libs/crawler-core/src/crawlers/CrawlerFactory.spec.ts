/**
 * Tests for CrawlerFactory
 */

import { CrawlerFactory } from './CrawlerFactory';
import { BaseCrawler } from './BaseCrawler';
import { SourceConfig, ParsedContent } from '../types/crawler.types';
import { SourceType } from '@prisma/client';

// Test crawler implementation
class TestNewsCrawler extends BaseCrawler {
  protected async getUrlsToCrawl(): Promise<string[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async crawlPage(_url: string): Promise<ParsedContent | null> {
    return null;
  }
}

class TestBlogCrawler extends BaseCrawler {
  protected async getUrlsToCrawl(): Promise<string[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async crawlPage(_url: string): Promise<ParsedContent | null> {
    return null;
  }
}

describe('CrawlerFactory', () => {
  beforeEach(() => {
    CrawlerFactory.clearRegistry();
  });

  describe('registerCrawler', () => {
    it('should register a crawler for a source type', () => {
      CrawlerFactory.registerCrawler(SourceType.NEWS, TestNewsCrawler);
      expect(CrawlerFactory.hasCrawler(SourceType.NEWS)).toBe(true);
    });

    it('should overwrite existing crawler for same type', () => {
      CrawlerFactory.registerCrawler(SourceType.NEWS, TestNewsCrawler);
      CrawlerFactory.registerCrawler(SourceType.NEWS, TestBlogCrawler);
      expect(CrawlerFactory.hasCrawler(SourceType.NEWS)).toBe(true);
    });
  });

  describe('unregisterCrawler', () => {
    it('should unregister a crawler', () => {
      CrawlerFactory.registerCrawler(SourceType.NEWS, TestNewsCrawler);
      expect(CrawlerFactory.hasCrawler(SourceType.NEWS)).toBe(true);

      CrawlerFactory.unregisterCrawler(SourceType.NEWS);
      expect(CrawlerFactory.hasCrawler(SourceType.NEWS)).toBe(false);
    });

    it('should handle unregistering non-existent crawler', () => {
      expect(() => {
        CrawlerFactory.unregisterCrawler(SourceType.BLOG);
      }).not.toThrow();
    });
  });

  describe('createCrawler', () => {
    it('should create a crawler instance for registered type', () => {
      CrawlerFactory.registerCrawler(SourceType.NEWS, TestNewsCrawler);

      const source: SourceConfig = {
        id: 'test-1',
        name: 'Test News',
        url: 'https://example.com',
        type: SourceType.NEWS,
        config: {},
      };

      const crawler = CrawlerFactory.createCrawler(source);
      expect(crawler).toBeInstanceOf(TestNewsCrawler);
    });

    it('should throw error for unregistered type', () => {
      const source: SourceConfig = {
        id: 'test-1',
        name: 'Test Social',
        url: 'https://example.com',
        type: SourceType.SOCIAL,
        config: {},
      };

      expect(() => {
        CrawlerFactory.createCrawler(source);
      }).toThrow(`No crawler registered for source type: ${SourceType.SOCIAL}`);
    });
  });

  describe('hasCrawler', () => {
    it('should return true for registered crawler', () => {
      CrawlerFactory.registerCrawler(SourceType.NEWS, TestNewsCrawler);
      expect(CrawlerFactory.hasCrawler(SourceType.NEWS)).toBe(true);
    });

    it('should return false for unregistered crawler', () => {
      expect(CrawlerFactory.hasCrawler(SourceType.COMMUNITY)).toBe(false);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return all registered types', () => {
      CrawlerFactory.registerCrawler(SourceType.NEWS, TestNewsCrawler);
      CrawlerFactory.registerCrawler(SourceType.BLOG, TestBlogCrawler);

      const types = CrawlerFactory.getRegisteredTypes();
      expect(types).toContain(SourceType.NEWS);
      expect(types).toContain(SourceType.BLOG);
      expect(types).toHaveLength(2);
    });

    it('should return empty array when no crawlers registered', () => {
      const types = CrawlerFactory.getRegisteredTypes();
      expect(types).toEqual([]);
    });
  });

  describe('clearRegistry', () => {
    it('should clear all registered crawlers', () => {
      CrawlerFactory.registerCrawler(SourceType.NEWS, TestNewsCrawler);
      CrawlerFactory.registerCrawler(SourceType.BLOG, TestBlogCrawler);

      expect(CrawlerFactory.getRegisteredTypes()).toHaveLength(2);

      CrawlerFactory.clearRegistry();

      expect(CrawlerFactory.getRegisteredTypes()).toHaveLength(0);
      expect(CrawlerFactory.hasCrawler(SourceType.NEWS)).toBe(false);
      expect(CrawlerFactory.hasCrawler(SourceType.BLOG)).toBe(false);
    });
  });
});

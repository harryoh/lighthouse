/**
 * NewsCrawler test suite
 */

import { NewsCrawler } from './NewsCrawler';
import { NewsSourceConfig, KOREAN_NEWS_PRESETS } from '../types/news.types';
import * as winston from 'winston';

describe('NewsCrawler', () => {
  let testLogger: winston.Logger;
  let mockConfig: NewsSourceConfig;

  beforeEach(() => {
    testLogger = winston.createLogger({
      level: 'error', // Suppress logs during testing
      transports: [new winston.transports.Console({ silent: true })],
    });

    mockConfig = {
      id: 'test-news',
      name: 'Test News Site',
      url: 'https://example.com/news/article/123',
      type: 'NEWS',
      selectors: {
        titleSelector: '.title',
        bodySelector: '.content',
        authorSelector: '.author',
        dateSelector: '.date',
      },
      config: {},
    };
  });

  describe('Constructor and Configuration', () => {
    it('should create NewsCrawler instance with valid config', () => {
      const crawler = new NewsCrawler(mockConfig, testLogger);
      expect(crawler).toBeInstanceOf(NewsCrawler);
    });

    it('should throw error when titleSelector is missing', () => {
      const invalidConfig = {
        ...mockConfig,
        selectors: {
          ...mockConfig.selectors,
          titleSelector: '',
        },
      };

      expect(() => new NewsCrawler(invalidConfig, testLogger)).toThrow(
        'titleSelector is required in news source configuration'
      );
    });

    it('should throw error when bodySelector is missing', () => {
      const invalidConfig = {
        ...mockConfig,
        selectors: {
          ...mockConfig.selectors,
          bodySelector: '',
        },
      };

      expect(() => new NewsCrawler(invalidConfig, testLogger)).toThrow(
        'bodySelector is required in news source configuration'
      );
    });

    it('should have appropriate rate limiting for news sites', () => {
      const crawler = new NewsCrawler(mockConfig, testLogger);
      const rateLimitConfig = (crawler as any).getRateLimitConfig();

      expect(rateLimitConfig.maxRequests).toBe(5);
      expect(rateLimitConfig.interval).toBe(2000); // 2 seconds
      expect(rateLimitConfig.maxConcurrent).toBe(1);
    });

    it('should have conservative retry configuration for news sites', () => {
      const crawler = new NewsCrawler(mockConfig, testLogger);
      const retryConfig = (crawler as any).getRetryConfig();

      expect(retryConfig.maxAttempts).toBe(2);
      expect(retryConfig.initialDelay).toBe(3000); // 3 seconds
      expect(retryConfig.maxDelay).toBe(15000); // 15 seconds
      expect(retryConfig.backoffFactor).toBe(2);
    });
  });

  describe('Static Factory Methods', () => {
    it('should create NewsCrawler from Naver preset', () => {
      const testUrl = 'https://news.naver.com/article/001/0014536789';
      const crawler = NewsCrawler.fromPreset('naver', testUrl, testLogger);

      expect(crawler).toBeInstanceOf(NewsCrawler);
      expect((crawler as any).newsConfig.name).toBe('Naver News');
      expect((crawler as any).newsConfig.url).toBe(testUrl);
    });

    it('should create NewsCrawler from Daum preset', () => {
      const testUrl = 'https://news.daum.net/v/20241201123456';
      const crawler = NewsCrawler.fromPreset('daum', testUrl, testLogger);

      expect(crawler).toBeInstanceOf(NewsCrawler);
      expect((crawler as any).newsConfig.name).toBe('Daum News');
      expect((crawler as any).newsConfig.url).toBe(testUrl);
    });

    it('should throw error for unknown preset', () => {
      expect(() =>
        NewsCrawler.fromPreset(
          'unknown' as any,
          'https://example.com',
          testLogger
        )
      ).toThrow("News preset 'unknown' not found");
    });

    it('should return available presets', () => {
      const presets = NewsCrawler.getAvailablePresets();
      expect(presets).toEqual(['naver', 'daum']);
      expect(presets.length).toBe(2);
    });
  });

  describe('Date Parsing', () => {
    let crawler: NewsCrawler;

    beforeEach(() => {
      crawler = new NewsCrawler(mockConfig, testLogger);
    });

    it('should parse Korean date format YYYY.MM.DD. HH:mm', () => {
      const dateString = '2024.12.01. 14:30';
      const result = (crawler as any).parseDate(dateString);

      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // 0-based months
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it('should parse Korean date format YYYY.MM.DD.', () => {
      const dateString = '2024.12.01.';
      const result = (crawler as any).parseDate(dateString);

      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(1);
    });

    it('should parse Korean 오후 (PM) format', () => {
      const dateString = '2024년 12월 1일 오후 2:30';
      const result = (crawler as any).parseDate(dateString);

      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it('should parse Korean 오전 (AM) format', () => {
      const dateString = '2024년 12월 1일 오전 10:30';
      const result = (crawler as any).parseDate(dateString);

      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(10);
      expect(result.getMinutes()).toBe(30);
    });

    it('should parse Korean 오전 12:00 as midnight', () => {
      const dateString = '2024년 12월 1일 오전 12:30';
      const result = (crawler as any).parseDate(dateString);

      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(30);
    });

    it('should parse Korean 오후 12:00 as noon', () => {
      const dateString = '2024년 12월 1일 오후 12:30';
      const result = (crawler as any).parseDate(dateString);

      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(12);
      expect(result.getMinutes()).toBe(30);
    });

    it('should parse Korean format with 시분', () => {
      const dateString = '2024년 12월 1일 14시 30분';
      const result = (crawler as any).parseDate(dateString);

      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it('should parse short Korean format without year', () => {
      const dateString = '12월 1일 오후 2:30';
      const result = (crawler as any).parseDate(dateString);
      const currentYear = new Date().getFullYear();

      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(currentYear);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it('should parse ISO date format YYYY-MM-DD HH:mm:ss', () => {
      const dateString = '2024-12-01 14:30:45';
      const result = (crawler as any).parseDate(dateString);

      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(45);
    });

    it('should return undefined for invalid date string', () => {
      const result = (crawler as any).parseDate('invalid date');
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const result = (crawler as any).parseDate('');
      expect(result).toBeUndefined();
    });

    it('should return undefined for null or undefined input', () => {
      expect((crawler as any).parseDate(null)).toBeUndefined();
      expect((crawler as any).parseDate(undefined)).toBeUndefined();
    });
  });

  describe('Text Extraction', () => {
    let crawler: NewsCrawler;

    beforeEach(() => {
      crawler = new NewsCrawler(mockConfig, testLogger);
    });

    it('should clean text content properly', () => {
      const text = '  Test   Content\n\r\twith\u00A0spaces  ';
      const result = (crawler as any).cleanText(text);
      expect(result).toBe('Test Content with spaces');
    });

    it('should extract text from cheerio selector', () => {
      const html = '<div class="test">  Test Content  </div>';
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      const result = (crawler as any).extractText($, '.test');
      expect(result).toBe('Test Content');
    });

    it('should return fallback for missing selector', () => {
      const html = '<div>content</div>';
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      const result = (crawler as any).extractText($, '.missing', 'fallback');
      expect(result).toBe('fallback');
    });

    it('should extract text from multiple elements', () => {
      const html = `
        <div class="item">  First  </div>
        <div class="item">Second</div>
        <div class="item">  </div>
        <div class="item">Third  </div>
      `;
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      const result = (crawler as any).extractAllText($, '.item');
      expect(result).toEqual(['First', 'Second', 'Third']);
    });

    it('should extract metadata with fallback selectors', () => {
      const html = `
        <div class="missing"></div>
        <div class="second">Found Content</div>
        <div class="third">Backup Content</div>
      `;
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      const result = (crawler as any).extractMetadata($, [
        '.missing',
        '.second',
        '.third',
      ]);
      expect(result).toBe('Found Content');
    });

    it('should return empty string when no metadata found', () => {
      const html = '<div>content</div>';
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      const result = (crawler as any).extractMetadata($, [
        '.missing1',
        '.missing2',
      ]);
      expect(result).toBe('');
    });

    it('should extract image URL with fallback attributes', () => {
      const html = '<img data-src="lazy.jpg" data-original="original.jpg" />';
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      const imgElement = $('img')[0];
      const result = (crawler as any).extractImageUrl($, imgElement);
      expect(result).toBe('lazy.jpg');
    });

    it('should extract image URL with src attribute', () => {
      const html = '<img src="image.jpg" data-src="lazy.jpg" />';
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      const imgElement = $('img')[0];
      const result = (crawler as any).extractImageUrl($, imgElement);
      expect(result).toBe('image.jpg');
    });
  });

  describe('Preset Configurations', () => {
    it('should have valid Naver News preset', () => {
      const naverPreset = KOREAN_NEWS_PRESETS['naver'];

      expect(naverPreset?.name).toBe('Naver News');
      expect(naverPreset?.domain).toBe('news.naver.com');
      expect(naverPreset?.config.selectors.titleSelector).toBe(
        '#title_area span'
      );
      expect(naverPreset?.config.selectors.bodySelector).toBe('#dic_area');
      expect(naverPreset?.config.timezone).toBe('Asia/Seoul');
    });

    it('should have valid Daum News preset', () => {
      const daumPreset = KOREAN_NEWS_PRESETS['daum'];

      expect(daumPreset?.name).toBe('Daum News');
      expect(daumPreset?.domain).toBe('news.daum.net');
      expect(daumPreset?.config.selectors.titleSelector).toBe('.tit_view');
      expect(daumPreset?.config.selectors.bodySelector).toBe(
        '.article_view, .news_body'
      );
      expect(daumPreset?.config.timezone).toBe('Asia/Seoul');
    });
  });

  describe('getUrlsToCrawl', () => {
    it('should return source URL for single article crawling', async () => {
      const crawler = new NewsCrawler(mockConfig, testLogger);
      const urls = await (crawler as any).getUrlsToCrawl();

      expect(urls).toEqual([mockConfig.url]);
    });
  });

  describe('Article Discovery', () => {
    let crawler: NewsCrawler;

    beforeEach(() => {
      const configWithDiscovery = {
        ...mockConfig,
        selectors: {
          ...mockConfig.selectors,
          articleListSelector: '.article-item',
          paginationSelector: '.pagination a',
          nextPageSelector: '.pagination .next',
        },
        pagination: {
          maxPages: 5,
          pageParamPattern: '?page={page}',
        },
        discovery: {
          maxDepth: 2,
          followSections: true,
          allowedDomains: ['example.com'],
          excludePatterns: ['/sports/', '/ads/'],
        },
      };
      crawler = new NewsCrawler(configWithDiscovery, testLogger);
    });

    describe('URL Validation', () => {
      it('should validate URLs against allowed domains', () => {
        const result1 = (crawler as any).isValidArticleUrl(
          'https://example.com/news/article1'
        );
        const result2 = (crawler as any).isValidArticleUrl(
          'https://other.com/news/article2'
        );

        expect(result1).toBe(true);
        expect(result2).toBe(false);
      });

      it('should exclude URLs matching exclude patterns', () => {
        const result1 = (crawler as any).isValidArticleUrl(
          'https://example.com/news/article1'
        );
        const result2 = (crawler as any).isValidArticleUrl(
          'https://example.com/sports/article2'
        );
        const result3 = (crawler as any).isValidArticleUrl(
          'https://example.com/ads/banner'
        );

        expect(result1).toBe(true);
        expect(result2).toBe(false);
        expect(result3).toBe(false);
      });

      it('should handle include patterns overriding exclude patterns', () => {
        const configWithInclude = {
          ...mockConfig,
          discovery: {
            excludePatterns: ['/sports/'],
            includePatterns: ['/sports/important/'],
          },
        };
        const crawlerWithInclude = new NewsCrawler(
          configWithInclude,
          testLogger
        );

        const result1 = (crawler as any).isValidArticleUrl.call(
          crawlerWithInclude,
          'https://example.com/sports/regular'
        );
        const result2 = (crawler as any).isValidArticleUrl.call(
          crawlerWithInclude,
          'https://example.com/sports/important/article'
        );

        expect(result1).toBe(false);
        expect(result2).toBe(true);
      });
    });

    describe('URL Extraction', () => {
      it('should extract article URLs from HTML', () => {
        const html = `
          <div class="article-item">
            <a href="/news/article1">Article 1</a>
          </div>
          <div class="article-item">
            <a href="/news/article2">Article 2</a>
          </div>
          <div class="article-item">
            <a href="/sports/article3">Sports Article</a>
          </div>
        `;
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const baseUrl = 'https://example.com';

        const urls = (crawler as any).extractArticleUrls($, baseUrl);

        expect(urls).toEqual([
          'https://example.com/news/article1',
          'https://example.com/news/article2',
          // Sports article should be excluded by discovery config
        ]);
      });

      it('should handle direct links (a tags as article items)', () => {
        const html = `
          <a class="article-item" href="/news/article1">Article 1</a>
          <a class="article-item" href="/news/article2">Article 2</a>
        `;
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const baseUrl = 'https://example.com';

        const urls = (crawler as any).extractArticleUrls($, baseUrl);

        expect(urls).toEqual([
          'https://example.com/news/article1',
          'https://example.com/news/article2',
        ]);
      });
    });

    describe('Pagination Detection', () => {
      it('should detect next page using next button selector', () => {
        const html = `
          <div class="pagination">
            <a class="next" href="/news?page=2">Next</a>
          </div>
        `;
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const baseUrl = 'https://example.com/news?page=1';

        const nextUrl = (crawler as any).detectNextPage($, baseUrl, 1);

        expect(nextUrl).toBe('https://example.com/news?page=2');
      });

      it('should generate next page URL using page parameter pattern', () => {
        const html = '<div></div>'; // No pagination elements
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const baseUrl = 'https://example.com/news';

        const nextUrl = (crawler as any).detectNextPage($, baseUrl, 1);

        expect(nextUrl).toBe('https://example.com/news?page=2');
      });

      it('should detect next page from pagination links with numbers', () => {
        const html = `
          <div class="pagination">
            <a href="/news?page=1">1</a>
            <a href="/news?page=2">2</a>
            <a href="/news?page=3">3</a>
          </div>
        `;
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const baseUrl = 'https://example.com/news?page=1';

        const nextUrl = (crawler as any).detectNextPage($, baseUrl, 1);

        expect(nextUrl).toBe('https://example.com/news?page=2');
      });

      it('should return undefined when no next page is found', () => {
        const html = '<div></div>';
        const crawlerWithoutPattern = new NewsCrawler(
          {
            ...mockConfig,
            selectors: {
              ...mockConfig.selectors,
              articleListSelector: '.article-item',
            },
            pagination: { maxPages: 5 }, // No pageParamPattern
          },
          testLogger
        );
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const baseUrl = 'https://example.com/news';

        const nextUrl = (crawlerWithoutPattern as any).detectNextPage(
          $,
          baseUrl,
          1
        );

        expect(nextUrl).toBeUndefined();
      });
    });

    describe('Section Link Extraction', () => {
      it('should extract section links when followSections is enabled', () => {
        const html = `
          <nav>
            <a class="section-link" href="/politics">Politics</a>
            <a class="section-link" href="/economy">Economy</a>
            <a class="section-link" href="/sports">Sports</a>
          </nav>
        `;
        const configWithSectionSelector = {
          ...mockConfig,
          selectors: {
            ...mockConfig.selectors,
            sectionSelector: '.section-link',
          },
          discovery: {
            followSections: true,
            allowedDomains: ['example.com'],
            excludePatterns: ['/sports/'],
          },
        };
        const crawlerWithSections = new NewsCrawler(
          configWithSectionSelector,
          testLogger
        );

        (crawlerWithSections as any).initDiscoverySession(
          'https://example.com'
        );

        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        const baseUrl = 'https://example.com';

        (crawlerWithSections as any).extractCategorySectionLinks($, baseUrl);

        const session = (crawlerWithSections as any).discoverySession;
        expect(session.sectionLinks).toEqual([
          'https://example.com/politics',
          'https://example.com/economy',
          // Sports should be excluded
        ]);
      });
    });
  });
});

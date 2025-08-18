/**
 * NewsArticleValidator test suite
 */

import { NewsArticleValidator, ValidationConfig } from './NewsArticleValidator';
import * as winston from 'winston';
import { NewsArticle } from '../types/news.types';

describe('NewsArticleValidator', () => {
  let validator: NewsArticleValidator;
  let testLogger: winston.Logger;
  let mockConfig: ValidationConfig;

  beforeEach(() => {
    testLogger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })],
    });

    mockConfig = {
      minTitleLength: 10,
      maxTitleLength: 200,
      minBodyLength: 200,
      maxBodyLength: 50000,
      maxArticleAge: 10,
      allowFutureDates: false,
      authorRequired: false,
      dateRequired: true,
      minQualityScore: 60,
      blacklistedPatterns: ['/ads?/', '/video/', '\\.jpg$'],
    };

    validator = new NewsArticleValidator(mockConfig, testLogger);
  });

  afterEach(() => {
    validator.clearDuplicateCache();
  });

  describe('Constructor and Configuration', () => {
    it('should create validator with default config', () => {
      const defaultValidator = new NewsArticleValidator();
      expect(defaultValidator).toBeInstanceOf(NewsArticleValidator);
    });

    it('should merge provided config with defaults', () => {
      const customConfig = { minQualityScore: 70 };
      const customValidator = new NewsArticleValidator(
        customConfig,
        testLogger
      );
      expect(customValidator).toBeInstanceOf(NewsArticleValidator);
    });
  });

  describe('Article Validation', () => {
    const createValidArticle = (): NewsArticle => ({
      title: 'Valid News Article Title',
      body: 'This is a valid news article body that contains enough content to pass the minimum length requirements. It has sufficient detail and meaningful content that would be expected in a real news article. This additional text ensures the minimum character requirement is met.',
      sourceUrl: 'https://example.com/news/article',
      publishedDate: new Date('2024-01-15T10:00:00Z'),
      author: 'John Smith',
      excerpt: 'Article excerpt',
      category: 'Technology',
      tags: ['tech', 'news'],
      images: ['https://example.com/image.jpg'],
      captions: ['Image caption'],
    });

    it('should validate a completely valid article', () => {
      const article = createValidArticle();
      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(mockConfig.minQualityScore!);
      expect(
        result.issues.filter((issue) => issue.type === 'error')
      ).toHaveLength(0);
      expect(result.contentHash).toBeTruthy();
    });

    it('should reject article with missing title', () => {
      const article = createValidArticle();
      article.title = '';

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'title' && issue.message === 'Title is required'
        )
      ).toBe(true);
    });

    it('should reject article with short title', () => {
      const article = createValidArticle();
      article.title = 'Short';

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'title' && issue.message.includes('Title too short')
        )
      ).toBe(true);
    });

    it('should warn about long title', () => {
      const article = createValidArticle();
      article.title = 'A'.repeat(250); // Longer than maxTitleLength

      const result = validator.validateArticle(article);

      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'title' &&
            issue.type === 'warning' &&
            issue.message.includes('Title too long')
        )
      ).toBe(true);
    });

    it('should reject placeholder title', () => {
      const article = createValidArticle();
      article.title = 'Untitled Article';

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'title' &&
            issue.message === 'Title appears to be placeholder text'
        )
      ).toBe(true);
    });

    it('should reject article with missing body', () => {
      const article = createValidArticle();
      article.body = '';

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'body' &&
            issue.message === 'Body content is required'
        )
      ).toBe(true);
    });

    it('should reject article with short body', () => {
      const article = createValidArticle();
      article.body = 'Short body';

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'body' && issue.message.includes('Body too short')
        )
      ).toBe(true);
    });

    it('should reject placeholder body content', () => {
      const article = createValidArticle();
      article.body =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'body' &&
            issue.message === 'Body appears to contain placeholder text'
        )
      ).toBe(true);
    });
  });

  describe('Date Validation', () => {
    const createValidArticle = (): NewsArticle => ({
      title: 'Valid News Article Title',
      body: 'This is a valid news article body that contains enough content to pass validation requirements.',
      sourceUrl: 'https://example.com/news/article',
      publishedDate: new Date('2024-01-15T10:00:00Z'),
      author: 'John Smith',
      images: [],
      captions: [],
    });

    it('should require date when dateRequired is true', () => {
      const article = createValidArticle();
      article.publishedDate = undefined;

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'publishedDate' &&
            issue.message === 'Publication date is required'
        )
      ).toBe(true);
    });

    it('should allow missing date when dateRequired is false', () => {
      const noDateValidator = new NewsArticleValidator(
        {
          ...mockConfig,
          dateRequired: false,
          minQualityScore: 50,
        },
        testLogger
      );

      const article = createValidArticle();
      article.publishedDate = undefined;

      const result = noDateValidator.validateArticle(article);

      expect(
        result.issues.some((issue) => issue.field === 'publishedDate')
      ).toBe(false);
    });

    it('should reject future dates when not allowed', () => {
      const article = createValidArticle();
      article.publishedDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'publishedDate' &&
            issue.message === 'Publication date cannot be in the future'
        )
      ).toBe(true);
    });

    it('should allow future dates when configured', () => {
      const futureValidator = new NewsArticleValidator(
        {
          ...mockConfig,
          allowFutureDates: true,
        },
        testLogger
      );

      const article = createValidArticle();
      article.publishedDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const result = futureValidator.validateArticle(article);

      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'publishedDate' &&
            issue.message === 'Publication date cannot be in the future'
        )
      ).toBe(false);
    });

    it('should warn about very old articles', () => {
      const article = createValidArticle();
      article.publishedDate = new Date('2010-01-01'); // More than 10 years old

      const result = validator.validateArticle(article);

      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'publishedDate' &&
            issue.type === 'warning' &&
            issue.message.includes('Article is very old')
        )
      ).toBe(true);
    });

    it('should reject invalid dates', () => {
      const article = createValidArticle();
      article.publishedDate = new Date('invalid-date');

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'publishedDate' &&
            issue.message === 'Invalid publication date'
        )
      ).toBe(true);
    });
  });

  describe('Author Validation', () => {
    const createValidArticle = (): NewsArticle => ({
      title: 'Valid News Article Title',
      body: 'This is a valid news article body with sufficient content.',
      sourceUrl: 'https://example.com/news/article',
      publishedDate: new Date('2024-01-15T10:00:00Z'),
      author: 'John Smith',
      images: [],
      captions: [],
    });

    it('should require author when authorRequired is true', () => {
      const authorValidator = new NewsArticleValidator(
        {
          ...mockConfig,
          authorRequired: true,
        },
        testLogger
      );

      const article = createValidArticle();
      article.author = '';

      const result = authorValidator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'author' && issue.message === 'Author is required'
        )
      ).toBe(true);
    });

    it('should allow missing author when not required', () => {
      const article = createValidArticle();
      article.author = '';

      const result = validator.validateArticle(article);

      expect(result.issues.some((issue) => issue.field === 'author')).toBe(
        false
      );
    });

    it('should warn about placeholder authors', () => {
      const article = createValidArticle();
      article.author = 'Admin';

      const result = validator.validateArticle(article);

      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'author' &&
            issue.type === 'warning' &&
            issue.message === 'Author appears to be generic placeholder'
        )
      ).toBe(true);
    });
  });

  describe('URL Validation', () => {
    const createValidArticle = (): NewsArticle => ({
      title: 'Valid News Article Title',
      body: 'This is a valid news article body with sufficient content.',
      sourceUrl: 'https://example.com/news/article',
      publishedDate: new Date('2024-01-15T10:00:00Z'),
      images: [],
      captions: [],
    });

    it('should reject invalid URLs', () => {
      const article = createValidArticle();
      article.sourceUrl = 'invalid-url';

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'sourceUrl' &&
            issue.message === 'Invalid source URL format'
        )
      ).toBe(true);
    });

    it('should reject blacklisted URL patterns', () => {
      const article = createValidArticle();
      article.sourceUrl = 'https://example.com/ads/banner';

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
      expect(
        result.issues.some(
          (issue) =>
            issue.field === 'sourceUrl' &&
            issue.message.includes('URL matches blacklisted pattern')
        )
      ).toBe(true);
    });

    it('should reject video URLs', () => {
      const article = createValidArticle();
      article.sourceUrl = 'https://example.com/video/clip';

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
    });

    it('should reject image file URLs', () => {
      const article = createValidArticle();
      article.sourceUrl = 'https://example.com/image.jpg';

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(false);
    });
  });

  describe('Quality Scoring', () => {
    it('should give high score to complete article', () => {
      const article: NewsArticle = {
        title: 'Comprehensive News Article With Good Length Title',
        body: 'This is a comprehensive news article with substantial content that provides detailed information about the topic. '.repeat(
          20
        ),
        sourceUrl: 'https://example.com/news/article',
        publishedDate: new Date('2024-01-15T10:00:00Z'),
        author: 'John Smith',
        excerpt: 'Detailed excerpt about the article',
        category: 'Technology',
        tags: ['tech', 'news', 'innovation'],
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
        ],
        captions: ['Caption 1', 'Caption 2'],
      };

      const result = validator.validateArticle(article);

      expect(result.score).toBeGreaterThan(80);
    });

    it('should penalize short titles', () => {
      const article: NewsArticle = {
        title: 'Short Title',
        body: 'This is a valid news article body with sufficient content to pass minimum requirements. '.repeat(
          10
        ),
        sourceUrl: 'https://example.com/news/article',
        publishedDate: new Date('2024-01-15T10:00:00Z'),
        images: [],
        captions: [],
      };

      const result = validator.validateArticle(article);

      expect(result.score).toBeLessThan(90);
    });

    it('should penalize short body content', () => {
      const article: NewsArticle = {
        title: 'Valid News Article Title With Appropriate Length',
        body: 'Short body content that meets minimum but not optimal length.',
        sourceUrl: 'https://example.com/news/article',
        publishedDate: new Date('2024-01-15T10:00:00Z'),
        images: [],
        captions: [],
      };

      const result = validator.validateArticle(article);

      expect(result.score).toBeLessThan(80);
    });

    it('should penalize missing metadata', () => {
      const article: NewsArticle = {
        title: 'Valid News Article Title With Appropriate Length',
        body: 'This is a valid news article body with sufficient content. '.repeat(
          20
        ),
        sourceUrl: 'https://example.com/news/article',
        publishedDate: new Date('2024-01-15T10:00:00Z'),
        images: [],
        captions: [],
        // Missing author, excerpt, category, tags
      };

      const result = validator.validateArticle(article);

      expect(result.score).toBeLessThan(70);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Duplicate Detection', () => {
    it('should generate consistent content hash', () => {
      const title = 'Test Article Title';
      const body = 'Test article body content';

      const hash1 = validator.calculateContentHash(title, body);
      const hash2 = validator.calculateContentHash(title, body);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(32); // MD5 hash length
    });

    it('should generate different hashes for different content', () => {
      const hash1 = validator.calculateContentHash('Title 1', 'Body 1');
      const hash2 = validator.calculateContentHash('Title 2', 'Body 2');

      expect(hash1).not.toBe(hash2);
    });

    it('should normalize content for better duplicate detection', () => {
      const hash1 = validator.calculateContentHash(
        'Test   Title',
        'Test   Body   Content'
      );
      const hash2 = validator.calculateContentHash(
        'test title',
        'test body content'
      );

      expect(hash1).toBe(hash2);
    });

    it('should detect duplicate articles', () => {
      const contentHash = 'test-hash-123';

      const result1 = validator.checkDuplicate(contentHash);
      expect(result1.isDuplicate).toBe(false);

      const result2 = validator.checkDuplicate(contentHash);
      expect(result2.isDuplicate).toBe(true);
      expect(result2.similarity).toBe(1.0);
    });

    it('should track unique articles', () => {
      validator.checkDuplicate('hash1');
      validator.checkDuplicate('hash2');
      validator.checkDuplicate('hash1'); // Duplicate

      const stats = validator.getCacheStats();
      expect(stats.uniqueArticles).toBe(2);
    });

    it('should clear duplicate cache', () => {
      validator.checkDuplicate('hash1');
      validator.checkDuplicate('hash2');

      let stats = validator.getCacheStats();
      expect(stats.uniqueArticles).toBe(2);

      validator.clearDuplicateCache();

      stats = validator.getCacheStats();
      expect(stats.uniqueArticles).toBe(0);
    });
  });

  describe('Warnings', () => {
    const createMinimalArticle = (): NewsArticle => ({
      title: 'Valid News Article Title',
      body: 'This is a valid news article body that contains enough content to pass validation requirements.',
      sourceUrl: 'https://example.com/news/article',
      publishedDate: new Date('2024-01-15T10:00:00Z'),
      images: [],
      captions: [],
    });

    it('should warn about missing excerpt', () => {
      const article = createMinimalArticle();

      const result = validator.validateArticle(article);

      expect(
        result.warnings.some((warning) => warning.includes('Missing excerpt'))
      ).toBe(true);
    });

    it('should warn about missing images', () => {
      const article = createMinimalArticle();

      const result = validator.validateArticle(article);

      expect(
        result.warnings.some((warning) => warning.includes('No images found'))
      ).toBe(true);
    });

    it('should warn about missing category', () => {
      const article = createMinimalArticle();

      const result = validator.validateArticle(article);

      expect(
        result.warnings.some((warning) => warning.includes('Missing category'))
      ).toBe(true);
    });

    it('should warn about missing tags', () => {
      const article = createMinimalArticle();

      const result = validator.validateArticle(article);

      expect(
        result.warnings.some((warning) => warning.includes('Missing tags'))
      ).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should validate realistic news article', () => {
      const article: NewsArticle = {
        title:
          'Breaking: New Technology Breakthrough Changes Industry Standards',
        body: `In a significant development that could reshape the technology landscape, researchers at leading institutions have announced a breakthrough that promises to revolutionize how we approach data processing and storage.

The new technique, developed over the past three years, addresses longstanding challenges in computational efficiency while maintaining high standards of data integrity. This advancement comes at a crucial time when organizations worldwide are grappling with exponentially growing data requirements.

"This represents a fundamental shift in our understanding of computational limits," explained Dr. Sarah Chen, lead researcher on the project. "We've essentially found a way to do more with less, which has profound implications for everything from mobile devices to large-scale data centers."

The research team's findings, published in the Journal of Advanced Computing, demonstrate performance improvements of up to 300% in certain scenarios while reducing power consumption by nearly 40%. These metrics suggest that the technology could have immediate practical applications across multiple industries.

Industry experts are cautiously optimistic about the implications. The breakthrough could particularly benefit sectors dealing with real-time data processing, such as financial services, healthcare analytics, and autonomous vehicle systems.`,
        sourceUrl:
          'https://techjournal.example.com/breakthrough-technology-2024',
        publishedDate: new Date('2024-01-15T14:30:00Z'),
        author: 'Michael Rodriguez',
        excerpt:
          'Researchers announce breakthrough in data processing technology with 300% performance improvement and 40% reduction in power consumption.',
        category: 'Technology',
        tags: ['technology', 'breakthrough', 'data-processing', 'research'],
        images: [
          'https://techjournal.example.com/images/research-lab-2024.jpg',
        ],
        captions: [
          'Research team demonstrating the new technology at their laboratory',
        ],
      };

      const result = validator.validateArticle(article);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(85);
      expect(
        result.issues.filter((issue) => issue.type === 'error')
      ).toHaveLength(0);
      expect(result.contentHash).toBeTruthy();
      expect(result.warnings).toHaveLength(0);
    });
  });
});

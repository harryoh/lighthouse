/**
 * NewsArticleValidator class for validating news article quality and completeness
 * Provides comprehensive validation rules specific to news content
 */

import { createHash } from 'crypto';
import { isValid, isAfter, isBefore, subYears } from 'date-fns';
import * as winston from 'winston';
import { NewsArticle } from '../types/news.types';

export interface ValidationConfig {
  minTitleLength?: number;
  maxTitleLength?: number;
  minBodyLength?: number;
  maxBodyLength?: number;
  maxArticleAge?: number; // in years
  allowFutureDates?: boolean;
  authorRequired?: boolean;
  dateRequired?: boolean;
  minQualityScore?: number; // 0-100
  blacklistedPatterns?: string[]; // URL patterns to exclude
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100 quality score
  issues: ValidationIssue[];
  contentHash: string;
  warnings: string[];
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarity: number; // 0-1
  originalHash?: string;
}

export class NewsArticleValidator {
  private config: Required<ValidationConfig>;
  private logger: winston.Logger;
  private contentHashes: Set<string> = new Set();
  private urlBlacklist: RegExp[];

  constructor(config: ValidationConfig = {}, logger?: winston.Logger) {
    this.config = {
      minTitleLength: 10,
      maxTitleLength: 200,
      minBodyLength: 200,
      maxBodyLength: 50000,
      maxArticleAge: 10, // 10 years
      allowFutureDates: false,
      authorRequired: false,
      dateRequired: true,
      minQualityScore: 60,
      blacklistedPatterns: [
        '/ads?/',
        '/advertisement/',
        '/video/',
        '/gallery/',
        '/photo/',
        '/image/',
        '/multimedia/',
        '/widget/',
        '/embed/',
        '/feed/',
        '/rss/',
        '/api/',
        '/ajax/',
        '/json/',
        '\\.jpg$',
        '\\.png$',
        '\\.gif$',
        '\\.pdf$',
        '\\.doc$',
        '\\.zip$',
      ],
      ...config,
    };

    this.logger =
      logger ||
      winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [new winston.transports.Console({ silent: true })],
      });

    // Compile URL blacklist patterns
    this.urlBlacklist = this.config.blacklistedPatterns.map(
      (pattern) => new RegExp(pattern, 'i')
    );
  }

  /**
   * Validate a news article
   */
  validateArticle(article: NewsArticle): ValidationResult {
    const issues: ValidationIssue[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Calculate content hash for duplicate detection
    const contentHash = this.calculateContentHash(article.title, article.body);

    // Title validation
    const titleIssues = this.validateTitle(article.title);
    issues.push(...titleIssues);
    score -= titleIssues.length * 5;

    // Body validation
    const bodyIssues = this.validateBody(article.body);
    issues.push(...bodyIssues);
    score -= bodyIssues.length * 10;

    // Date validation
    const dateIssues = this.validateDate(article.publishedDate);
    issues.push(...dateIssues);
    score -= dateIssues.length * 8;

    // Author validation
    const authorIssues = this.validateAuthor(article.author);
    issues.push(...authorIssues);
    score -= authorIssues.length * 3;

    // URL validation
    const urlIssues = this.validateUrl(article.sourceUrl);
    issues.push(...urlIssues);
    score -= urlIssues.length * 15; // URL issues are serious

    // Content quality scoring
    const qualityScore = this.calculateQualityScore(article);
    score = Math.min(score, qualityScore);

    // Add warnings for missing optional fields
    if (!article.excerpt) {
      warnings.push('Missing excerpt - could improve SEO');
      score -= 2;
    }

    if (!article.images || article.images.length === 0) {
      warnings.push('No images found - could improve engagement');
      score -= 3;
    }

    if (!article.category) {
      warnings.push('Missing category - could improve organization');
      score -= 2;
    }

    if (!article.tags || article.tags.length === 0) {
      warnings.push('Missing tags - could improve discoverability');
      score -= 2;
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    const errorCount = issues.filter((issue) => issue.type === 'error').length;
    const isValid = errorCount === 0 && score >= this.config.minQualityScore;

    this.logger.debug('Article validation completed', {
      title: article.title.substring(0, 50),
      isValid,
      score,
      errorCount,
      warningCount: warnings.length,
      contentHash,
    });

    return {
      isValid,
      score,
      issues,
      contentHash,
      warnings,
    };
  }

  /**
   * Check for duplicate content
   */
  checkDuplicate(contentHash: string): DuplicateCheckResult {
    const isDuplicate = this.contentHashes.has(contentHash);

    if (isDuplicate) {
      this.logger.debug('Duplicate content detected', { contentHash });
      return {
        isDuplicate: true,
        similarity: 1.0,
        originalHash: contentHash,
      };
    }

    // Add to seen content
    this.contentHashes.add(contentHash);
    return {
      isDuplicate: false,
      similarity: 0,
    };
  }

  /**
   * Calculate content hash for duplicate detection
   */
  calculateContentHash(title: string, body: string): string {
    // Normalize content for better duplicate detection
    const normalizedTitle = title.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedBody = body.toLowerCase().replace(/\s+/g, ' ').trim();

    // Take first 1000 chars of body to avoid differences in footer/ads
    const contentForHash =
      normalizedTitle + '|' + normalizedBody.substring(0, 1000);

    return createHash('md5').update(contentForHash, 'utf8').digest('hex');
  }

  /**
   * Validate title
   */
  private validateTitle(title: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!title || title.trim().length === 0) {
      issues.push({
        type: 'error',
        field: 'title',
        message: 'Title is required',
        severity: 'high',
      });
      return issues;
    }

    const trimmedTitle = title.trim();

    if (trimmedTitle.length < this.config.minTitleLength) {
      issues.push({
        type: 'error',
        field: 'title',
        message: `Title too short (${trimmedTitle.length} chars, minimum ${this.config.minTitleLength})`,
        severity: 'high',
      });
    }

    if (trimmedTitle.length > this.config.maxTitleLength) {
      issues.push({
        type: 'warning',
        field: 'title',
        message: `Title too long (${trimmedTitle.length} chars, maximum ${this.config.maxTitleLength})`,
        severity: 'low',
      });
    }

    // Check for placeholder or generic titles
    const genericPatterns = [
      /^untitled/i,
      /^no title/i,
      /^title/i,
      /^\s*$/,
      /^test/i,
      /^lorem ipsum/i,
    ];

    if (genericPatterns.some((pattern) => pattern.test(trimmedTitle))) {
      issues.push({
        type: 'error',
        field: 'title',
        message: 'Title appears to be placeholder text',
        severity: 'medium',
      });
    }

    return issues;
  }

  /**
   * Validate body content
   */
  private validateBody(body: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!body || body.trim().length === 0) {
      issues.push({
        type: 'error',
        field: 'body',
        message: 'Body content is required',
        severity: 'high',
      });
      return issues;
    }

    const trimmedBody = body.trim();

    if (trimmedBody.length < this.config.minBodyLength) {
      issues.push({
        type: 'error',
        field: 'body',
        message: `Body too short (${trimmedBody.length} chars, minimum ${this.config.minBodyLength})`,
        severity: 'high',
      });
    }

    if (trimmedBody.length > this.config.maxBodyLength) {
      issues.push({
        type: 'warning',
        field: 'body',
        message: `Body very long (${trimmedBody.length} chars, maximum recommended ${this.config.maxBodyLength})`,
        severity: 'low',
      });
    }

    // Check for placeholder content
    const placeholderPatterns = [
      /lorem ipsum/i,
      /placeholder/i,
      /sample text/i,
      /test content/i,
      /coming soon/i,
      /under construction/i,
    ];

    if (placeholderPatterns.some((pattern) => pattern.test(trimmedBody))) {
      issues.push({
        type: 'error',
        field: 'body',
        message: 'Body appears to contain placeholder text',
        severity: 'medium',
      });
    }

    return issues;
  }

  /**
   * Validate publication date
   */
  private validateDate(publishedDate?: Date): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (this.config.dateRequired && !publishedDate) {
      issues.push({
        type: 'error',
        field: 'publishedDate',
        message: 'Publication date is required',
        severity: 'medium',
      });
      return issues;
    }

    if (!publishedDate) {
      return issues; // No date provided but not required
    }

    if (!isValid(publishedDate)) {
      issues.push({
        type: 'error',
        field: 'publishedDate',
        message: 'Invalid publication date',
        severity: 'medium',
      });
      return issues;
    }

    const now = new Date();

    // Check for future dates
    if (!this.config.allowFutureDates && isAfter(publishedDate, now)) {
      issues.push({
        type: 'error',
        field: 'publishedDate',
        message: 'Publication date cannot be in the future',
        severity: 'medium',
      });
    }

    // Check for very old articles
    const maxAge = subYears(now, this.config.maxArticleAge);
    if (isBefore(publishedDate, maxAge)) {
      issues.push({
        type: 'warning',
        field: 'publishedDate',
        message: `Article is very old (more than ${this.config.maxArticleAge} years)`,
        severity: 'low',
      });
    }

    return issues;
  }

  /**
   * Validate author
   */
  private validateAuthor(author?: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (this.config.authorRequired && (!author || author.trim().length === 0)) {
      issues.push({
        type: 'error',
        field: 'author',
        message: 'Author is required',
        severity: 'low',
      });
      return issues;
    }

    if (!author || author.trim().length === 0) {
      return issues; // No author provided but not required
    }

    const trimmedAuthor = author.trim();

    // Check for placeholder authors
    const placeholderPatterns = [
      /^admin$/i,
      /^author$/i,
      /^writer$/i,
      /^anonymous$/i,
      /^unknown$/i,
      /^staff$/i,
      /^editor$/i,
    ];

    if (placeholderPatterns.some((pattern) => pattern.test(trimmedAuthor))) {
      issues.push({
        type: 'warning',
        field: 'author',
        message: 'Author appears to be generic placeholder',
        severity: 'low',
      });
    }

    return issues;
  }

  /**
   * Validate source URL
   */
  private validateUrl(sourceUrl: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      new URL(sourceUrl);
    } catch {
      issues.push({
        type: 'error',
        field: 'sourceUrl',
        message: 'Invalid source URL format',
        severity: 'high',
      });
      return issues;
    }

    // Check against blacklist patterns
    if (this.urlBlacklist.some((pattern) => pattern.test(sourceUrl))) {
      issues.push({
        type: 'error',
        field: 'sourceUrl',
        message: 'URL matches blacklisted pattern (likely not a news article)',
        severity: 'high',
      });
    }

    return issues;
  }

  /**
   * Calculate content quality score (0-100)
   */
  private calculateQualityScore(article: NewsArticle): number {
    let score = 100;

    // Title quality (20 points)
    const titleLength = article.title.trim().length;
    if (titleLength < 30) score -= 10;
    if (titleLength > 100) score -= 5;

    // Body quality (40 points)
    const bodyLength = article.body.trim().length;
    if (bodyLength < 500) score -= 20;
    else if (bodyLength < 1000) score -= 10;
    else if (bodyLength < 2000) score -= 5;

    // Content richness (20 points)
    if (!article.excerpt) score -= 5;
    if (!article.images || article.images.length === 0) score -= 8;
    if (!article.category) score -= 3;
    if (!article.tags || article.tags.length === 0) score -= 4;

    // Metadata quality (20 points)
    if (!article.author) score -= 5;
    if (!article.publishedDate) score -= 10;
    if (
      article.images &&
      article.images.length > 0 &&
      article.captions &&
      article.captions.length === 0
    ) {
      score -= 5; // Images without captions
    }

    return Math.max(0, score);
  }

  /**
   * Clear duplicate detection cache
   */
  clearDuplicateCache(): void {
    this.contentHashes.clear();
    this.logger.debug('Duplicate detection cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { uniqueArticles: number; duplicatesBlocked: number } {
    return {
      uniqueArticles: this.contentHashes.size,
      duplicatesBlocked: 0, // Would need to track this separately
    };
  }
}

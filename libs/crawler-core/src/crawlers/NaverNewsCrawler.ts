/**
 * NaverNewsCrawler - Specialized crawler for Naver News
 * Extends NewsCrawler with Naver-specific configurations and optimizations
 */

import * as winston from 'winston';
import { NewsCrawler } from './NewsCrawler';
import { NewsSourceConfig, KOREAN_NEWS_PRESETS } from '../types/news.types';
import { PlaywrightConfig } from '../utils/PlaywrightAdapter';
import { RobotsConfig } from '../utils/RobotsChecker';
import { ValidationConfig } from '../utils/NewsArticleValidator';

export class NaverNewsCrawler extends NewsCrawler {
  constructor(
    url: string,
    logger?: winston.Logger,
    playwrightConfig?: PlaywrightConfig,
    robotsConfig?: RobotsConfig,
    validationConfig?: ValidationConfig
  ) {
    const naverPreset = KOREAN_NEWS_PRESETS['naver'];
    if (!naverPreset) {
      throw new Error('Naver News preset not found');
    }

    // Create Naver-specific configuration
    const config: NewsSourceConfig = {
      id: `naver-news-${Date.now()}`,
      name: naverPreset.name,
      url,
      ...naverPreset.config,
    };

    // Naver-specific robots configuration with more conservative settings
    const defaultRobotsConfig: RobotsConfig = {
      userAgent:
        'Mozilla/5.0 (compatible; LighthouseBot/1.0; +https://github.com/lighthouse/crawler)',
      respectCrawlDelay: true,
      defaultCrawlDelay: 3000, // 3 seconds for Naver (more conservative)
      maxCrawlDelay: 30000, // 30 seconds max
    };

    // Naver-specific validation with stricter quality checks
    const defaultValidationConfig: ValidationConfig = {
      minTitleLength: 10,
      minBodyLength: 300, // Stricter for Naver to ensure quality content
      dateRequired: true,
      maxArticleAge: 7, // Only articles from last 7 days
      minQualityScore: 70, // Higher quality threshold for Naver
    };

    super(
      config,
      logger,
      playwrightConfig,
      { ...defaultRobotsConfig, ...robotsConfig },
      { ...defaultValidationConfig, ...validationConfig }
    );

    // Log initialization
    this.logger.info('NaverNewsCrawler initialized', {
      url,
      source: config.name,
      domain: naverPreset.domain,
    });
  }

  /**
   * Enhanced rate limiting for Naver News to be more respectful
   */
  protected override getRateLimitConfig() {
    return {
      maxRequests: 3, // More conservative for Naver
      interval: 3000, // 3 seconds between requests
      maxConcurrent: 1, // Single concurrent request
    };
  }

  /**
   * Naver-specific retry configuration
   */
  protected override getRetryConfig() {
    return {
      maxAttempts: 2, // Fewer retries for Naver
      initialDelay: 5000, // 5 seconds initial delay
      maxDelay: 20000, // 20 seconds max delay
      backoffFactor: 2,
    };
  }

  /**
   * Naver-specific request headers
   */
  protected override getRequestOptions() {
    const baseOptions = super.getRequestOptions();
    return {
      ...baseOptions,
      headers: {
        ...baseOptions.headers,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        DNT: '1',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
      timeout: 45000, // Longer timeout for Naver
    };
  }

  /**
   * Validate Naver News URL format
   */
  public static isValidNaverNewsUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname === 'news.naver.com' &&
        (urlObj.pathname.includes('/article/') ||
          urlObj.pathname.includes('/main/read.naver'))
      );
    } catch {
      return false;
    }
  }

  /**
   * Extract Naver News article ID from URL
   */
  public static extractArticleId(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // Pattern: /article/{oid}/{aid}
      const articleMatch = urlObj.pathname.match(/\/article\/(\d+)\/(\d+)/);
      if (articleMatch) {
        return `${articleMatch[1]}_${articleMatch[2]}`;
      }

      // Pattern: /main/read.naver?mode=...&oid=...&aid=...
      const oid = urlObj.searchParams.get('oid');
      const aid = urlObj.searchParams.get('aid');
      if (oid && aid) {
        return `${oid}_${aid}`;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create NaverNewsCrawler instance for multiple articles discovery
   */
  public static forSection(
    sectionUrl: string,
    logger?: winston.Logger,
    options?: {
      maxPages?: number;
      followSections?: boolean;
      playwrightConfig?: PlaywrightConfig;
      robotsConfig?: RobotsConfig;
      validationConfig?: ValidationConfig;
    }
  ): NaverNewsCrawler {
    const crawler = new NaverNewsCrawler(
      sectionUrl,
      logger,
      options?.playwrightConfig,
      options?.robotsConfig,
      options?.validationConfig
    );

    // Override pagination settings if provided
    if (options?.maxPages !== undefined) {
      (crawler as any).newsConfig.pagination = {
        ...(crawler as any).newsConfig.pagination,
        maxPages: options.maxPages,
      };
    }

    // Override discovery settings if provided
    if (options?.followSections !== undefined) {
      (crawler as any).newsConfig.discovery = {
        ...(crawler as any).newsConfig.discovery,
        followSections: options.followSections,
      };
    }

    return crawler;
  }

  /**
   * Get common Naver News section URLs
   */
  public static getCommonSectionUrls(): Record<string, string> {
    return {
      politics:
        'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=100',
      economy:
        'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=101',
      society:
        'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=102',
      international:
        'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=104',
      technology:
        'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=105',
      science:
        'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=105&subSid=283',
    };
  }

  /**
   * Enhanced crawl method with Naver-specific error handling
   */
  public override async crawl() {
    try {
      this.logger.info('Starting Naver News crawl', {
        url: this.source.url,
        timestamp: new Date().toISOString(),
      });

      const result = await super.crawl();

      this.logger.info('Naver News crawl completed', {
        url: this.source.url,
        success: result.success,
        contentCount: result.contents?.length || 0,
        duration: result.stats.duration,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.logger.error('Naver News crawl failed', {
        url: this.source.url,
        error: error instanceof Error ? error.message : error,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Override getUrlsToCrawl for discovery mode
   */
  protected override async getUrlsToCrawl(): Promise<string[]> {
    const url = this.source.url;

    // If it's a single article URL, crawl just that article
    if (NaverNewsCrawler.isValidNaverNewsUrl(url)) {
      this.logger.debug('Single article mode detected', { url });
      return [url];
    }

    // If it's a section or listing page, discover articles
    this.logger.debug('Section discovery mode detected', { url });
    try {
      const discoveryResult = await this.discoverArticles(url);
      this.logger.info('Article discovery completed', {
        url,
        articlesFound: discoveryResult.urls.length,
        hasMorePages: discoveryResult.hasMorePages,
      });
      return discoveryResult.urls;
    } catch (error) {
      this.logger.error('Article discovery failed', { url, error });
      return [];
    }
  }
}

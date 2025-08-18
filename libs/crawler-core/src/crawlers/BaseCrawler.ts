/**
 * Base crawler abstract class
 * Provides common functionality for all crawlers
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import axiosRetry from 'axios-retry';
import Bottleneck from 'bottleneck';
import * as winston from 'winston';
import { createHash } from 'crypto';
import {
  SourceConfig,
  ParsedContent,
  CrawlResult,
  RateLimitConfig,
  RetryConfig,
  CrawlerStats,
  UserAgentConfig,
  DEFAULT_USER_AGENTS,
} from '../types/crawler.types';

// Extend axios request config to include metadata
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: {
    startTime: number;
  };
}

export abstract class BaseCrawler {
  protected source: SourceConfig;
  protected axios: AxiosInstance;
  protected limiter: Bottleneck;
  protected logger: winston.Logger;
  protected stats: CrawlerStats;
  protected userAgentConfig: UserAgentConfig;
  private currentUserAgentIndex = 0;

  /**
   * Default rate limit configuration
   */
  protected static readonly DEFAULT_RATE_LIMIT: RateLimitConfig = {
    maxRequests: 10,
    interval: 1000, // 1 second
    maxConcurrent: 2,
  };

  /**
   * Default retry configuration
   */
  protected static readonly DEFAULT_RETRY: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffFactor: 2,
  };

  constructor(source: SourceConfig, logger?: winston.Logger) {
    this.source = source;
    this.logger = logger || this.createDefaultLogger();
    this.stats = this.initializeStats();
    this.userAgentConfig = {
      agents: DEFAULT_USER_AGENTS,
      rotate: true,
    };

    // Initialize rate limiter
    const rateLimitConfig = this.getRateLimitConfig();
    this.limiter = new Bottleneck({
      maxConcurrent: rateLimitConfig.maxConcurrent,
      minTime: rateLimitConfig.interval / rateLimitConfig.maxRequests,
    });

    // Initialize axios instance
    this.axios = this.createAxiosInstance();
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): winston.Logger {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: {
        crawler: this.constructor.name,
        source: this.source.name,
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  /**
   * Initialize crawler statistics
   */
  private initializeStats(): CrawlerStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalRetries: 0,
      averageResponseTime: 0,
    };
  }

  /**
   * Create axios instance with retry configuration
   */
  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create(this.getRequestOptions());
    const retryConfig = this.getRetryConfig();

    // Configure axios-retry
    axiosRetry(instance, {
      retries: retryConfig.maxAttempts,
      retryDelay: (retryCount) => {
        const delay = Math.min(
          retryConfig.initialDelay *
            Math.pow(retryConfig.backoffFactor, retryCount - 1),
          retryConfig.maxDelay
        );
        this.logger.debug(`Retry attempt ${retryCount}, waiting ${delay}ms`);
        this.stats.totalRetries++;
        return delay;
      },
      retryCondition: (error) => {
        // Retry on network errors or 5xx responses
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status ? error.response.status >= 500 : false)
        );
      },
      onRetry: (retryCount, error) => {
        this.logger.warn(
          `Request failed, retry ${retryCount}/${retryConfig.maxAttempts}`,
          {
            error: error.message,
            url: error.config?.url,
          }
        );
      },
    });

    // Add request/response interceptors for stats
    instance.interceptors.request.use(
      (config) => {
        const extConfig = config as ExtendedAxiosRequestConfig;
        extConfig.metadata = { startTime: Date.now() };
        this.stats.totalRequests++;
        return extConfig;
      },
      (error) => {
        this.stats.failedRequests++;
        return Promise.reject(error);
      }
    );

    instance.interceptors.response.use(
      (response) => {
        const extConfig = response.config as ExtendedAxiosRequestConfig;
        if (extConfig.metadata?.startTime) {
          const duration = Date.now() - extConfig.metadata.startTime;
          this.updateAverageResponseTime(duration);
        }
        this.stats.successfulRequests++;
        return response;
      },
      (error) => {
        const extConfig = error.config as ExtendedAxiosRequestConfig;
        if (extConfig?.metadata?.startTime) {
          const duration = Date.now() - extConfig.metadata.startTime;
          this.updateAverageResponseTime(duration);
        }
        this.stats.failedRequests++;
        return Promise.reject(error);
      }
    );

    return instance;
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(duration: number): void {
    const totalRequests =
      this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (totalRequests - 1) + duration) /
      totalRequests;
  }

  /**
   * Get next user agent
   */
  protected getNextUserAgent(): string {
    if (
      !this.userAgentConfig.rotate ||
      this.userAgentConfig.agents.length === 0
    ) {
      const agent = this.userAgentConfig.agents[0];
      const defaultAgent = DEFAULT_USER_AGENTS[0];
      return agent !== undefined ? agent : defaultAgent ?? 'Mozilla/5.0';
    }

    const userAgent = this.userAgentConfig.agents[this.currentUserAgentIndex];
    this.currentUserAgentIndex =
      (this.currentUserAgentIndex + 1) % this.userAgentConfig.agents.length;
    const defaultAgent = DEFAULT_USER_AGENTS[0];
    return userAgent !== undefined ? userAgent : defaultAgent ?? 'Mozilla/5.0';
  }

  /**
   * Make HTTP request with rate limiting
   */
  protected async makeRequest(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<unknown> {
    return this.limiter.schedule(async () => {
      const requestConfig: AxiosRequestConfig = {
        ...config,
        headers: {
          'User-Agent': this.getNextUserAgent(),
          ...config?.headers,
        },
      };

      this.logger.debug(`Making request to ${url}`);
      try {
        const response = await this.axios.get(url, requestConfig);
        return response.data;
      } catch (error) {
        this.logger.error(`Request failed for ${url}`, { error });
        throw error;
      }
    });
  }

  /**
   * Calculate content hash
   */
  protected calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get rate limit configuration
   * Can be overridden by subclasses
   */
  protected getRateLimitConfig(): RateLimitConfig {
    return BaseCrawler.DEFAULT_RATE_LIMIT;
  }

  /**
   * Get retry configuration
   * Can be overridden by subclasses
   */
  protected getRetryConfig(): RetryConfig {
    return BaseCrawler.DEFAULT_RETRY;
  }

  /**
   * Get request options
   * Can be overridden by subclasses
   */
  protected getRequestOptions(): AxiosRequestConfig {
    return {
      timeout: 30000, // 30 seconds
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    };
  }

  /**
   * Validate source configuration
   */
  protected validateSource(): void {
    if (!this.source.url) {
      throw new Error('Source URL is required');
    }
    if (!this.source.type) {
      throw new Error('Source type is required');
    }
  }

  /**
   * Get crawler statistics
   */
  public getStats(): CrawlerStats {
    return { ...this.stats };
  }

  /**
   * Reset crawler statistics
   */
  public resetStats(): void {
    this.stats = this.initializeStats();
  }

  /**
   * Abstract method to crawl a single page
   * Must be implemented by subclasses
   */
  protected abstract crawlPage(url: string): Promise<ParsedContent | null>;

  /**
   * Abstract method to get all URLs to crawl
   * Must be implemented by subclasses
   */
  protected abstract getUrlsToCrawl(): Promise<string[]>;

  /**
   * Main crawl method
   */
  public async crawl(): Promise<CrawlResult> {
    const startTime = Date.now();
    const contents: ParsedContent[] = [];
    let error: Error | undefined;

    try {
      this.validateSource();
      this.logger.info(`Starting crawl for ${this.source.name}`);

      // Get URLs to crawl
      const urls = await this.getUrlsToCrawl();
      this.logger.info(`Found ${urls.length} URLs to crawl`);

      // Crawl each URL
      for (const url of urls) {
        try {
          const content = await this.crawlPage(url);
          if (content) {
            contents.push(content);
            this.logger.debug(`Successfully crawled ${url}`);
          }
        } catch (pageError) {
          this.logger.error(`Failed to crawl ${url}`, { error: pageError });
          // Continue with other pages
        }
      }

      this.stats.lastCrawlTime = new Date();
      this.logger.info(`Crawl completed for ${this.source.name}`, {
        totalPages: urls.length,
        successCount: contents.length,
        failureCount: urls.length - contents.length,
      });
    } catch (err) {
      error = err as Error;
      this.logger.error(`Crawl failed for ${this.source.name}`, { error });
    }

    const duration = Date.now() - startTime;

    return {
      success: !error && contents.length > 0,
      contents: contents.length > 0 ? contents : undefined,
      error,
      stats: {
        totalPages: contents.length + (error ? 1 : 0),
        successCount: contents.length,
        failureCount: error ? 1 : 0,
        duration,
      },
    };
  }
}

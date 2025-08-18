/**
 * Crawler type definitions and interfaces
 */

import { SourceType } from '@prisma/client';

/**
 * Configuration for source crawling
 */
export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  /**
   * Crawler-specific configuration
   * e.g., selectors, pagination, API keys
   */
  config: Record<string, unknown>;
}

/**
 * Parsed content from crawling
 */
export interface ParsedContent {
  url: string;
  title: string;
  body: string;
  author?: string;
  publishedAt: Date;
  rawHtml: string;
  contentHash: string;
  metadata?: Record<string, unknown>;
}

/**
 * Crawl result with statistics
 */
export interface CrawlResult {
  success: boolean;
  contents?: ParsedContent[];
  error?: Error;
  stats: {
    totalPages: number;
    successCount: number;
    failureCount: number;
    duration: number;
  };
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests per interval
   */
  maxRequests: number;
  /**
   * Interval in milliseconds
   */
  interval: number;
  /**
   * Maximum concurrent requests
   */
  maxConcurrent?: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts: number;
  /**
   * Initial delay in milliseconds
   */
  initialDelay: number;
  /**
   * Maximum delay in milliseconds
   */
  maxDelay: number;
  /**
   * Exponential backoff factor
   */
  backoffFactor: number;
}

/**
 * Request options for HTTP calls
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  proxy?: {
    host: string;
    port: number;
    auth?: {
      username: string;
      password: string;
    };
  };
}

/**
 * Crawler statistics
 */
export interface CrawlerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalRetries: number;
  averageResponseTime: number;
  lastCrawlTime?: Date;
}

/**
 * User agent configuration
 */
export interface UserAgentConfig {
  /**
   * List of user agents to rotate
   */
  agents: string[];
  /**
   * Whether to rotate user agents
   */
  rotate: boolean;
}

/**
 * Default user agents for rotation
 */
export const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/112.0.0.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Vivaldi/6.9',
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
];

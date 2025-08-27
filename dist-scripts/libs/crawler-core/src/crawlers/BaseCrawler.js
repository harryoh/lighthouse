'use strict';
/**
 * Base crawler abstract class
 * Provides common functionality for all crawlers
 */
const __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
const __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
const __importStar =
  (this && this.__importStar) ||
  (function () {
    let ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          const ar = [];
          for (const k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      const result = {};
      if (mod != null)
        for (let k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
const __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.BaseCrawler = void 0;
const axios_1 = __importDefault(require('axios'));
const axios_retry_1 = __importDefault(require('axios-retry'));
const bottleneck_1 = __importDefault(require('bottleneck'));
const winston = __importStar(require('winston'));
const crypto_1 = require('crypto');
const crawler_types_1 = require('../types/crawler.types');
class BaseCrawler {
  constructor(source, logger) {
    this.currentUserAgentIndex = 0;
    this.source = source;
    this.logger = logger || this.createDefaultLogger();
    this.stats = this.initializeStats();
    this.userAgentConfig = {
      agents: crawler_types_1.DEFAULT_USER_AGENTS,
      rotate: true,
    };
    // Initialize rate limiter
    const rateLimitConfig = this.getRateLimitConfig();
    this.limiter = new bottleneck_1.default({
      maxConcurrent: rateLimitConfig.maxConcurrent,
      minTime: rateLimitConfig.interval / rateLimitConfig.maxRequests,
    });
    // Initialize axios instance
    this.axios = this.createAxiosInstance();
  }
  /**
   * Create default logger
   */
  createDefaultLogger() {
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
  initializeStats() {
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
  createAxiosInstance() {
    const instance = axios_1.default.create(this.getRequestOptions());
    const retryConfig = this.getRetryConfig();
    // Configure axios-retry
    (0, axios_retry_1.default)(instance, {
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
          axios_retry_1.default.isNetworkOrIdempotentRequestError(error) ||
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
        const extConfig = config;
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
        const extConfig = response.config;
        if (extConfig.metadata?.startTime) {
          const duration = Date.now() - extConfig.metadata.startTime;
          this.updateAverageResponseTime(duration);
        }
        this.stats.successfulRequests++;
        return response;
      },
      (error) => {
        const extConfig = error.config;
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
  updateAverageResponseTime(duration) {
    const totalRequests =
      this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (totalRequests - 1) + duration) /
      totalRequests;
  }
  /**
   * Get next user agent
   */
  getNextUserAgent() {
    if (
      !this.userAgentConfig.rotate ||
      this.userAgentConfig.agents.length === 0
    ) {
      const agent = this.userAgentConfig.agents[0];
      const defaultAgent = crawler_types_1.DEFAULT_USER_AGENTS[0];
      return agent !== undefined ? agent : defaultAgent ?? 'Mozilla/5.0';
    }
    const userAgent = this.userAgentConfig.agents[this.currentUserAgentIndex];
    this.currentUserAgentIndex =
      (this.currentUserAgentIndex + 1) % this.userAgentConfig.agents.length;
    const defaultAgent = crawler_types_1.DEFAULT_USER_AGENTS[0];
    return userAgent !== undefined ? userAgent : defaultAgent ?? 'Mozilla/5.0';
  }
  /**
   * Make HTTP request with rate limiting
   */
  async makeRequest(url, config) {
    return this.limiter.schedule(async () => {
      const requestConfig = {
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
  calculateHash(content) {
    return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
  }
  /**
   * Get rate limit configuration
   * Can be overridden by subclasses
   */
  getRateLimitConfig() {
    return BaseCrawler.DEFAULT_RATE_LIMIT;
  }
  /**
   * Get retry configuration
   * Can be overridden by subclasses
   */
  getRetryConfig() {
    return BaseCrawler.DEFAULT_RETRY;
  }
  /**
   * Get request options
   * Can be overridden by subclasses
   */
  getRequestOptions() {
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
  validateSource() {
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
  getStats() {
    return { ...this.stats };
  }
  /**
   * Reset crawler statistics
   */
  resetStats() {
    this.stats = this.initializeStats();
  }
  /**
   * Main crawl method
   */
  async crawl() {
    const startTime = Date.now();
    const contents = [];
    let error;
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
      error = err;
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
exports.BaseCrawler = BaseCrawler;
/**
 * Default rate limit configuration
 */
BaseCrawler.DEFAULT_RATE_LIMIT = {
  maxRequests: 10,
  interval: 1000, // 1 second
  maxConcurrent: 2,
};
/**
 * Default retry configuration
 */
BaseCrawler.DEFAULT_RETRY = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
};

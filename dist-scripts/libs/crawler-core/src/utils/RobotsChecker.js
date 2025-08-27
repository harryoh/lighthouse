'use strict';
/**
 * RobotsChecker class for handling robots.txt compliance and crawl-delay enforcement
 * Provides cached robots.txt checking with proper respect for crawl directives
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
exports.RobotsChecker = void 0;
const robots_parser_1 = __importDefault(require('robots-parser'));
const axios_1 = __importDefault(require('axios'));
const winston = __importStar(require('winston'));
class RobotsChecker {
  constructor(config = {}, logger) {
    this.cache = new Map();
    this.lastAccessTime = new Map();
    this.config = {
      userAgent:
        'Mozilla/5.0 (compatible; NewsBot/1.0; +http://example.com/bot)',
      cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours
      respectCrawlDelay: true,
      defaultCrawlDelay: 1000, // 1 second
      maxCrawlDelay: 10000, // 10 seconds
      ...config,
    };
    this.logger =
      logger ||
      winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [new winston.transports.Console({ silent: true })],
      });
  }
  /**
   * Check if URL can be crawled according to robots.txt
   */
  async canCrawl(url) {
    try {
      const urlObj = new URL(url);
      const domain = `${urlObj.protocol}//${urlObj.host}`;
      // Get robots.txt for this domain
      const robotsEntry = await this.getRobots(domain);
      if (!robotsEntry) {
        return {
          allowed: true,
          crawlDelay: this.config.defaultCrawlDelay,
          reason: 'No robots.txt found, proceeding with default delay',
        };
      }
      const { robots, crawlDelay } = robotsEntry;
      // Check if URL is allowed
      const allowed = robots.isAllowed(url, this.config.userAgent);
      if (!allowed) {
        return {
          allowed: false,
          crawlDelay: 0,
          reason: 'URL disallowed by robots.txt',
        };
      }
      return {
        allowed: true,
        crawlDelay,
        reason: 'URL allowed by robots.txt',
      };
    } catch (error) {
      this.logger.warn(
        'Error checking robots.txt, allowing crawl with default delay',
        {
          url,
          error: error instanceof Error ? error.message : error,
        }
      );
      return {
        allowed: true,
        crawlDelay: this.config.defaultCrawlDelay,
        reason: 'Error checking robots.txt, proceeding with caution',
      };
    }
  }
  /**
   * Wait for crawl delay if needed before making request to domain
   */
  async waitForCrawlDelay(domain) {
    if (!this.config.respectCrawlDelay) {
      return;
    }
    const lastAccess = this.lastAccessTime.get(domain);
    if (!lastAccess) {
      this.lastAccessTime.set(domain, Date.now());
      return;
    }
    const robotsEntry = await this.getRobots(domain);
    const crawlDelay = robotsEntry?.crawlDelay || this.config.defaultCrawlDelay;
    const timeSinceLastAccess = Date.now() - lastAccess;
    const waitTime = crawlDelay - timeSinceLastAccess;
    if (waitTime > 0) {
      this.logger.debug('Waiting for crawl delay', {
        domain,
        waitTime,
        crawlDelay,
      });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastAccessTime.set(domain, Date.now());
  }
  /**
   * Get robots.txt for domain with caching
   */
  async getRobots(domain) {
    // Check cache first
    const cached = this.cache.get(domain);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      this.logger.debug('Using cached robots.txt', { domain });
      return cached;
    }
    try {
      const robotsUrl = `${domain}/robots.txt`;
      this.logger.debug('Fetching robots.txt', { robotsUrl });
      const response = await axios_1.default.get(robotsUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': this.config.userAgent,
        },
        validateStatus: (status) => status < 500, // Accept 404, but not server errors
      });
      if (response.status === 404) {
        this.logger.debug('robots.txt not found', { domain });
        return null;
      }
      if (response.status !== 200) {
        this.logger.debug('robots.txt request failed', {
          domain,
          status: response.status,
        });
        return null;
      }
      // Parse robots.txt
      const robots = (0, robots_parser_1.default)(robotsUrl, response.data);
      // Extract crawl-delay for our user agent
      let crawlDelay = this.config.defaultCrawlDelay;
      // Try to extract crawl-delay from robots.txt
      const robotsLines = response.data.split('\n');
      let isOurUserAgent = false;
      for (const line of robotsLines) {
        const trimmed = line.trim().toLowerCase();
        // Check if this line applies to our user agent
        if (trimmed.startsWith('user-agent:')) {
          const userAgent = trimmed.substring(11).trim();
          isOurUserAgent =
            userAgent === '*' ||
            userAgent === this.config.userAgent.toLowerCase() ||
            this.config.userAgent.toLowerCase().includes(userAgent);
        }
        // If we're in the right user-agent block, look for crawl-delay
        if (isOurUserAgent && trimmed.startsWith('crawl-delay:')) {
          const delayStr = trimmed.substring(12).trim();
          const delaySeconds = parseFloat(delayStr);
          if (!isNaN(delaySeconds)) {
            crawlDelay = Math.min(
              delaySeconds * 1000, // Convert to milliseconds
              this.config.maxCrawlDelay
            );
            this.logger.debug('Found crawl-delay directive', {
              domain,
              delaySeconds,
              crawlDelayMs: crawlDelay,
            });
          }
          break;
        }
      }
      const entry = {
        robots,
        timestamp: Date.now(),
        crawlDelay,
      };
      // Cache the result
      this.cache.set(domain, entry);
      this.logger.debug('Cached robots.txt', {
        domain,
        crawlDelayMs: crawlDelay,
        cacheSize: this.cache.size,
      });
      return entry;
    } catch (error) {
      this.logger.debug('Failed to fetch robots.txt', {
        domain,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }
  /**
   * Clear robots.txt cache
   */
  clearCache() {
    this.cache.clear();
    this.lastAccessTime.clear();
    this.logger.debug('Robots.txt cache cleared');
  }
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      domains: Array.from(this.cache.keys()),
    };
  }
  /**
   * Remove expired entries from cache
   */
  cleanupCache() {
    const now = Date.now();
    let removed = 0;
    for (const [domain, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.config.cacheTimeout) {
        this.cache.delete(domain);
        this.lastAccessTime.delete(domain);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug('Cleaned up expired robots.txt cache entries', {
        removed,
        remaining: this.cache.size,
      });
    }
  }
}
exports.RobotsChecker = RobotsChecker;

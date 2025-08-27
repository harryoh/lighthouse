'use strict';
/**
 * NewsCrawler class for crawling news websites
 * Extends BaseCrawler with news-specific functionality
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
Object.defineProperty(exports, '__esModule', { value: true });
exports.NewsCrawler = void 0;
const cheerio = __importStar(require('cheerio'));
const date_fns_1 = require('date-fns');
const BaseCrawler_1 = require('./BaseCrawler');
const news_types_1 = require('../types/news.types');
const PlaywrightAdapter_1 = require('../utils/PlaywrightAdapter');
const RobotsChecker_1 = require('../utils/RobotsChecker');
const NewsArticleValidator_1 = require('../utils/NewsArticleValidator');
class NewsCrawler extends BaseCrawler_1.BaseCrawler {
  constructor(
    source,
    logger,
    playwrightConfig,
    robotsConfig,
    validationConfig
  ) {
    super(source, logger);
    this.newsConfig = source;
    // Initialize Playwright adapter if config is provided or dynamic content is expected
    if (playwrightConfig || this.newsConfig.config?.['enableDynamicContent']) {
      this.playwrightAdapter = new PlaywrightAdapter_1.PlaywrightAdapter(
        playwrightConfig,
        logger
      );
    }
    // Initialize robots checker
    const defaultRobotsConfig = {
      userAgent:
        this.newsConfig.config?.['userAgent'] ||
        'Mozilla/5.0 (compatible; NewsBot/1.0)',
      respectCrawlDelay: this.newsConfig.config?.['respectRobotsTxt'] !== false,
      defaultCrawlDelay: 2000, // 2 seconds for news sites
    };
    this.robotsChecker = new RobotsChecker_1.RobotsChecker(
      { ...defaultRobotsConfig, ...robotsConfig },
      logger
    );
    // Initialize article validator
    const defaultValidationConfig = {
      minTitleLength: 10,
      minBodyLength: 200,
      dateRequired: true,
      maxArticleAge: 10,
      minQualityScore: 60,
    };
    this.articleValidator = new NewsArticleValidator_1.NewsArticleValidator(
      { ...defaultValidationConfig, ...validationConfig },
      logger
    );
    this.validateNewsConfig();
  }
  /**
   * Validate news-specific configuration
   */
  validateNewsConfig() {
    const { selectors } = this.newsConfig;
    if (!selectors.titleSelector) {
      throw new Error('titleSelector is required in news source configuration');
    }
    if (!selectors.bodySelector) {
      throw new Error('bodySelector is required in news source configuration');
    }
    this.logger.info('News crawler configuration validated', {
      source: this.newsConfig.name,
      selectors: Object.keys(selectors).length,
    });
  }
  /**
   * Get rate limit configuration for news sites
   */
  getRateLimitConfig() {
    return {
      maxRequests: 5,
      interval: 2000, // 2 seconds between requests
      maxConcurrent: 1, // Single concurrent request to respect news sites
    };
  }
  /**
   * Get retry configuration for news sites
   */
  getRetryConfig() {
    return {
      maxAttempts: 2, // Fewer retries for news sites
      initialDelay: 3000, // 3 seconds initial delay
      maxDelay: 15000, // 15 seconds max delay
      backoffFactor: 2,
    };
  }
  /**
   * Get request options with news-appropriate user agents
   */
  getRequestOptions() {
    const baseOptions = super.getRequestOptions();
    return {
      ...baseOptions,
      headers: {
        ...baseOptions.headers,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        DNT: '1',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000,
    };
  }
  /**
   * Parse date string using configured formats with Korean language support
   */
  parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      return undefined;
    }
    const cleanDateString = dateString.trim();
    // Try parsing with regex patterns for Korean formats
    const koreanPatterns = [
      // 2024년 12월 1일 오후 2:30
      {
        pattern:
          /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*오후\s*(\d{1,2}):(\d{2})/,
        handler: (match) => {
          const [, year, month, day, hour, minute] = match;
          const adjustedHour =
            parseInt(hour) + (parseInt(hour) === 12 ? 0 : 12);
          return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            adjustedHour,
            parseInt(minute)
          );
        },
      },
      // 2024년 12월 1일 오전 10:30
      {
        pattern:
          /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*오전\s*(\d{1,2}):(\d{2})/,
        handler: (match) => {
          const [, year, month, day, hour, minute] = match;
          const adjustedHour = parseInt(hour) === 12 ? 0 : parseInt(hour);
          return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            adjustedHour,
            parseInt(minute)
          );
        },
      },
      // 2024년 12월 1일 14시 30분
      {
        pattern:
          /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2})시\s*(\d{2})분/,
        handler: (match) => {
          const [, year, month, day, hour, minute] = match;
          return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute)
          );
        },
      },
      // 2024년 12월 1일
      {
        pattern: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,
        handler: (match) => {
          const [, year, month, day] = match;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        },
      },
      // 12월 1일 오후 2:30
      {
        pattern: /(\d{1,2})월\s*(\d{1,2})일\s*오후\s*(\d{1,2}):(\d{2})/,
        handler: (match) => {
          const [, month, day, hour, minute] = match;
          const currentYear = new Date().getFullYear();
          const adjustedHour =
            parseInt(hour) + (parseInt(hour) === 12 ? 0 : 12);
          return new Date(
            currentYear,
            parseInt(month) - 1,
            parseInt(day),
            adjustedHour,
            parseInt(minute)
          );
        },
      },
      // 12월 1일 오전 10:30
      {
        pattern: /(\d{1,2})월\s*(\d{1,2})일\s*오전\s*(\d{1,2}):(\d{2})/,
        handler: (match) => {
          const [, month, day, hour, minute] = match;
          const currentYear = new Date().getFullYear();
          const adjustedHour = parseInt(hour) === 12 ? 0 : parseInt(hour);
          return new Date(
            currentYear,
            parseInt(month) - 1,
            parseInt(day),
            adjustedHour,
            parseInt(minute)
          );
        },
      },
      // 12월 1일
      {
        pattern: /(\d{1,2})월\s*(\d{1,2})일/,
        handler: (match) => {
          const [, month, day] = match;
          const currentYear = new Date().getFullYear();
          return new Date(currentYear, parseInt(month) - 1, parseInt(day));
        },
      },
      // 2024.12.01. 14:30
      {
        pattern: /(\d{4})\.(\d{1,2})\.(\d{1,2})\.\s*(\d{1,2}):(\d{2})/,
        handler: (match) => {
          const [, year, month, day, hour, minute] = match;
          return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute)
          );
        },
      },
      // 2024.12.01.
      {
        pattern: /(\d{4})\.(\d{1,2})\.(\d{1,2})\./,
        handler: (match) => {
          const [, year, month, day] = match;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        },
      },
      // 2024/12/01 14:30
      {
        pattern: /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/,
        handler: (match) => {
          const [, year, month, day, hour, minute] = match;
          return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute)
          );
        },
      },
      // 2024/12/01
      {
        pattern: /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
        handler: (match) => {
          const [, year, month, day] = match;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        },
      },
      // 2024-12-01 14:30:45
      {
        pattern: /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/,
        handler: (match) => {
          const [, year, month, day, hour, minute, second] = match;
          return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute),
            parseInt(second)
          );
        },
      },
      // 2024-12-01
      {
        pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/,
        handler: (match) => {
          const [, year, month, day] = match;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        },
      },
    ];
    // Try Korean patterns first
    for (const { pattern, handler } of koreanPatterns) {
      try {
        const match = cleanDateString.match(pattern);
        if (match) {
          const date = handler(match);
          if (date && (0, date_fns_1.isValid)(date)) {
            this.logger.debug('Date parsed successfully with Korean pattern', {
              dateString: cleanDateString,
              result: date,
            });
            return date;
          }
        }
      } catch (error) {
        this.logger.debug('Korean date parsing failed', {
          pattern: pattern.toString(),
          dateString: cleanDateString,
          error,
        });
        continue;
      }
    }
    // Try ISO date parsing
    try {
      const isoDate = (0, date_fns_1.parseISO)(cleanDateString);
      if ((0, date_fns_1.isValid)(isoDate)) {
        return isoDate;
      }
    } catch (error) {
      this.logger.debug('ISO date parsing failed', {
        dateString: cleanDateString,
        error,
      });
    }
    // Fallback to native Date parsing
    try {
      const date = new Date(cleanDateString);
      if ((0, date_fns_1.isValid)(date)) {
        return date;
      }
    } catch (error) {
      this.logger.warn('All date parsing attempts failed', {
        dateString: cleanDateString,
        error,
      });
    }
    return undefined;
  }
  /**
   * Extract text content from cheerio element
   */
  extractText($, selector, fallback = '') {
    if (typeof selector === 'string') {
      const element = $(selector);
      return element.length > 0
        ? this.cleanText(element.text().trim())
        : fallback;
    } else {
      return selector.length > 0
        ? this.cleanText(selector.text().trim())
        : fallback;
    }
  }
  /**
   * Extract all text from multiple elements
   */
  extractAllText($, selector) {
    const elements = $(selector);
    return elements
      .toArray()
      .map((el) => this.cleanText($(el).text().trim()))
      .filter((text) => text.length > 0);
  }
  /**
   * Clean and normalize text content
   */
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\u00A0/g, ' ') // Non-breaking spaces to regular spaces
      .replace(/[\r\n\t]/g, ' ') // Line breaks and tabs to spaces
      .trim();
  }
  /**
   * Extract metadata with fallback options
   */
  extractMetadata($, selectors) {
    for (const selector of selectors) {
      const text = this.extractText($, selector);
      if (text) return text;
    }
    return '';
  }
  /**
   * Extract image URL with fallback attributes
   */
  extractImageUrl($, element) {
    const $el = $(element);
    return (
      $el.attr('src') || $el.attr('data-src') || $el.attr('data-original') || ''
    );
  }
  /**
   * Determine if dynamic content support is needed for this URL
   */
  async shouldUseDynamicContent(url, initialHtml) {
    const dynamicConfig = this.newsConfig.dynamicContentConfig;
    // Force Playwright if configured
    if (dynamicConfig?.forcePlaywright) {
      return true;
    }
    // Use Playwright if explicitly enabled but not forced
    if (dynamicConfig?.enabled && !dynamicConfig.detectAutomatically) {
      return true;
    }
    // Auto-detection
    if (dynamicConfig?.detectAutomatically && this.playwrightAdapter) {
      const indicators = await this.playwrightAdapter.detectDynamicContent(
        url,
        initialHtml
      );
      // Use dynamic content if any key indicators are found
      return Boolean(
        indicators.clientSideRendering ||
          indicators.hasInfiniteScroll ||
          indicators.hasLazyLoading ||
          indicators.hasReact ||
          indicators.hasVue ||
          indicators.hasAngular
      );
    }
    return false;
  }
  /**
   * Get HTML content, using Playwright if dynamic content is detected
   */
  async getPageContent(url) {
    // First try static request
    const staticHtml = await this.makeRequest(url);
    if (!staticHtml || typeof staticHtml !== 'string') {
      throw new Error('Failed to fetch page content');
    }
    // Check if we need dynamic content support
    const needsDynamic = await this.shouldUseDynamicContent(url, staticHtml);
    if (needsDynamic && this.playwrightAdapter) {
      this.logger.info('Using Playwright for dynamic content', { url });
      const dynamicConfig = this.newsConfig.dynamicContentConfig;
      try {
        const dynamicHtml = await this.playwrightAdapter.renderPage(url, {
          waitForSelector: dynamicConfig?.waitForSelector,
          scrollForContent: dynamicConfig?.scrollForContent,
          scrollOptions: {
            maxScrolls: 3,
            scrollDelay: 2000,
          },
        });
        return dynamicHtml;
      } catch (error) {
        this.logger.warn(
          'Playwright rendering failed, falling back to static content',
          {
            url,
            error: error instanceof Error ? error.message : error,
          }
        );
        return staticHtml;
      }
    }
    return staticHtml;
  }
  /**
   * Parse news article content from HTML
   */
  async crawlPage(url) {
    try {
      this.logger.info('Starting to crawl news page', { url });
      // Check robots.txt compliance first
      const robotsPermission = await this.checkRobotsCompliance(url);
      if (!robotsPermission.allowed) {
        this.logger.warn('URL blocked by robots.txt', {
          url,
          reason: robotsPermission.reason,
        });
        return null;
      }
      // Wait for crawl delay if required
      const urlObj = new URL(url);
      const domain = `${urlObj.protocol}//${urlObj.host}`;
      await this.robotsChecker.waitForCrawlDelay(domain);
      const html = await this.getPageContent(url);
      if (!html || typeof html !== 'string') {
        this.logger.warn('Invalid HTML response', { url });
        return null;
      }
      const $ = cheerio.load(html);
      const { selectors } = this.newsConfig;
      // Extract title with fallback to meta tags
      const title = this.extractMetadata(
        $,
        [
          selectors.titleSelector,
          'h1',
          'title',
          'meta[property="og:title"]',
          'meta[name="twitter:title"]',
        ].filter((s) => Boolean(s))
      );
      // Extract body content with fallback
      const body = this.extractMetadata(
        $,
        [
          selectors.bodySelector,
          'article',
          '.article-content',
          '.content',
          'main',
        ].filter((s) => Boolean(s))
      );
      if (!title || !body) {
        this.logger.warn('Required content not found', {
          url,
          title: !!title,
          body: !!body,
          titleLength: title?.length || 0,
          bodyLength: body?.length || 0,
        });
        return null;
      }
      // Validate content quality
      if (body.length < 50) {
        this.logger.warn('Body content too short', {
          url,
          bodyLength: body.length,
        });
        return null;
      }
      // Extract optional fields with fallbacks
      const author = this.extractMetadata(
        $,
        [
          selectors.authorSelector,
          'meta[name="author"]',
          '.author',
          '.byline',
        ].filter((s) => Boolean(s))
      );
      const dateString =
        this.extractMetadata(
          $,
          [
            selectors.dateSelector,
            'meta[property="article:published_time"]',
            'meta[name="date"]',
            'time[datetime]',
            '.date',
            '.published',
          ].filter((s) => Boolean(s))
        ) ||
        $('time').attr('datetime') ||
        '';
      const publishedDate = dateString ? this.parseDate(dateString) : undefined;
      // Extract images with lazy loading support
      const images = [];
      if (selectors.imageSelector) {
        $(selectors.imageSelector).each((_, element) => {
          const imageUrl = this.extractImageUrl($, element);
          if (imageUrl && !imageUrl.includes('data:image')) {
            // Convert relative URLs to absolute
            try {
              const absoluteUrl = new URL(imageUrl, url).href;
              images.push(absoluteUrl);
            } catch {
              // If URL parsing fails, keep original if it looks like a full URL
              if (imageUrl.startsWith('http')) {
                images.push(imageUrl);
              }
            }
          }
        });
      }
      // Extract captions
      const captions = selectors.captionSelector
        ? this.extractAllText($, selectors.captionSelector)
        : [];
      // Extract excerpt with fallback to meta description
      const excerpt = this.extractMetadata(
        $,
        [
          selectors.excerptSelector,
          'meta[property="og:description"]',
          'meta[name="description"]',
          'meta[name="twitter:description"]',
          '.excerpt',
          '.summary',
        ].filter((s) => Boolean(s))
      );
      // Extract category
      const category = this.extractMetadata(
        $,
        [
          selectors.categorySelector,
          'meta[property="article:section"]',
          '.category',
          '.section',
        ].filter((s) => Boolean(s))
      );
      // Extract tags
      const tags = selectors.tagSelector
        ? this.extractAllText($, selectors.tagSelector)
        : [];
      // Add structured data tags if available
      const structuredData = $('script[type="application/ld+json"]');
      if (structuredData.length > 0) {
        try {
          const jsonLd = JSON.parse(structuredData.first().html() || '{}');
          if (jsonLd.keywords && Array.isArray(jsonLd.keywords)) {
            tags.push(...jsonLd.keywords);
          } else if (typeof jsonLd.keywords === 'string') {
            tags.push(...jsonLd.keywords.split(',').map((tag) => tag.trim()));
          }
        } catch (error) {
          this.logger.debug('Failed to parse JSON-LD structured data', {
            url,
            error,
          });
        }
      }
      const article = {
        title,
        body,
        sourceUrl: url,
        images,
        captions,
        author: author || undefined,
        publishedDate,
        excerpt: excerpt || undefined,
        category: category || undefined,
        tags: tags.length > 0 ? [...new Set(tags)] : undefined, // Remove duplicates
      };
      // Validate article quality and compliance
      const validationResult = await this.validateArticle(article);
      if (!validationResult.isValid) {
        this.logger.warn('Article failed validation', {
          url,
          title: title.substring(0, 50),
          score: validationResult.score,
          issues: validationResult.issues,
          warnings: validationResult.warnings,
        });
        return null;
      }
      // Check for duplicates
      const duplicateCheck = this.articleValidator.checkDuplicate(
        validationResult.contentHash
      );
      if (duplicateCheck.isDuplicate) {
        this.logger.info('Duplicate article detected, skipping', {
          url,
          title: title.substring(0, 50),
          contentHash: validationResult.contentHash,
        });
        return null;
      }
      const content = {
        url,
        title,
        body,
        publishedAt: publishedDate || new Date(),
        rawHtml: html,
        contentHash: validationResult.contentHash,
        author,
        article,
      };
      this.logger.info('Successfully parsed news article', {
        url,
        title: title.substring(0, 100),
        hasAuthor: !!author,
        hasDate: !!publishedDate,
        imageCount: images.length,
        captionCount: captions.length,
        excerptLength: excerpt?.length || 0,
        bodyLength: body.length,
        tagCount: tags.length,
      });
      return content;
    } catch (error) {
      this.logger.error('Failed to parse news article', { url, error });
      return null;
    }
  }
  /**
   * Get URLs to crawl (implementation for single article)
   */
  async getUrlsToCrawl() {
    // For single article crawling, return the source URL
    return [this.newsConfig.url];
  }
  /**
   * Initialize discovery session
   */
  initDiscoverySession(baseUrl) {
    this.discoverySession = {
      baseUrl,
      discoveredUrls: new Set(),
      visitedPages: new Set(),
      currentDepth: 0,
      currentPage: 1,
      categoryLinks: [],
      sectionLinks: [],
    };
  }
  /**
   * Validate URL against discovery config
   */
  isValidArticleUrl(url) {
    const discoveryConfig = this.newsConfig.discovery;
    if (!discoveryConfig) return true;
    try {
      const urlObj = new URL(url);
      // Check allowed domains
      if (discoveryConfig.allowedDomains?.length) {
        const isAllowed = discoveryConfig.allowedDomains.some(
          (domain) =>
            urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
        );
        if (!isAllowed) return false;
      }
      // Check include patterns (overrides exclude patterns)
      if (discoveryConfig.includePatterns?.length) {
        return discoveryConfig.includePatterns.some((pattern) =>
          new RegExp(pattern).test(url)
        );
      }
      // Check exclude patterns
      if (discoveryConfig.excludePatterns?.length) {
        const isExcluded = discoveryConfig.excludePatterns.some((pattern) =>
          new RegExp(pattern).test(url)
        );
        if (isExcluded) return false;
      }
      return true;
    } catch (error) {
      this.logger.debug('Invalid URL format', { url, error });
      return false;
    }
  }
  /**
   * Extract article URLs from HTML
   */
  extractArticleUrls($, baseUrl) {
    const { selectors } = this.newsConfig;
    const urls = [];
    if (!selectors.articleListSelector) {
      this.logger.warn('No articleListSelector configured');
      return urls;
    }
    $(selectors.articleListSelector).each((_, element) => {
      const $element = $(element);
      let linkUrl = '';
      // Try to find link within the element
      const $link = $element.find('a').first();
      if ($link.length > 0) {
        linkUrl = $link.attr('href') || '';
      } else if ($element.is('a')) {
        linkUrl = $element.attr('href') || '';
      }
      if (linkUrl) {
        try {
          // Convert relative URLs to absolute
          const absoluteUrl = new URL(linkUrl, baseUrl).href;
          if (this.isValidArticleUrl(absoluteUrl)) {
            urls.push(absoluteUrl);
          }
        } catch (error) {
          this.logger.debug('Failed to process article URL', {
            linkUrl,
            baseUrl,
            error,
          });
        }
      }
    });
    this.logger.debug('Extracted article URLs', {
      baseUrl,
      count: urls.length,
    });
    return urls;
  }
  /**
   * Detect pagination and find next page URL
   */
  detectNextPage($, baseUrl, currentPage) {
    const { selectors, pagination } = this.newsConfig;
    if (!pagination) return undefined;
    // Try next button selector first
    if (selectors.nextPageSelector) {
      const $nextButton = $(selectors.nextPageSelector);
      if ($nextButton.length > 0) {
        const nextUrl = $nextButton.attr('href');
        if (nextUrl) {
          try {
            return new URL(nextUrl, baseUrl).href;
          } catch (error) {
            this.logger.debug('Invalid next page URL', {
              nextUrl,
              baseUrl,
              error,
            });
          }
        }
      }
    }
    // Try page parameter pattern
    if (pagination.pageParamPattern) {
      try {
        const nextPage = currentPage + 1;
        const nextPageUrl = pagination.pageParamPattern.replace(
          '{page}',
          nextPage.toString()
        );
        // Handle different pattern types
        if (nextPageUrl.startsWith('?') || nextPageUrl.startsWith('&')) {
          const baseUrlObj = new URL(baseUrl);
          // For patterns starting with ?, replace entire search params
          if (nextPageUrl.startsWith('?')) {
            return `${baseUrlObj.protocol}//${baseUrlObj.host}${baseUrlObj.pathname}${nextPageUrl}`;
          }
          // For patterns starting with &, append to existing params
          const separator = baseUrlObj.search ? '&' : '?';
          return baseUrl + separator + nextPageUrl.substring(1);
        } else if (nextPageUrl.startsWith('/')) {
          const baseUrlObj = new URL(baseUrl);
          return `${baseUrlObj.protocol}//${baseUrlObj.host}${nextPageUrl}`;
        } else {
          return new URL(nextPageUrl, baseUrl).href;
        }
      } catch (error) {
        this.logger.debug('Failed to generate next page URL', {
          currentPage,
          baseUrl,
          error,
        });
      }
    }
    // Try pagination selector with number detection
    if (selectors.paginationSelector) {
      const $paginationLinks = $(selectors.paginationSelector);
      const nextPageNumber = currentPage + 1;
      let nextPageUrl;
      $paginationLinks.each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        const text = $link.text().trim();
        if (href) {
          // Try to extract page number from text
          const textMatch = text.match(/^\d+$/);
          if (textMatch) {
            const pageNum = parseInt(textMatch[0], 10);
            if (pageNum === nextPageNumber) {
              try {
                nextPageUrl = new URL(href, baseUrl).href;
                return false; // Break out of each loop
              } catch (error) {
                this.logger.debug('Invalid pagination URL', {
                  href,
                  baseUrl,
                  error,
                });
              }
            }
          }
        }
        return true; // Continue iteration by default
      });
      if (nextPageUrl) {
        return nextPageUrl;
      }
    }
    return undefined;
  }
  /**
   * Extract category and section links
   */
  extractCategorySectionLinks($, baseUrl) {
    if (!this.discoverySession) return;
    const { selectors, discovery } = this.newsConfig;
    // Extract section links
    if (discovery?.followSections && selectors.sectionSelector) {
      $(selectors.sectionSelector).each((_, element) => {
        const $element = $(element);
        const href = $element.attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, baseUrl).href;
            const urlObj = new URL(absoluteUrl);
            // Check allowed domains
            const isAllowedDomain =
              !discovery?.allowedDomains?.length ||
              discovery.allowedDomains.some(
                (domain) =>
                  urlObj.hostname === domain ||
                  urlObj.hostname.endsWith(`.${domain}`)
              );
            if (!isAllowedDomain) return;
            // Check exclude patterns for section links too
            const isExcluded =
              discovery?.excludePatterns?.some((pattern) => {
                // Handle patterns that may or may not have trailing slashes
                const flexiblePattern = pattern.replace(/\/$/, '/?'); // Make trailing slash optional
                return new RegExp(flexiblePattern).test(absoluteUrl);
              }) || false;
            if (
              !isExcluded &&
              !this.discoverySession.sectionLinks.includes(absoluteUrl)
            ) {
              this.discoverySession.sectionLinks.push(absoluteUrl);
            }
          } catch (error) {
            this.logger.debug('Invalid section URL', { href, baseUrl, error });
          }
        }
      });
    }
    this.logger.debug('Extracted category/section links', {
      sectionLinks: this.discoverySession.sectionLinks.length,
    });
  }
  /**
   * Discover article URLs from a list page with pagination
   */
  async discoverArticles(listPageUrl) {
    this.logger.info('Starting article discovery', { listPageUrl });
    const paginationConfig = this.newsConfig.pagination || { maxPages: 10 };
    this.initDiscoverySession(listPageUrl);
    const result = {
      urls: [],
      currentPage: 1,
      hasMorePages: false,
    };
    try {
      let currentUrl = listPageUrl;
      let currentPage = 1;
      const maxPages = paginationConfig.maxPages || 10;
      while (currentPage <= maxPages && currentUrl) {
        // Skip if we've already visited this page
        if (this.discoverySession.visitedPages.has(currentUrl)) {
          this.logger.debug('Page already visited', {
            url: currentUrl,
            page: currentPage,
          });
          break;
        }
        this.logger.debug('Discovering articles from page', {
          url: currentUrl,
          page: currentPage,
        });
        const html = await this.getPageContent(currentUrl);
        if (!html) {
          this.logger.warn('Empty response from list page', {
            url: currentUrl,
          });
          break;
        }
        const $ = cheerio.load(html);
        this.discoverySession.visitedPages.add(currentUrl);
        // Extract article URLs
        const pageUrls = this.extractArticleUrls($, currentUrl);
        let newUrls = 0;
        for (const url of pageUrls) {
          if (!this.discoverySession.discoveredUrls.has(url)) {
            this.discoverySession.discoveredUrls.add(url);
            result.urls.push(url);
            newUrls++;
          }
        }
        this.logger.debug('Page discovery results', {
          page: currentPage,
          totalUrls: pageUrls.length,
          newUrls,
          totalDiscovered: result.urls.length,
        });
        // Extract category/section links on first page
        if (currentPage === 1) {
          this.extractCategorySectionLinks($, currentUrl);
        }
        // Try to find next page
        const nextPageUrl = this.detectNextPage($, currentUrl, currentPage);
        if (nextPageUrl && nextPageUrl !== currentUrl) {
          currentUrl = nextPageUrl;
          currentPage++;
          result.hasMorePages = true;
          result.nextPageUrl = nextPageUrl;
        } else {
          result.hasMorePages = false;
          break;
        }
        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      result.currentPage = currentPage;
      result.totalPages = currentPage;
      this.logger.info('Article discovery completed', {
        listPageUrl,
        totalUrls: result.urls.length,
        pagesVisited: currentPage,
        hasMorePages: result.hasMorePages,
        sectionLinks: this.discoverySession.sectionLinks.length,
      });
      return result;
    } catch (error) {
      this.logger.error('Article discovery failed', { listPageUrl, error });
      return result;
    }
  }
  /**
   * Discover articles from multiple category/section pages
   */
  async discoverArticlesDeep(startUrl) {
    this.logger.info('Starting deep article discovery', { startUrl });
    const discoveryConfig = this.newsConfig.discovery || { maxDepth: 3 };
    const allUrls = new Set();
    // Initial discovery from start URL
    const initialResult = await this.discoverArticles(startUrl);
    initialResult.urls.forEach((url) => allUrls.add(url));
    // Follow section links if enabled
    if (
      discoveryConfig.followSections &&
      this.discoverySession?.sectionLinks.length
    ) {
      const maxSections = Math.min(
        this.discoverySession.sectionLinks.length,
        5
      ); // Limit to 5 sections
      for (let i = 0; i < maxSections; i++) {
        const sectionUrl = this.discoverySession.sectionLinks[i];
        if (!sectionUrl) continue;
        this.logger.debug('Discovering articles from section', { sectionUrl });
        try {
          const sectionResult = await this.discoverArticles(sectionUrl);
          sectionResult.urls.forEach((url) => allUrls.add(url));
          // Rate limiting between sections
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          this.logger.warn('Failed to discover from section', {
            sectionUrl,
            error,
          });
        }
      }
    }
    const finalUrls = Array.from(allUrls);
    this.logger.info('Deep article discovery completed', {
      startUrl,
      totalUrls: finalUrls.length,
      sectionsProcessed: this.discoverySession?.sectionLinks.length || 0,
    });
    return finalUrls;
  }
  /**
   * Check robots.txt compliance for URL
   */
  async checkRobotsCompliance(url) {
    return await this.robotsChecker.canCrawl(url);
  }
  /**
   * Validate news article against quality rules
   */
  async validateArticle(article) {
    return this.articleValidator.validateArticle(article);
  }
  /**
   * Clean up resources including Playwright adapter
   */
  async cleanup() {
    try {
      if (this.playwrightAdapter) {
        await this.playwrightAdapter.cleanup();
        this.playwrightAdapter = undefined;
      }
      this.logger.debug('NewsCrawler cleanup completed');
    } catch (error) {
      this.logger.error('Error during NewsCrawler cleanup', { error });
    }
  }
  /**
   * Create NewsCrawler from preset
   */
  static fromPreset(
    presetName,
    url,
    logger,
    playwrightConfig,
    robotsConfig,
    validationConfig
  ) {
    const preset = news_types_1.KOREAN_NEWS_PRESETS[presetName];
    if (!preset) {
      throw new Error(`News preset '${presetName}' not found`);
    }
    const config = {
      id: `${presetName}-${Date.now()}`,
      name: preset.name,
      url,
      ...preset.config,
    };
    return new NewsCrawler(
      config,
      logger,
      playwrightConfig,
      robotsConfig,
      validationConfig
    );
  }
  /**
   * Get available news presets
   */
  static getAvailablePresets() {
    return Object.keys(news_types_1.KOREAN_NEWS_PRESETS);
  }
}
exports.NewsCrawler = NewsCrawler;

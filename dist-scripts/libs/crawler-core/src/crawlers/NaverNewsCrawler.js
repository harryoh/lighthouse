'use strict';
/**
 * NaverNewsCrawler - Specialized crawler for Naver News
 * Extends NewsCrawler with Naver-specific configurations and optimizations
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
exports.NaverNewsCrawler = void 0;
const crypto = __importStar(require('crypto'));
const cheerio = __importStar(require('cheerio'));
const axios_1 = __importDefault(require('axios'));
const NewsCrawler_1 = require('./NewsCrawler');
const news_types_1 = require('../types/news.types');
class NaverNewsCrawler extends NewsCrawler_1.NewsCrawler {
  constructor(url, logger, playwrightConfig, robotsConfig, validationConfig) {
    const naverPreset = news_types_1.KOREAN_NEWS_PRESETS['naver'];
    if (!naverPreset) {
      throw new Error('Naver News preset not found');
    }
    // Create Naver-specific configuration
    const config = {
      id: `naver-news-${Date.now()}`,
      name: naverPreset.name,
      url,
      ...naverPreset.config,
    };
    // Naver-specific robots configuration with more conservative settings
    const defaultRobotsConfig = {
      userAgent:
        'Mozilla/5.0 (compatible; LighthouseBot/1.0; +https://github.com/lighthouse/crawler)',
      respectCrawlDelay: true,
      defaultCrawlDelay: 3000, // 3 seconds for Naver (more conservative)
      maxCrawlDelay: 30000, // 30 seconds max
    };
    // Naver-specific validation with stricter quality checks
    const defaultValidationConfig = {
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
  getRateLimitConfig() {
    return {
      maxRequests: 3, // More conservative for Naver
      interval: 3000, // 3 seconds between requests
      maxConcurrent: 1, // Single concurrent request
    };
  }
  /**
   * Naver-specific retry configuration
   */
  getRetryConfig() {
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
  getRequestOptions() {
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
  static isValidNaverNewsUrl(url) {
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
  static extractArticleId(url) {
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
  static forSection(sectionUrl, logger, options) {
    const crawler = new NaverNewsCrawler(
      sectionUrl,
      logger,
      options?.playwrightConfig,
      options?.robotsConfig,
      options?.validationConfig
    );
    // Override pagination settings if provided
    if (options?.maxPages !== undefined) {
      crawler.newsConfig.pagination = {
        ...crawler.newsConfig.pagination,
        maxPages: options.maxPages,
      };
    }
    // Override discovery settings if provided
    if (options?.followSections !== undefined) {
      crawler.newsConfig.discovery = {
        ...crawler.newsConfig.discovery,
        followSections: options.followSections,
      };
    }
    return crawler;
  }
  /**
   * Get common Naver News section URLs
   */
  static getCommonSectionUrls() {
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
  async crawl() {
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
  async getUrlsToCrawl() {
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
  /**
   * Implement crawlPage to parse individual Naver News articles
   * This method extracts article content using Naver-specific selectors
   */
  async crawlPage(url) {
    try {
      this.logger.debug('Crawling Naver News article page', { url });
      // Fetch the article page HTML
      const response = await axios_1.default.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        timeout: 30000,
      });
      const html = response.data;
      if (!html) {
        this.logger.warn('Failed to fetch article page', { url });
        return null;
      }
      // Load HTML into cheerio
      const $ = cheerio.load(html);
      // Extract article title
      const title = $('#title_area span, .media_end_head_headline')
        .first()
        .text()
        .trim();
      if (!title) {
        this.logger.warn('No title found for article', { url });
        return null;
      }
      // Extract article body
      const body = $('#dic_area, #newsEndContents, .news_end_font_size')
        .clone()
        .find('script, style, .end_photo_org')
        .remove()
        .end()
        .text()
        .trim();
      if (!body) {
        this.logger.warn('No body content found for article', { url });
        return null;
      }
      // Extract author (optional)
      const author =
        $('.byline_s .name, .media_end_head_journalist_name')
          .first()
          .text()
          .replace('기자', '')
          .trim() || undefined;
      // Extract publish date
      const dateText = $(
        '.media_end_head_info_datestamp_time, .byline .date_time, .t_date'
      )
        .first()
        .text()
        .trim();
      let publishedAt = new Date();
      if (dateText) {
        const parsedDate = this.parseKoreanDate(dateText);
        if (parsedDate) {
          publishedAt = parsedDate;
        } else {
          this.logger.debug('Could not parse date', { dateText, url });
        }
      }
      // Create content hash for deduplication
      const contentHash = crypto
        .createHash('sha256')
        .update(`${title}${body}`)
        .digest('hex');
      // Extract additional metadata
      const metadata = {};
      // Extract article ID if present
      const articleId = NaverNewsCrawler.extractArticleId(url);
      if (articleId) {
        metadata['articleId'] = articleId;
      }
      // Extract press/publisher
      const press =
        $('.media_end_head_top_logo img, .press_logo img')
          .first()
          .attr('alt') ||
        $('.media_end_head_top_logo_text, .gisa_press .logo')
          .first()
          .text()
          .trim();
      if (press) {
        metadata['press'] = press;
      }
      // Extract category if present
      const category = $('.media_end_categorize_item, .guide_categorize_item')
        .first()
        .text()
        .trim();
      if (category) {
        metadata['category'] = category;
      }
      // Extract image URLs
      const images = [];
      $('#img1, .end_photo_org img, #newsEndContents img').each((_, elem) => {
        const src = $(elem).attr('src');
        if (src && !src.includes('blank.gif')) {
          images.push(src);
        }
      });
      if (images.length > 0) {
        metadata['images'] = images;
      }
      // Extract tags/keywords
      const tags = [];
      $('.tag_area a, .keyword_area a').each((_, elem) => {
        const tag = $(elem).text().trim();
        if (tag) {
          tags.push(tag);
        }
      });
      if (tags.length > 0) {
        metadata['tags'] = tags;
      }
      const parsedContent = {
        url,
        title,
        body,
        author,
        publishedAt,
        rawHtml: html,
        contentHash,
        metadata,
      };
      this.logger.debug('Successfully parsed Naver News article', {
        url,
        title: title.substring(0, 50),
        bodyLength: body.length,
        author,
        publishedAt: publishedAt.toISOString(),
      });
      return parsedContent;
    } catch (error) {
      this.logger.error('Failed to crawl Naver News article page', {
        url,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }
  /**
   * Helper method to parse Korean date formats commonly used in Naver News
   */
  parseKoreanDate(dateText) {
    try {
      // Remove extra spaces and normalize
      const normalized = dateText.replace(/\s+/g, ' ').trim();
      // Pattern: 2024.01.09. 오후 3:25
      const pattern1 =
        /(\d{4})\.(\d{1,2})\.(\d{1,2})\.\s*(오전|오후)?\s*(\d{1,2}):(\d{2})/;
      const match1 = normalized.match(pattern1);
      if (match1) {
        const [, year, month, day, ampm, hour, minute] = match1;
        let adjustedHour = parseInt(hour);
        if (ampm === '오후' && adjustedHour !== 12) {
          adjustedHour += 12;
        } else if (ampm === '오전' && adjustedHour === 12) {
          adjustedHour = 0;
        }
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          adjustedHour,
          parseInt(minute)
        );
      }
      // Pattern: 2024-01-09 15:25:00
      const pattern2 =
        /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/;
      const match2 = normalized.match(pattern2);
      if (match2) {
        const [, year, month, day, hour, minute] = match2;
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute)
        );
      }
      // Pattern: 2024.01.09.
      const pattern3 = /(\d{4})\.(\d{1,2})\.(\d{1,2})\./;
      const match3 = normalized.match(pattern3);
      if (match3) {
        const [, year, month, day] = match3;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return null;
    } catch (error) {
      this.logger.debug('Error parsing Korean date', { dateText, error });
      return null;
    }
  }
}
exports.NaverNewsCrawler = NaverNewsCrawler;

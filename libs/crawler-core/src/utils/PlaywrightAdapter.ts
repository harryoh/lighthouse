/**
 * PlaywrightAdapter class for handling dynamic content and JavaScript-rendered pages
 * Provides efficient browser instance management and specialized methods for news sites
 */

// Dynamic import to avoid bundling playwright
type Browser = any;
type BrowserContext = any;
type Page = any;
let chromium: any;
let firefox: any;
let webkit: any;
import * as winston from 'winston';

export interface PlaywrightConfig {
  browserType?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  timeout?: number;
  locale?: string;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  launchOptions?: Record<string, any>;
}

export interface ScrollOptions {
  maxScrolls?: number;
  scrollDelay?: number;
  stabilizationTime?: number;
  stopCondition?: () => Promise<boolean>;
}

export interface DynamicContentIndicators {
  hasReact?: boolean;
  hasVue?: boolean;
  hasAngular?: boolean;
  hasLazyLoading?: boolean;
  hasInfiniteScroll?: boolean;
  hasGdprPopup?: boolean;
  clientSideRendering?: boolean;
}

export class PlaywrightAdapter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: Required<PlaywrightConfig>;
  private logger: winston.Logger;
  private cleanupTimer?: NodeJS.Timeout;
  private lastUsed: Date = new Date();

  constructor(config: PlaywrightConfig = {}, logger?: winston.Logger) {
    this.config = {
      browserType: 'chromium',
      headless: true,
      timeout: 30000,
      locale: 'ko-KR',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      launchOptions: {},
      ...config,
    };

    this.logger =
      logger ||
      winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [new winston.transports.Console({ silent: true })],
      });

    // Auto-cleanup after 5 minutes of inactivity
    this.setupAutoCleanup();
  }

  /**
   * Initialize browser and context if not already done
   */
  private async ensureInitialized(): Promise<void> {
    if (this.browser && this.context) {
      this.lastUsed = new Date();
      return;
    }

    try {
      // Dynamic import playwright to avoid bundling issues
      if (!chromium) {
        const playwright = await import('playwright');
        chromium = playwright.chromium;
        firefox = playwright.firefox;
        webkit = playwright.webkit;
      }

      this.logger.debug('Initializing Playwright browser', {
        browserType: this.config.browserType,
        headless: this.config.headless,
      });

      // Launch browser based on type
      const browserLauncher = {
        chromium,
        firefox,
        webkit,
      }[this.config.browserType];

      this.browser = await browserLauncher.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--allow-running-insecure-content',
        ],
        ...this.config.launchOptions,
      });

      // Create browser context with Korean locale settings
      this.context = await this.browser.newContext({
        locale: this.config.locale,
        userAgent: this.config.userAgent,
        viewport: this.config.viewport,
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: {
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      this.lastUsed = new Date();
      this.logger.info('Playwright browser initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Playwright browser', { error });
      throw error;
    }
  }

  /**
   * Setup auto-cleanup timer
   */
  private setupAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      const idleTime = Date.now() - this.lastUsed.getTime();
      const fiveMinutes = 5 * 60 * 1000;

      if (idleTime > fiveMinutes && this.browser) {
        this.logger.debug('Auto-cleaning up idle Playwright browser');
        await this.cleanup();
      }
    }, 60000); // Check every minute
  }

  /**
   * Detect if a page contains dynamic content that requires JavaScript execution
   */
  async detectDynamicContent(
    url: string,
    initialHtml?: string
  ): Promise<DynamicContentIndicators> {
    const indicators: DynamicContentIndicators = {};

    if (initialHtml) {
      // Check for framework indicators in HTML
      indicators.hasReact = /react|ReactDOM/i.test(initialHtml);
      indicators.hasVue = /vue\.js|Vue\(/i.test(initialHtml);
      indicators.hasAngular = /angular|ng-/i.test(initialHtml);

      // Check for lazy loading indicators
      indicators.hasLazyLoading =
        /data-src|loading=["']lazy["']|IntersectionObserver/i.test(initialHtml);

      // Check for infinite scroll indicators
      indicators.hasInfiniteScroll =
        /infinite.?scroll|load.?more|pagination|next.?page/i.test(initialHtml);

      // Check for GDPR/Cookie popups
      indicators.hasGdprPopup =
        /gdpr|cookie.?consent|privacy.?policy|accept.?cookies/i.test(
          initialHtml
        );

      // Check for minimal content (likely client-side rendered)
      indicators.clientSideRendering =
        initialHtml.length < 1000 ||
        !/<article|<main|<div.*content/i.test(initialHtml);
    }

    // For more accurate detection, briefly load the page
    try {
      await this.ensureInitialized();
      const page = await this.context!.newPage();

      // Set shorter timeout for detection
      page.setDefaultTimeout(10000);

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Wait a brief moment for initial JS execution
      await page.waitForTimeout(2000);

      // Check for dynamic content indicators
      const jsIndicators = await page.evaluate(() => {
        return {
          hasReact:
            !!(window as any).React ||
            !!document.querySelector('[data-reactroot]'),
          hasVue:
            !!(window as any).Vue || !!document.querySelector('[data-v-]'),
          hasAngular:
            !!(window as any).angular || !!document.querySelector('[ng-]'),
          hasLazyLoading: !!document.querySelector(
            'img[data-src], img[loading="lazy"]'
          ),
          hasInfiniteScroll: !!document.querySelector(
            '.infinite-scroll, [data-infinite], .load-more'
          ),
          hasGdprPopup: !!document.querySelector(
            '[class*="cookie"], [class*="gdpr"], [class*="consent"]'
          ),
        };
      });

      Object.assign(indicators, jsIndicators);

      await page.close();
    } catch (error) {
      this.logger.debug('Dynamic content detection failed, assuming static', {
        url,
        error,
      });
    }

    this.logger.debug('Dynamic content detection results', { url, indicators });
    return indicators;
  }

  /**
   * Handle cookie consent and privacy popups
   */
  async handleCookieConsent(page: Page): Promise<void> {
    const commonSelectors = [
      // Common cookie consent button selectors
      'button[id*="accept"], button[class*="accept"]',
      'button[id*="cookie"], button[class*="cookie"]',
      'button[id*="consent"], button[class*="consent"]',
      '.cookie-accept, .accept-cookies, .consent-accept',
      '[aria-label*="accept" i], [aria-label*="동의" i]',
      'button:has-text("Accept"), button:has-text("동의"), button:has-text("확인")',
      '.gdpr-accept, .privacy-accept, .cookie-banner button',
    ];

    for (const selector of commonSelectors) {
      try {
        const button = await page.$(selector);
        if (button && (await button.isVisible())) {
          this.logger.debug('Found cookie consent button', { selector });
          await button.click();
          await page.waitForTimeout(1000); // Wait for popup to disappear
          break;
        }
      } catch (error) {
        this.logger.debug('Cookie consent handler failed for selector', {
          selector,
          error,
        });
      }
    }
  }

  /**
   * Scroll page and wait for content to load (infinite scroll handling)
   */
  async scrollAndWait(page: Page, options: ScrollOptions = {}): Promise<void> {
    const {
      maxScrolls = 5,
      scrollDelay = 2000,
      stabilizationTime = 3000,
      stopCondition,
    } = options;

    let scrollCount = 0;
    let lastHeight = 0;
    let stableCount = 0;

    this.logger.debug('Starting infinite scroll handling', {
      maxScrolls,
      scrollDelay,
    });

    while (scrollCount < maxScrolls) {
      // Check stop condition if provided
      if (stopCondition && (await stopCondition())) {
        this.logger.debug('Stop condition met, ending scroll');
        break;
      }

      // Get current page height
      const currentHeight = await page.evaluate(
        () => document.body.scrollHeight
      );

      // Scroll to bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for content to load
      await page.waitForTimeout(scrollDelay);

      // Check if height changed (new content loaded)
      if (currentHeight === lastHeight) {
        stableCount++;
        if (stableCount >= 2) {
          this.logger.debug('No new content detected, ending scroll');
          break;
        }
      } else {
        stableCount = 0;
      }

      lastHeight = currentHeight;
      scrollCount++;

      this.logger.debug('Scroll iteration completed', {
        scrollCount,
        currentHeight,
        heightChange: currentHeight - lastHeight,
      });
    }

    // Wait for stabilization
    await page.waitForTimeout(stabilizationTime);

    this.logger.debug('Scroll and wait completed', {
      totalScrolls: scrollCount,
      finalHeight: lastHeight,
    });
  }

  /**
   * Render page with JavaScript execution and return final HTML
   */
  async renderPage(
    url: string,
    options: {
      waitForSelector?: string;
      scrollForContent?: boolean;
      scrollOptions?: ScrollOptions;
      timeout?: number;
    } = {}
  ): Promise<string> {
    await this.ensureInitialized();
    const page = await this.context!.newPage();

    try {
      const timeout = options.timeout || this.config.timeout;
      page.setDefaultTimeout(timeout);

      this.logger.debug('Rendering page with Playwright', { url, options });

      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout,
      });

      // Handle cookie consent
      await this.handleCookieConsent(page);

      // Wait for specific selector if provided
      if (options.waitForSelector) {
        try {
          await page.waitForSelector(options.waitForSelector, {
            timeout: 10000,
          });
        } catch (error) {
          this.logger.debug('Selector wait failed, continuing', {
            selector: options.waitForSelector,
            error,
          });
        }
      }

      // Handle infinite scroll if requested
      if (options.scrollForContent) {
        await this.scrollAndWait(page, options.scrollOptions);
      }

      // Get final HTML after JavaScript execution
      const html = await page.content();

      this.logger.debug('Page rendered successfully', {
        url,
        htmlLength: html.length,
      });

      return html;
    } catch (error) {
      this.logger.error('Failed to render page', { url, error });
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Take screenshot for debugging purposes
   */
  async screenshot(url: string, path: string): Promise<void> {
    await this.ensureInitialized();
    const page = await this.context!.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await this.handleCookieConsent(page);
      await page.screenshot({ path, fullPage: true });

      this.logger.debug('Screenshot taken', { url, path });
    } catch (error) {
      this.logger.error('Failed to take screenshot', { url, path, error });
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Execute custom JavaScript in page context
   */
  async evaluateInPage<T>(
    url: string,
    script: string | ((page: Page) => Promise<T>)
  ): Promise<T> {
    await this.ensureInitialized();
    const page = await this.context!.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await this.handleCookieConsent(page);

      let result: T;
      if (typeof script === 'string') {
        result = await page.evaluate(script);
      } else {
        result = await script(page);
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to evaluate script in page', { url, error });
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Check if browser is still alive
   */
  isActive(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  /**
   * Clean up browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = undefined;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.logger.debug('Playwright adapter cleaned up successfully');
    } catch (error) {
      this.logger.error('Error during Playwright cleanup', { error });
    }
  }
}

/**
 * PlaywrightAdapter test suite
 */

import { PlaywrightAdapter, PlaywrightConfig } from './PlaywrightAdapter';
import * as winston from 'winston';

// Use fake timers for tests
jest.useFakeTimers();

// Mock playwright to avoid actual browser launches during tests
jest.mock('playwright', () => {
  const createMockPage = () => ({
    goto: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn().mockResolvedValue(undefined),
    content: jest
      .fn()
      .mockResolvedValue('<html><body>Test content</body></html>'),
    screenshot: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    setDefaultTimeout: jest.fn(),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    $: jest.fn().mockResolvedValue(null),
  });

  const createMockContext = () => {
    const mockPage = createMockPage();
    return {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
      _mockPage: mockPage, // Store reference for testing
    };
  };

  const createMockBrowser = () => {
    const mockContext = createMockContext();
    return {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      _mockContext: mockContext, // Store reference for testing
    };
  };

  const mockBrowser = createMockBrowser();

  return {
    chromium: {
      launch: jest.fn().mockResolvedValue(mockBrowser),
      _mockBrowser: mockBrowser, // Store reference for testing
    },
    firefox: {
      launch: jest.fn().mockResolvedValue(createMockBrowser()),
    },
    webkit: {
      launch: jest.fn().mockResolvedValue(createMockBrowser()),
    },
  };
});

describe('PlaywrightAdapter', () => {
  let adapter: PlaywrightAdapter;
  let testLogger: winston.Logger;
  let mockConfig: PlaywrightConfig;

  beforeEach(() => {
    testLogger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })],
    });

    mockConfig = {
      browserType: 'chromium',
      headless: true,
      timeout: 10000,
      locale: 'ko-KR',
    };

    adapter = new PlaywrightAdapter(mockConfig, testLogger);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up adapter
    if (adapter) {
      await adapter.cleanup();
    }
    // Clear any pending timers
    jest.clearAllTimers();
  });

  afterAll(() => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create PlaywrightAdapter with default config', () => {
      const defaultAdapter = new PlaywrightAdapter();
      expect(defaultAdapter).toBeInstanceOf(PlaywrightAdapter);
    });

    it('should merge provided config with defaults', () => {
      const customConfig = { timeout: 5000 };
      const customAdapter = new PlaywrightAdapter(customConfig, testLogger);
      expect(customAdapter).toBeInstanceOf(PlaywrightAdapter);
    });

    it('should set up auto cleanup timer', () => {
      expect(adapter).toBeInstanceOf(PlaywrightAdapter);
    });
  });

  describe('Dynamic Content Detection', () => {
    it('should detect React indicators from HTML', async () => {
      const htmlWithReact =
        '<div data-reactroot=""><script>window.React = {}</script></div>';
      const indicators = await adapter.detectDynamicContent(
        'https://example.com',
        htmlWithReact
      );

      expect(indicators.hasReact).toBe(true);
    });

    it('should detect Vue indicators from HTML', async () => {
      const htmlWithVue =
        '<div data-v-12345><script src="vue.js"></script></div>';
      const indicators = await adapter.detectDynamicContent(
        'https://example.com',
        htmlWithVue
      );

      expect(indicators.hasVue).toBe(true);
    });

    it('should detect lazy loading indicators', async () => {
      const htmlWithLazyLoading = '<img data-src="image.jpg" loading="lazy">';
      const indicators = await adapter.detectDynamicContent(
        'https://example.com',
        htmlWithLazyLoading
      );

      expect(indicators.hasLazyLoading).toBe(true);
    });

    it('should detect infinite scroll indicators', async () => {
      const htmlWithInfiniteScroll = '<div class="load-more">Load More</div>';
      const indicators = await adapter.detectDynamicContent(
        'https://example.com',
        htmlWithInfiniteScroll
      );

      expect(indicators.hasInfiniteScroll).toBe(true);
    });

    it('should detect GDPR popup indicators', async () => {
      const htmlWithGdpr = '<div class="cookie-consent">Accept cookies</div>';
      const indicators = await adapter.detectDynamicContent(
        'https://example.com',
        htmlWithGdpr
      );

      expect(indicators.hasGdprPopup).toBe(true);
    });

    it('should detect client-side rendering based on content length', async () => {
      const minimalHtml = '<html><body></body></html>';
      const indicators = await adapter.detectDynamicContent(
        'https://example.com',
        minimalHtml
      );

      expect(indicators.clientSideRendering).toBe(true);
    });

    it('should handle detection without initial HTML', async () => {
      const indicators = await adapter.detectDynamicContent(
        'https://example.com'
      );
      expect(indicators).toBeDefined();
    });
  });

  describe('Page Rendering', () => {
    it('should render page and return HTML', async () => {
      const html = await adapter.renderPage('https://example.com');

      expect(html).toBe('<html><body>Test content</body></html>');
    });

    it('should handle rendering options', async () => {
      const options = {
        waitForSelector: '.content',
        scrollForContent: true,
        timeout: 15000,
      };

      const html = await adapter.renderPage('https://example.com', options);
      expect(html).toBe('<html><body>Test content</body></html>');
    });

    it('should handle rendering errors gracefully', async () => {
      const chromium = require('playwright').chromium;
      const mockBrowser = chromium._mockBrowser;
      const mockContext = mockBrowser._mockContext;
      const mockPage = mockContext._mockPage;

      // Override the goto mock for this test
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

      await expect(
        adapter.renderPage('https://invalid-url.com')
      ).rejects.toThrow('Navigation failed');
    });
  });

  describe('Cookie Consent Handling', () => {
    it('should attempt to handle cookie consent popups', async () => {
      const chromium = require('playwright').chromium;
      const mockBrowser = chromium._mockBrowser;
      const mockContext = mockBrowser._mockContext;
      const mockPage = mockContext._mockPage;

      const mockButton = {
        isVisible: jest.fn().mockResolvedValue(true),
        click: jest.fn().mockResolvedValue(undefined),
      };

      mockPage.$.mockResolvedValue(mockButton);

      await adapter['handleCookieConsent'](mockPage);

      expect(mockPage.$).toHaveBeenCalled();
    });
  });

  describe('Scroll and Wait Functionality', () => {
    it('should handle infinite scroll with default options', async () => {
      const chromium = require('playwright').chromium;
      const mockBrowser = chromium._mockBrowser;
      const mockContext = mockBrowser._mockContext;
      const mockPage = mockContext._mockPage;

      // Mock height changes to simulate content loading
      let scrollHeight = 1000;
      mockPage.evaluate.mockImplementation((fn: any) => {
        if (fn.toString().includes('scrollHeight')) {
          return scrollHeight;
        }
        if (fn.toString().includes('scrollTo')) {
          scrollHeight += 500; // Simulate new content
          return undefined;
        }
        return undefined;
      });

      await adapter['scrollAndWait'](mockPage);

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockPage.waitForTimeout).toHaveBeenCalled();
    });

    it('should respect stop condition', async () => {
      const chromium = require('playwright').chromium;
      const mockBrowser = chromium._mockBrowser;
      const mockContext = mockBrowser._mockContext;
      const mockPage = mockContext._mockPage;

      mockPage.evaluate.mockResolvedValue(1000);

      const stopCondition = jest.fn().mockResolvedValue(true);

      await adapter['scrollAndWait'](mockPage, { stopCondition });

      expect(stopCondition).toHaveBeenCalled();
    });

    it('should stop scrolling when no new content is detected', async () => {
      const chromium = require('playwright').chromium;
      const mockBrowser = chromium._mockBrowser;
      const mockContext = mockBrowser._mockContext;
      const mockPage = mockContext._mockPage;

      // Mock consistent height (no new content)
      mockPage.evaluate.mockResolvedValue(1000);

      await adapter['scrollAndWait'](mockPage, { maxScrolls: 10 });

      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('Screenshot Functionality', () => {
    it('should take screenshot', async () => {
      const chromium = require('playwright').chromium;
      const mockBrowser = chromium._mockBrowser;
      const mockContext = mockBrowser._mockContext;
      const mockPage = mockContext._mockPage;

      // Reset screenshot mock and set up for this test
      mockPage.screenshot.mockClear();
      mockPage.screenshot.mockResolvedValueOnce(undefined);

      await adapter.screenshot('https://example.com', '/tmp/screenshot.png');

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: '/tmp/screenshot.png',
        fullPage: true,
      });
    });
  });

  describe('Custom JavaScript Evaluation', () => {
    it('should evaluate string script', async () => {
      const chromium = require('playwright').chromium;
      const mockBrowser = chromium._mockBrowser;
      const mockContext = mockBrowser._mockContext;
      const mockPage = mockContext._mockPage;

      mockPage.evaluate.mockResolvedValue('Test Title');

      const result = await adapter.evaluateInPage(
        'https://example.com',
        'document.title'
      );
      expect(result).toBe('Test Title');
    });

    it('should evaluate function script', async () => {
      const chromium = require('playwright').chromium;
      const mockBrowser = chromium._mockBrowser;
      const mockContext = mockBrowser._mockContext;
      const mockPage = mockContext._mockPage;

      mockPage.evaluate.mockResolvedValue('Test Title');

      const script = async (page: any) => {
        return await page.evaluate(() => document.title);
      };

      const result = await adapter.evaluateInPage(
        'https://example.com',
        script
      );
      expect(result).toBe('Test Title');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should check if browser is active', () => {
      const isActive = adapter.isActive();
      expect(typeof isActive).toBe('boolean');
    });

    it('should cleanup resources properly', async () => {
      await adapter.cleanup();
      // Cleanup should complete without errors
    });

    it('should handle cleanup errors gracefully', async () => {
      const chromium = require('playwright').chromium;
      const mockBrowser = await chromium.launch();
      const mockContext = await mockBrowser.newContext();

      // Mock cleanup error
      mockContext.close.mockRejectedValue(new Error('Cleanup error'));

      // Should not throw
      await expect(adapter.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Browser Type Configuration', () => {
    it('should support different browser types', () => {
      const firefoxAdapter = new PlaywrightAdapter(
        { browserType: 'firefox' },
        testLogger
      );
      const webkitAdapter = new PlaywrightAdapter(
        { browserType: 'webkit' },
        testLogger
      );

      expect(firefoxAdapter).toBeInstanceOf(PlaywrightAdapter);
      expect(webkitAdapter).toBeInstanceOf(PlaywrightAdapter);
    });
  });

  describe('Error Handling', () => {
    it('should handle browser launch failures', async () => {
      const chromium = require('playwright').chromium;
      chromium.launch.mockRejectedValueOnce(new Error('Browser launch failed'));

      await expect(adapter.renderPage('https://example.com')).rejects.toThrow();
    });

    it('should handle page creation failures', async () => {
      const chromium = require('playwright').chromium;
      const mockBrowser = chromium._mockBrowser;
      const mockContext = mockBrowser._mockContext;

      mockContext.newPage.mockRejectedValueOnce(
        new Error('Page creation failed')
      );

      await expect(adapter.renderPage('https://example.com')).rejects.toThrow();
    });
  });
});

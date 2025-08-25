#!/usr/bin/env node
/**
 * Korean news site crawling test script
 * Tests actual crawling of Naver News and Yonhap News
 */

import { NaverNewsCrawler } from '../../libs/crawler-core/src/crawlers/NaverNewsCrawler';
import { NewsCrawler } from '../../libs/crawler-core/src/crawlers/NewsCrawler';
import { JobScheduler } from '../../libs/crawler-core/src/queue/scheduler/JobScheduler';
import {
  ScheduledJobConfig,
  CRON_PRESETS,
} from '../../libs/crawler-core/src/queue/scheduler/SchedulerInterface';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import * as winston from 'winston';

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta) : ''
      }`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'crawl-test.log' }),
  ],
});

// Test configuration
const TEST_CONFIG = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD || '',
  },
  rateLimit: {
    delay: 1000, // 1 second between requests
  },
  maxArticles: 5, // Limit articles for testing
};

// Test sites configuration
const TEST_SITES = [
  {
    id: 'naver-news-test',
    name: 'Naver News Test',
    url: 'https://news.naver.com',
    type: 'naver',
    cronExpression: CRON_PRESETS.EVERY_6_HOURS,
  },
  {
    id: 'yonhap-news-test',
    name: 'Yonhap News Test',
    url: 'https://www.yna.co.kr',
    type: 'generic',
    cronExpression: CRON_PRESETS.EVERY_12_HOURS,
  },
];

/**
 * Test result interface
 */
interface TestResult {
  siteId: string;
  siteName: string;
  success: boolean;
  articlesFound: number;
  articlesParsed: number;
  errors: string[];
  performance: {
    totalTime: number;
    avgTimePerArticle: number;
  };
  sample?: {
    title: string;
    author?: string;
    publishedAt: Date;
    bodyLength: number;
  };
}

/**
 * Test crawler for a specific site
 */
interface SiteConfig {
  id: string;
  name: string;
  url: string;
  type: string;
  cronExpression: string;
}

async function testCrawler(siteConfig: SiteConfig): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    siteId: siteConfig.id,
    siteName: siteConfig.name,
    success: false,
    articlesFound: 0,
    articlesParsed: 0,
    errors: [],
    performance: {
      totalTime: 0,
      avgTimePerArticle: 0,
    },
  };

  try {
    logger.info(`Starting crawl test for ${siteConfig.name}`, {
      url: siteConfig.url,
    });

    // Select appropriate crawler
    const crawler =
      siteConfig.type === 'naver'
        ? new NaverNewsCrawler(siteConfig.url, logger)
        : new NewsCrawler(siteConfig.url, logger);

    // Fetch main page
    logger.info('Fetching main page...');
    const html = await crawler['fetchPage'](siteConfig.url);

    if (!html) {
      throw new Error('Failed to fetch main page');
    }

    // Extract article links
    logger.info('Extracting article links...');
    const articleLinks = await extractArticleLinks(html, siteConfig.type);
    result.articlesFound = articleLinks.length;

    logger.info(`Found ${articleLinks.length} articles`);

    // Test parsing individual articles (limited)
    const articlesToTest = articleLinks.slice(0, TEST_CONFIG.maxArticles);

    for (const link of articlesToTest) {
      try {
        // Rate limiting
        await delay(TEST_CONFIG.rateLimit.delay);

        logger.info(`Crawling article: ${link}`);
        const articleHtml = await crawler['fetchPage'](link);

        if (articleHtml) {
          const parsed = await crawler.parseContent(articleHtml);

          if (parsed.title && parsed.body) {
            result.articlesParsed++;

            // Store sample from first successful parse
            if (!result.sample) {
              result.sample = {
                title: parsed.title,
                author: parsed.author,
                publishedAt: parsed.publishedAt,
                bodyLength: parsed.body.length,
              };
            }

            logger.info('Successfully parsed article', {
              title: parsed.title.substring(0, 50),
              bodyLength: parsed.body.length,
            });
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorMsg = `Failed to parse article ${link}: ${errorMessage}`;
        logger.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    // Calculate performance metrics
    const totalTime = Date.now() - startTime;
    result.performance.totalTime = totalTime;
    result.performance.avgTimePerArticle =
      result.articlesParsed > 0 ? totalTime / result.articlesParsed : 0;

    result.success = result.articlesParsed > 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorMsg = `Crawler test failed: ${errorMessage}`;
    logger.error(errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Extract article links from HTML
 */
async function extractArticleLinks(
  html: string,
  siteType: string
): Promise<string[]> {
  const links: string[] = [];

  // Simple regex-based link extraction (in production, use proper HTML parser)
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];

    // Filter for article-like URLs
    if (siteType === 'naver') {
      if (
        url.includes('/article/') ||
        url.includes('news.naver.com/main/read')
      ) {
        // Convert relative to absolute URL
        const absoluteUrl = url.startsWith('http')
          ? url
          : `https://news.naver.com${url}`;
        links.push(absoluteUrl);
      }
    } else {
      if (url.includes('/AKR') || url.includes('/article/')) {
        const absoluteUrl = url.startsWith('http')
          ? url
          : `https://www.yna.co.kr${url}`;
        links.push(absoluteUrl);
      }
    }
  }

  // Remove duplicates
  return [...new Set(links)];
}

/**
 * Test scheduled job creation
 */
async function testScheduler(queue: Queue): Promise<void> {
  logger.info('Testing job scheduler...');

  const scheduler = new JobScheduler(queue, logger);

  for (const site of TEST_SITES) {
    try {
      const config: ScheduledJobConfig = {
        id: site.id,
        name: site.name,
        cronExpression: site.cronExpression,
        timezone: 'Asia/Seoul',
        data: {
          sourceId: site.id,
          source: {
            url: site.url,
            type: 'NEWS' as const,
            name: site.name,
          },
        },
        metadata: {
          crawlerType: site.type,
        },
      };

      const scheduled = await scheduler.addScheduledJob(config);
      logger.info(`Scheduled job created: ${scheduled.name}`, {
        nextRunTime: scheduled.nextRunTime,
        cronExpression: scheduled.cronExpression,
      });

      // Get next 5 run times
      const nextRuns = await scheduler.getNextRunTime(site.id, 5);
      logger.info(`Next run times for ${site.name}:`, {
        times: nextRuns.occurrences.map((d) => d.toISOString()),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Failed to schedule ${site.name}:`, errorMessage);
    }
  }

  // List all scheduled jobs
  const allJobs = await scheduler.getScheduledJobs();
  logger.info(`Total scheduled jobs: ${allJobs.length}`);
}

/**
 * Generate test report
 */
function generateReport(results: TestResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('CRAWL TEST REPORT');
  console.log('='.repeat(80));

  const totalArticles = results.reduce((sum, r) => sum + r.articlesFound, 0);
  const totalParsed = results.reduce((sum, r) => sum + r.articlesParsed, 0);
  const successRate =
    totalArticles > 0 ? ((totalParsed / totalArticles) * 100).toFixed(1) : '0';

  console.log(`\nOVERALL STATISTICS:`);
  console.log(`  Total sites tested: ${results.length}`);
  console.log(`  Successful sites: ${results.filter((r) => r.success).length}`);
  console.log(`  Total articles found: ${totalArticles}`);
  console.log(`  Total articles parsed: ${totalParsed}`);
  console.log(`  Overall success rate: ${successRate}%`);

  console.log(`\nSITE DETAILS:`);
  for (const result of results) {
    console.log(`\n  ${result.siteName}:`);
    console.log(`    Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`    Articles found: ${result.articlesFound}`);
    console.log(`    Articles parsed: ${result.articlesParsed}`);
    console.log(
      `    Parse rate: ${
        result.articlesFound > 0
          ? ((result.articlesParsed / result.articlesFound) * 100).toFixed(1)
          : '0'
      }%`
    );
    console.log(
      `    Total time: ${(result.performance.totalTime / 1000).toFixed(2)}s`
    );
    console.log(
      `    Avg time/article: ${(
        result.performance.avgTimePerArticle / 1000
      ).toFixed(2)}s`
    );

    if (result.sample) {
      console.log(`    Sample article:`);
      console.log(`      Title: ${result.sample.title.substring(0, 60)}...`);
      console.log(`      Author: ${result.sample.author || 'N/A'}`);
      console.log(
        `      Published: ${result.sample.publishedAt.toISOString()}`
      );
      console.log(`      Body length: ${result.sample.bodyLength} chars`);
    }

    if (result.errors.length > 0) {
      console.log(`    Errors: ${result.errors.length}`);
      result.errors.slice(0, 3).forEach((err) => {
        console.log(`      - ${err.substring(0, 80)}...`);
      });
    }
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main test execution
 */
async function main(): Promise<void> {
  logger.info('Korean News Crawling Test Started');
  logger.info('Configuration:', TEST_CONFIG);

  // Initialize Redis connection
  const redis = new Redis(TEST_CONFIG.redis);

  // Create queue for scheduler test
  const queue = new Queue('test-crawl-queue', {
    connection: redis.duplicate(),
  });

  try {
    // Test individual crawlers
    const results: TestResult[] = [];

    for (const site of TEST_SITES) {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`Testing: ${site.name}`);
      logger.info('='.repeat(60));

      const result = await testCrawler(site);
      results.push(result);

      // Delay between sites
      await delay(2000);
    }

    // Test scheduler
    logger.info(`\n${'='.repeat(60)}`);
    logger.info('Testing Scheduler');
    logger.info('='.repeat(60));
    await testScheduler(queue);

    // Generate report
    generateReport(results);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Test execution failed:', errorMessage);
  } finally {
    // Cleanup
    await queue.close();
    redis.disconnect();
  }

  logger.info('Test completed');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as runCrawlTest, TestResult };

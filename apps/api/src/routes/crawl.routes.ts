/**
 * Crawl test routes for development
 */

import { Router } from 'express';
import { queueService } from '../services/queue.service';
import type { CrawlJobData } from '@lighthouse/crawler-core';

const router = Router();

/**
 * Test crawl endpoint - crawl a sample news site
 */
router.post('/test', async (_req, res, next) => {
  try {
    // Sample Korean news site for testing
    const testJobData: CrawlJobData = {
      sourceId: `test-${Date.now()}`,
      source: {
        id: 'test-news',
        name: 'Test News Site',
        url: 'https://www.yna.co.kr', // 연합뉴스
        type: 'NEWS',
        config: {
          selector: {
            title: 'h1.tit-article',
            content: 'div.article-txt',
            author: 'span.writer',
            publishedAt: 'span.date',
          },
          rateLimit: {
            requests: 2,
            period: 1000,
          },
        },
      },
      priority: 5,
      attempts: 3,
    };

    const job = await queueService.addCrawlJob(testJobData);

    res.status(201).json({
      status: 'success',
      message: 'Test crawl job created',
      data: {
        jobId: job.id,
        jobName: job.name,
        sourceUrl: testJobData.source.url,
        checkStatus: `/api/queue/crawl/jobs/${job.id}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Test batch crawl - crawl multiple URLs
 */
router.post('/test-batch', async (req, res, next) => {
  try {
    const { urls = [] } = req.body;

    if (!urls.length) {
      // Default test URLs
      urls.push(
        'https://www.yna.co.kr',
        'https://www.hani.co.kr',
        'https://www.chosun.com'
      );
    }

    const jobs = [];

    for (const url of urls) {
      const jobData: CrawlJobData = {
        sourceId: `batch-${Date.now()}-${Math.random()}`,
        source: {
          id: `test-${url}`,
          name: `Test - ${new URL(url).hostname}`,
          url,
          type: 'NEWS',
          config: {
            rateLimit: {
              requests: 1,
              period: 2000,
            },
          },
        },
        priority: 5,
        attempts: 2,
      };

      const job = await queueService.addCrawlJob(jobData);
      jobs.push({
        jobId: job.id,
        url,
        status: 'queued',
      });
    }

    res.status(201).json({
      status: 'success',
      message: `${jobs.length} crawl jobs created`,
      data: {
        jobs,
        monitorUrl: '/api/queue/crawl/jobs',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Test Naver News crawler
 */
router.post('/naver', async (req, res, next): Promise<any> => {
  try {
    const { url, mode = 'article' } = req.body;

    // Default to a sample Naver News article if no URL provided
    const targetUrl =
      url || 'https://news.naver.com/main/main.naver?mode=LSD&mid=shm&sid1=100'; // Politics section

    // Create job data for Naver News crawler
    const naverJobData: CrawlJobData = {
      sourceId: `naver-${Date.now()}`,
      source: {
        id: 'naver-news',
        name: 'Naver News',
        url: targetUrl,
        type: 'NEWS',
        config: {
          crawlerType: 'naver',
          mode, // 'article' for single article, 'section' for section discovery
          selector: {
            title: '#title_area span',
            content: '#dic_area',
            author: '.byline_s .name',
            publishedAt: '.byline .date_time',
          },
          rateLimit: {
            requests: 3,
            period: 3000,
          },
        },
      },
      priority: 7, // Higher priority for Korean news
      attempts: 2,
    };

    const job = await queueService.addCrawlJob(naverJobData);

    res.status(201).json({
      status: 'success',
      message: 'Naver News crawl job created',
      data: {
        jobId: job.id,
        jobName: job.name,
        sourceUrl: targetUrl,
        mode,
        crawlerType: 'naver',
        checkStatus: `/api/crawl/jobs/${job.id}`,
        monitorUrl: '/api/queue/crawl/jobs',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Test Naver News section discovery
 */
router.post('/naver/section', async (req, res, next): Promise<any> => {
  try {
    const { section = 'politics', maxPages = 3 } = req.body;

    // Get section URL
    const sectionUrls: Record<string, string> = {
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
    };

    const sectionUrl = sectionUrls[section];
    if (!sectionUrl) {
      return res.status(400).json({
        status: 'error',
        message:
          'Invalid section. Available sections: ' +
          Object.keys(sectionUrls).join(', '),
      });
    }

    const sectionJobData: CrawlJobData = {
      sourceId: `naver-section-${section}-${Date.now()}`,
      source: {
        id: `naver-${section}`,
        name: `Naver News - ${section.toUpperCase()}`,
        url: sectionUrl,
        type: 'NEWS',
        config: {
          crawlerType: 'naver',
          mode: 'section',
          maxPages,
          section,
          selector: {
            title: '#title_area span',
            content: '#dic_area',
            author: '.byline_s .name',
            publishedAt: '.byline .date_time',
          },
          rateLimit: {
            requests: 2,
            period: 4000, // Slower for section discovery
          },
        },
      },
      priority: 6,
      attempts: 2,
    };

    const job = await queueService.addCrawlJob(sectionJobData);

    res.status(201).json({
      status: 'success',
      message: `Naver News ${section} section crawl job created`,
      data: {
        jobId: job.id,
        jobName: job.name,
        section,
        sourceUrl: sectionUrl,
        maxPages,
        crawlerType: 'naver',
        checkStatus: `/api/crawl/jobs/${job.id}`,
        monitorUrl: '/api/queue/crawl/jobs',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get crawl job status
 */
router.get('/jobs/:jobId', async (req, res, next): Promise<any> => {
  try {
    const { jobId } = req.params;
    const jobs = await queueService.getJobs('crawl');

    const job = jobs.find((j) => j.id === jobId);

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found',
      });
    }

    return res.json({
      status: 'success',
      data: {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn,
        isCompleted: job.isCompleted?.(),
        isFailed: job.isFailed?.(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

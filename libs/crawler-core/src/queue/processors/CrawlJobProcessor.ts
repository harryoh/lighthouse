/**
 * Processor for crawl jobs
 */

import { Job } from 'bullmq';
import { CrawlJobData, CrawlJobResult } from '../QueueInterface';
import { CrawlerFactory } from '../../crawlers/CrawlerFactory';
import * as winston from 'winston';

/**
 * Create a crawl job processor
 */
export function createCrawlJobProcessor(
  logger?: winston.Logger
): (job: Job<CrawlJobData, CrawlJobResult>) => Promise<CrawlJobResult> {
  const processorLogger = logger || createDefaultLogger();

  return async (
    job: Job<CrawlJobData, CrawlJobResult>
  ): Promise<CrawlJobResult> => {
    processorLogger.info(`Processing crawl job ${job.id}`, {
      sourceId: job.data.sourceId,
      url: job.data.source.url,
    });

    try {
      // Update job progress
      await job.updateProgress(10);

      // Create appropriate crawler based on source type
      const crawler = CrawlerFactory.createCrawler(job.data.source);

      // Update progress
      await job.updateProgress(30);

      // Perform the crawl
      const result = await crawler.crawl();

      // Update progress
      await job.updateProgress(90);

      // Return the result
      const crawlResult: CrawlJobResult = {
        ...result,
        sourceId: job.data.sourceId,
        processedAt: new Date(),
      };

      processorLogger.info(`Crawl job ${job.id} completed successfully`, {
        sourceId: job.data.sourceId,
        itemsExtracted: result.contents?.length || 0,
      });

      await job.updateProgress(100);
      return crawlResult;
    } catch (error) {
      processorLogger.error(`Crawl job ${job.id} failed`, {
        sourceId: job.data.sourceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };
}

/**
 * Create default logger
 */
function createDefaultLogger(): winston.Logger {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    defaultMeta: { service: 'CrawlJobProcessor' },
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

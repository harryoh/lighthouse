/**
 * Processor for scheduled jobs
 */

import { Job } from 'bullmq';
import { ScheduledCrawlJobData, CrawlJobResult } from '../QueueInterface';
import { CrawlerFactory } from '../../crawlers/CrawlerFactory';
import * as winston from 'winston';

/**
 * Create a scheduled job processor
 */
export function createScheduledJobProcessor(
  logger?: winston.Logger
): (
  job: Job<ScheduledCrawlJobData, CrawlJobResult>
) => Promise<CrawlJobResult> {
  const processorLogger = logger || createDefaultLogger();

  return async (
    job: Job<ScheduledCrawlJobData, CrawlJobResult>
  ): Promise<CrawlJobResult> => {
    processorLogger.info(`Processing scheduled job ${job.id}`, {
      sourceId: job.data.sourceId,
      url: job.data.source.url,
      schedule: job.data.schedule,
    });

    try {
      // Update job progress
      await job.updateProgress(10);

      // Check if the scheduled job is active
      if (job.data.isActive === false) {
        processorLogger.warn(`Scheduled job ${job.id} is inactive, skipping`, {
          sourceId: job.data.sourceId,
        });
        return {
          success: false,
          contents: [],
          stats: {
            totalPages: 0,
            successCount: 0,
            failureCount: 0,
            duration: 0,
          },
          error: new Error('Scheduled job is inactive'),
          sourceId: job.data.sourceId,
          processedAt: new Date(),
        } as CrawlJobResult;
      }

      // Create appropriate crawler based on source type
      const crawler = CrawlerFactory.createCrawler(job.data.source);

      // Update progress
      await job.updateProgress(30);

      // Perform the crawl
      const result = await crawler.crawl();

      // Update progress
      await job.updateProgress(70);

      // Record execution time
      const now = new Date();
      job.data.lastRunAt = now;

      // Calculate next run time (this would be handled by BullMQ's repeat mechanism)
      // but we can store it for reference

      // Update progress
      await job.updateProgress(90);

      // Return the result
      const crawlResult: CrawlJobResult = {
        ...result,
        sourceId: job.data.sourceId,
        processedAt: now,
      };

      processorLogger.info(`Scheduled job ${job.id} completed successfully`, {
        sourceId: job.data.sourceId,
        itemsExtracted: result.contents?.length || 0,
        nextRun: job.opts.repeat?.pattern,
      });

      await job.updateProgress(100);
      return crawlResult;
    } catch (error) {
      processorLogger.error(`Scheduled job ${job.id} failed`, {
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
    defaultMeta: { service: 'ScheduledJobProcessor' },
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

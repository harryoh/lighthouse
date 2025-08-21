/**
 * Queue management routes
 */

import { Router } from 'express';
import { queueService } from '../services/queue.service';
import type { CrawlJobData, AnalysisJobData } from '@lighthouse/crawler-core';

const router = Router();

/**
 * Get health status of all queues
 */
router.get('/health', async (_req, res, next) => {
  try {
    const health = await queueService.getAllQueuesHealth();
    res.json({
      status: 'success',
      data: health,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get health status of a specific queue
 */
router.get('/:queueName/health', async (req, res, next) => {
  try {
    const { queueName } = req.params;
    const health = await queueService.getQueueHealth(queueName);
    res.json({
      status: 'success',
      data: health,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get jobs from a specific queue
 */
router.get('/:queueName/jobs', async (req, res, next) => {
  try {
    const { queueName } = req.params;
    const { status, limit = '20' } = req.query;

    const jobs = await queueService.getJobs(
      queueName,
      status as string,
      parseInt(limit as string, 10)
    );

    res.json({
      status: 'success',
      data: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Add a crawl job
 */
router.post('/crawl/jobs', async (req, res, next): Promise<any> => {
  try {
    const jobData: CrawlJobData = req.body;

    // Validate required fields
    if (!jobData.source?.url) {
      return res.status(400).json({
        status: 'error',
        message: 'Source URL is required',
      });
    }

    const job = await queueService.addCrawlJob(jobData);

    res.status(201).json({
      status: 'success',
      data: {
        id: job.id,
        name: job.name,
        data: job.data,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Add an analysis job
 */
router.post('/analysis/jobs', async (req, res, next): Promise<any> => {
  try {
    const jobData: AnalysisJobData = req.body;

    // Validate required fields
    if (!jobData.contentId || !jobData.analysisType) {
      return res.status(400).json({
        status: 'error',
        message: 'Content ID and analysis type are required',
      });
    }

    const job = await queueService.addAnalysisJob(jobData);

    res.status(201).json({
      status: 'success',
      data: {
        id: job.id,
        name: job.name,
        data: job.data,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Retry a failed job
 */
router.post('/:queueName/jobs/:jobId/retry', async (req, res, next) => {
  try {
    const { queueName, jobId } = req.params;
    await queueService.retryJob(queueName, jobId);

    res.json({
      status: 'success',
      message: `Job ${jobId} has been queued for retry`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Remove a job
 */
router.delete('/:queueName/jobs/:jobId', async (req, res, next) => {
  try {
    const { queueName, jobId } = req.params;
    await queueService.removeJob(queueName, jobId);

    res.json({
      status: 'success',
      message: `Job ${jobId} has been removed`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

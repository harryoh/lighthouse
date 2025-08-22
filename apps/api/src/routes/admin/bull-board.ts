/**
 * Bull Board - Queue monitoring dashboard
 */

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { Router } from 'express';

// Create Express adapter for Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Initialize Bull Board with queues
export function initializeBullBoard(): Router {
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  };

  // Create queue instances for monitoring
  const crawlQueue = new Queue('crawl', {
    connection: redisConfig,
  });

  const analysisQueue = new Queue('analysis', {
    connection: redisConfig,
  });

  const scheduledQueue = new Queue('scheduled', {
    connection: redisConfig,
  });

  const deadLetterQueue = new Queue('dead-letter', {
    connection: redisConfig,
  });

  // Create Bull Board
  createBullBoard({
    queues: [
      new BullMQAdapter(crawlQueue, { readOnlyMode: false }),
      new BullMQAdapter(analysisQueue, { readOnlyMode: false }),
      new BullMQAdapter(scheduledQueue, { readOnlyMode: false }),
      new BullMQAdapter(deadLetterQueue, { readOnlyMode: false }),
    ],
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: 'Lighthouse Queue Monitor',
        boardLogo: {
          path: 'https://cdn.jsdelivr.net/npm/lucide-static@0.16.29/icons/activity.svg',
          width: '40px',
          height: '40px',
        },
        miscLinks: [
          {
            text: 'API Docs',
            url: '/api/docs',
          },
          {
            text: 'Health Check',
            url: '/api/health',
          },
        ],
      },
    },
  });

  return serverAdapter.getRouter() as Router;
}

export default serverAdapter;

/**
 * Schedule management API routes
 */

import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import {
  JobScheduler,
  ScheduledJobConfig,
  ScheduleUpdateOptions,
} from '@lighthouse/crawler-core';
import {
  validateScheduleConfig,
  validateScheduleUpdate,
} from '../middleware/validation';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

// Initialize scheduler (in production, this would be injected)
let scheduler: JobScheduler;

/**
 * Initialize the scheduler with the queue
 */
export function initializeScheduler(queue: Queue): void {
  scheduler = new JobScheduler(queue);
}

/**
 * GET /api/schedules
 * Get all scheduled jobs
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { enabled, sortBy, sortOrder, limit, offset } = req.query;

    const schedules = await scheduler.getScheduledJobs({
      enabled:
        enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      sortBy: sortBy as
        | 'name'
        | 'nextRunTime'
        | 'createdAt'
        | 'updatedAt'
        | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: schedules,
      count: schedules.length,
    });
  })
);

/**
 * GET /api/schedules/upcoming
 * Get schedules that will run in the next time window
 */
router.get(
  '/upcoming',
  asyncHandler(async (req: Request, res: Response) => {
    const { hours = 24 } = req.query;
    const hoursNum = parseInt(hours as string);

    const startTime = new Date();
    const endTime = new Date(Date.now() + hoursNum * 60 * 60 * 1000);

    const upcomingSchedules = await scheduler.getUpcomingSchedules(
      startTime,
      endTime
    );

    res.json({
      success: true,
      data: upcomingSchedules,
      timeWindow: {
        start: startTime,
        end: endTime,
        hours: hoursNum,
      },
    });
  })
);

/**
 * GET /api/schedules/:id
 * Get a specific scheduled job
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Schedule ID is required',
      });
    }

    const schedule = await scheduler.getScheduledJob(id);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }

    return res.json({
      success: true,
      data: schedule,
    });
  })
);

/**
 * GET /api/schedules/:id/next-runs
 * Get next run times for a schedule
 */
router.get(
  '/:id/next-runs',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { count = 5 } = req.query;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Schedule ID is required',
      });
    }

    try {
      const nextRuns = await scheduler.getNextRunTime(
        id,
        parseInt(count as string)
      );
      return res.json({
        success: true,
        data: nextRuns,
      });
    } catch (error: any) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * GET /api/schedules/:id/history
 * Get execution history for a schedule
 */
router.get(
  '/:id/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { limit = 10 } = req.query;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Schedule ID is required',
      });
    }

    const history = await scheduler.getExecutionHistory(
      id,
      parseInt(limit as string)
    );

    return res.json({
      success: true,
      data: history,
      count: history.length,
    });
  })
);

/**
 * POST /api/schedules
 * Create a new scheduled job
 */
router.post(
  '/',
  validateScheduleConfig,
  asyncHandler(async (req: Request, res: Response) => {
    const config: ScheduledJobConfig = req.body;

    try {
      const schedule = await scheduler.addScheduledJob(config);
      res.status(201).json({
        success: true,
        data: schedule,
        message: 'Schedule created successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * POST /api/schedules/validate
 * Validate a cron expression
 */
router.post(
  '/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const { cronExpression, timezone } = req.body;

    if (!cronExpression) {
      return res.status(400).json({
        success: false,
        error: 'Cron expression is required',
      });
    }

    const validation = scheduler.validateCronExpression(
      cronExpression,
      timezone
    );

    return res.json({
      success: validation.isValid,
      data: validation,
    });
  })
);

/**
 * POST /api/schedules/:id/trigger
 * Manually trigger a scheduled job
 */
router.post(
  '/:id/trigger',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Schedule ID is required',
      });
    }

    try {
      const jobId = await scheduler.triggerScheduledJob(id);
      return res.json({
        success: true,
        data: {
          scheduleId: id,
          jobId,
          message: 'Schedule triggered successfully',
        },
      });
    } catch (error: any) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * PUT /api/schedules/:id
 * Update a scheduled job
 */
router.put(
  '/:id',
  validateScheduleUpdate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates: ScheduleUpdateOptions = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Schedule ID is required',
      });
    }

    try {
      const schedule = await scheduler.updateSchedule(id, updates);
      return res.json({
        success: true,
        data: schedule,
        message: 'Schedule updated successfully',
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * PATCH /api/schedules/:id/toggle
 * Enable or disable a schedule
 */
router.patch(
  '/:id/toggle',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Enabled field must be a boolean',
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Schedule ID is required',
      });
    }

    const success = await scheduler.toggleSchedule(id, enabled);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }

    return res.json({
      success: true,
      data: {
        scheduleId: id,
        enabled,
        message: `Schedule ${enabled ? 'enabled' : 'disabled'} successfully`,
      },
    });
  })
);

/**
 * DELETE /api/schedules/:id
 * Delete a scheduled job
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Schedule ID is required',
      });
    }

    const success = await scheduler.removeScheduledJob(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }

    return res.json({
      success: true,
      message: 'Schedule deleted successfully',
    });
  })
);

/**
 * DELETE /api/schedules/:id/history
 * Clear execution history for a schedule
 */
router.delete(
  '/:id/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { beforeDate } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Schedule ID is required',
      });
    }

    const clearedCount = await scheduler.clearExecutionHistory(
      id,
      beforeDate ? new Date(beforeDate as string) : undefined
    );

    return res.json({
      success: true,
      data: {
        scheduleId: id,
        clearedCount,
        message: `Cleared ${clearedCount} history entries`,
      },
    });
  })
);

export default router;

import { Request, Response, NextFunction } from 'express';

/**
 * Validate content creation input
 */
export const validateContentInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors: string[] = [];
  const { sourceId, url, title, body, author, publishedAt, rawHtml } = req.body;

  // Required field validation
  if (!sourceId) errors.push('sourceId is required');
  if (!url) errors.push('url is required');
  if (!title) errors.push('title is required');
  if (!body) errors.push('body is required');
  if (!publishedAt) errors.push('publishedAt is required');
  if (!rawHtml) errors.push('rawHtml is required');

  // URL format validation
  if (url) {
    try {
      new URL(url);
    } catch {
      errors.push('Invalid URL format');
    }
  }

  // Date validation
  if (publishedAt) {
    const date = new Date(publishedAt);
    if (isNaN(date.getTime())) {
      errors.push('Invalid publishedAt date format');
    }
  }

  // Length constraints
  if (title && title.length > 500) {
    errors.push('title must be 500 characters or less');
  }
  if (author && author.length > 100) {
    errors.push('author must be 100 characters or less');
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
    return;
  }

  next();
};

/**
 * Validate content update input
 */
export const validateContentUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors: string[] = [];
  const { title, body, author, publishedAt, rawHtml } = req.body;

  // At least one field should be present
  if (!title && !body && !author && publishedAt === undefined && !rawHtml) {
    errors.push('At least one field must be provided for update');
  }

  // Date validation if provided
  if (publishedAt) {
    const date = new Date(publishedAt);
    if (isNaN(date.getTime())) {
      errors.push('Invalid publishedAt date format');
    }
  }

  // Length constraints
  if (title && title.length > 500) {
    errors.push('title must be 500 characters or less');
  }
  if (author && author.length > 100) {
    errors.push('author must be 100 characters or less');
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
    return;
  }

  next();
};

/**
 * Validate UUID format
 */
export const validateUUID = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!value || !uuidRegex.test(value)) {
      res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format. Expected UUID`,
      });
      return;
    }

    next();
  };
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors: string[] = [];
  const { page, limit, sortBy, sortOrder } = req.query;

  if (page) {
    const pageNum = parseInt(page as string);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('page must be a positive integer');
    }
  }

  if (limit) {
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('limit must be between 1 and 100');
    }
  }

  if (
    sortBy &&
    !['publishedAt', 'createdAt', 'title'].includes(sortBy as string)
  ) {
    errors.push('sortBy must be one of: publishedAt, createdAt, title');
  }

  if (sortOrder && !['asc', 'desc'].includes(sortOrder as string)) {
    errors.push('sortOrder must be either asc or desc');
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'Invalid pagination parameters',
      details: errors,
    });
    return;
  }

  next();
};

/**
 * Validate schedule configuration
 */
export const validateScheduleConfig = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors: string[] = [];
  const { id, name, cronExpression, data } = req.body;

  // Required field validation
  if (!id) errors.push('id is required');
  if (!name) errors.push('name is required');
  if (!cronExpression) errors.push('cronExpression is required');
  if (!data) errors.push('data is required');

  // Cron expression basic format check
  if (cronExpression) {
    const parts = cronExpression.split(' ');
    if (parts.length < 5) {
      errors.push('Invalid cron expression format');
    }
  }

  // Name length constraint
  if (name && name.length > 255) {
    errors.push('name must be 255 characters or less');
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
    return;
  }

  next();
};

/**
 * Validate schedule update
 */
export const validateScheduleUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors: string[] = [];
  const { cronExpression, enabled, startDate, endDate, maxRuns } = req.body;

  // At least one field should be present
  const fields = Object.keys(req.body);
  if (fields.length === 0) {
    errors.push('At least one field must be provided for update');
  }

  // Cron expression format check if provided
  if (cronExpression) {
    const parts = cronExpression.split(' ');
    if (parts.length < 5) {
      errors.push('Invalid cron expression format');
    }
  }

  // Boolean validation for enabled
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  // Date validation
  if (startDate) {
    const date = new Date(startDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid startDate format');
    }
  }

  if (endDate) {
    const date = new Date(endDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid endDate format');
    }
  }

  // Number validation for maxRuns
  if (maxRuns !== undefined && (typeof maxRuns !== 'number' || maxRuns < 1)) {
    errors.push('maxRuns must be a positive number');
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
    return;
  }

  next();
};

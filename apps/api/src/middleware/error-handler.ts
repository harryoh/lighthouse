import { Request, Response, NextFunction } from 'express';

interface ErrorWithStatus extends Error {
  status?: number;
  code?: string;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
  });

  // Default error values
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types
  if (err.code === 'P2002') {
    // Prisma unique constraint violation
    status = 409;
    message = 'Resource already exists';
  } else if (err.code === 'P2025') {
    // Prisma record not found
    status = 404;
    message = 'Resource not found';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  }

  // Send error response
  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err,
    }),
  });
};

/**
 * Handle 404 errors
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
};

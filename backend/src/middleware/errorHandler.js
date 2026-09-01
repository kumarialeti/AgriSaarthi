import { logger } from '../utils/logger.js';

/**
 * Centralized error handling middleware.
 * Must be the last middleware registered.
 */
export const errorHandler = (err, req, res, next) => {
  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'This record already exists.',
      field: err.detail,
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Referenced resource does not exist.',
    });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB.`,
    });
  }

  // Multer file type error (custom)
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(415).json({
      success: false,
      error: err.message || 'Invalid file type.',
    });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error.';

  if (status >= 500) {
    logger.error('Server error', {
      url: req.url,
      method: req.method,
      error: err.message,
      stack: err.stack,
    });
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 handler for unmatched routes.
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found.`,
  });
};

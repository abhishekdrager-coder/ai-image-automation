import { logger } from '../logger.js';

export function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';
  const message = statusCode >= 500 ? error.message || 'Unexpected server error.' : error.message;

  logger.error(message, { code, details: error.details || null });

  res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message,
      details: error.details || null,
    },
  });
}

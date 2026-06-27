import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { sendError, sendValidationError } from '../utils/apiResponse';
import { isProduction } from '../config/environment';

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '(root)';
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }
  return fieldErrors;
}

// Global error handler. Must be registered last. Translates known error types
// into the standard JSON response shapes.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // next is required so Express recognises this as an error handler.
  _next: NextFunction
): Response {
  if (err instanceof ZodError) {
    return sendValidationError(res, formatZodErrors(err));
  }

  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.code);
  }

  if (err instanceof jwt.JsonWebTokenError) {
    return sendError(res, 'Invalid or expired token', 401, 'UNAUTHORIZED');
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return sendError(
        res,
        'A record with these details already exists',
        409,
        'DUPLICATE_RECORD'
      );
    }
    if (err.code === 'P2025') {
      return sendError(res, 'Record not found', 404, 'NOT_FOUND');
    }
    return sendError(res, 'Database request error', 400, 'DATABASE_ERROR');
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return sendError(res, 'Invalid database query', 400, 'DATABASE_ERROR');
  }

  // Unknown / unexpected error: log server-side, return a generic message.
  console.error('Unhandled error:', err);
  const message =
    !isProduction && err instanceof Error ? err.message : 'Something went wrong';
  return sendError(res, message, 500, 'INTERNAL_ERROR');
}

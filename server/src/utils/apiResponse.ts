import { Response } from 'express';

// Standard response helpers matching the AgroVoice backend contract.
// Every endpoint must use these so the frontend can rely on a consistent shape.

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Operation completed successfully',
  statusCode = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message = 'Resource created successfully'
): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  statusCode = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    pagination,
  });
}

export function sendValidationError(
  res: Response,
  errors: Record<string, string[]>,
  message = 'Validation failed'
): Response {
  return res.status(422).json({
    success: false,
    message,
    errors,
  });
}

export function sendError(
  res: Response,
  message = 'Something went wrong',
  statusCode = 500,
  code = 'INTERNAL_ERROR'
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}

export function buildPagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

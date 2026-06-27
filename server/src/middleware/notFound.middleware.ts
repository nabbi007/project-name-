import { Request, Response } from 'express';
import { sendError } from '../utils/apiResponse';

export function notFoundHandler(req: Request, res: Response): Response {
  return sendError(
    res,
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'NOT_FOUND'
  );
}

import { NextFunction, Request, Response, RequestHandler } from 'express';

// Wraps an async route handler so rejected promises are forwarded to the
// global error middleware instead of crashing the process.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

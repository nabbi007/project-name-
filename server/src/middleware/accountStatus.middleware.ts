import { NextFunction, Request, Response } from 'express';
import { UserStatus } from '@prisma/client';
import { AppError } from '../utils/AppError';

// Blocks suspended accounts from accessing protected routes.
// Must run after `authenticate`.
export function requireActiveAccount(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  if (req.user.status === UserStatus.SUSPENDED) {
    throw AppError.forbidden(
      'Your account has been suspended. Please contact an administrator.',
      'ACCOUNT_SUSPENDED'
    );
  }

  next();
}

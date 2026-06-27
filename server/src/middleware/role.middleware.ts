import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from '../utils/AppError';

// Restricts a route to one or more roles. Must run after `authenticate`.
// Roles are taken from the authenticated user, never from the request body.
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw AppError.forbidden(
        'You do not have permission to perform this action'
      );
    }

    next();
  };
}

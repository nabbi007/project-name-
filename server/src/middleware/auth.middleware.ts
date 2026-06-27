import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

// Verifies the Bearer token, loads the user, and attaches it to req.user.
// Never logs the Authorization header.
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authentication token is required');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw AppError.unauthorized('Authentication token is required');
    }

    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { uuid: payload.sub },
      select: {
        id: true,
        uuid: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw AppError.unauthorized('User no longer exists');
    }

    req.user = user;
    next();
  }
);

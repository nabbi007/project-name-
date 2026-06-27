import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { requireActiveAccount } from '../../middleware/accountStatus.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { list, create } from './crops.controller';

const router = Router();

// Public: reference data for the marketplace and agents.
router.get('/', asyncHandler(list));

// Admin only: create a new crop category.
router.post(
  '/',
  authenticate,
  requireActiveAccount,
  authorize(UserRole.ADMIN),
  asyncHandler(create)
);

export default router;

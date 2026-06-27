import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { requireActiveAccount } from '../../middleware/accountStatus.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { create } from './complaints.controller';

const router = Router();

router.post(
  '/',
  authenticate,
  requireActiveAccount,
  authorize(UserRole.BUYER),
  asyncHandler(create)
);

export default router;

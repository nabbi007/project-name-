import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { requireActiveAccount } from '../../middleware/accountStatus.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { stats, users, userStatus, aiRuns, moderate } from './admin.controller';

const router = Router();

router.use(authenticate, requireActiveAccount, authorize(UserRole.ADMIN));

router.get('/stats', asyncHandler(stats));
router.get('/users', asyncHandler(users));
router.patch('/users/:userId/status', asyncHandler(userStatus));
router.get('/ai-runs', asyncHandler(aiRuns));
router.patch('/listings/:listingId/moderate', asyncHandler(moderate));

export default router;

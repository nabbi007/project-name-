import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { requireActiveAccount } from '../../middleware/accountStatus.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createAgent } from './auth.controller';

const router = Router();

// All admin routes require an authenticated, active ADMIN.
router.use(authenticate, requireActiveAccount, authorize(UserRole.ADMIN));

// POST /api/admin/agents -> create a FIELD_AGENT
router.post('/agents', asyncHandler(createAgent));

export default router;

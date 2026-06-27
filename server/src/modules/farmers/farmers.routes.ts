import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { requireActiveAccount } from '../../middleware/accountStatus.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  create,
  list,
  detail,
  update,
  changeStatus,
} from './farmers.controller';

const router = Router();

// All farmer routes require an authenticated, active field agent or admin.
router.use(
  authenticate,
  requireActiveAccount,
  authorize(UserRole.FIELD_AGENT, UserRole.ADMIN)
);

// Only field agents register farmers (assigned to themselves).
router.post('/', authorize(UserRole.FIELD_AGENT), asyncHandler(create));

router.get('/', asyncHandler(list));
router.get('/:farmerId', asyncHandler(detail));
router.patch('/:farmerId', asyncHandler(update));
router.patch('/:farmerId/status', asyncHandler(changeStatus));

export default router;

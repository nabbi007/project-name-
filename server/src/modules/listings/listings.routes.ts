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
  publish,
  unpublish,
} from './listings.controller';

const router = Router();

// Listing management is for field agents (their own) and admins.
router.use(
  authenticate,
  requireActiveAccount,
  authorize(UserRole.FIELD_AGENT, UserRole.ADMIN)
);

router.post('/', authorize(UserRole.FIELD_AGENT), asyncHandler(create));
router.get('/', asyncHandler(list));
router.get('/:listingId', asyncHandler(detail));
router.patch('/:listingId', asyncHandler(update));
router.post('/:listingId/publish', asyncHandler(publish));
router.post('/:listingId/unpublish', asyncHandler(unpublish));

export default router;

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { requireActiveAccount } from '../../middleware/accountStatus.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  create,
  listMine,
  listManaged,
  detail,
  cancel,
  changeStatus,
  farmerConfirmation,
} from './orders.controller';

const router = Router();

router.use(authenticate, requireActiveAccount);

// Buyer
router.post('/', authorize(UserRole.BUYER), asyncHandler(create));
router.get('/mine', authorize(UserRole.BUYER), asyncHandler(listMine));
router.patch('/:orderId/cancel', authorize(UserRole.BUYER), asyncHandler(cancel));

// Field agent / admin
router.get('/', authorize(UserRole.FIELD_AGENT, UserRole.ADMIN), asyncHandler(listManaged));
router.patch(
  '/:orderId/status',
  authorize(UserRole.FIELD_AGENT, UserRole.ADMIN),
  asyncHandler(changeStatus)
);
router.post(
  '/:orderId/farmer-confirmation',
  authorize(UserRole.FIELD_AGENT, UserRole.ADMIN),
  asyncHandler(farmerConfirmation)
);

// Any authenticated participant (access enforced in the service)
router.get('/:orderId', asyncHandler(detail));

export default router;

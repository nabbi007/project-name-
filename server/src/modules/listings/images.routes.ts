import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { requireActiveAccount } from '../../middleware/accountStatus.middleware';
import { imageUpload } from '../../middleware/upload.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { upload, analyse, retry, review } from './images.controller';

const guard = [
  authenticate,
  requireActiveAccount,
  authorize(UserRole.FIELD_AGENT, UserRole.ADMIN),
];

// Nested under /api/listings : POST /api/listings/:listingId/images
export const listingImageRoutes = Router();
listingImageRoutes.post(
  '/:listingId/images',
  ...guard,
  imageUpload.single('image'),
  asyncHandler(upload)
);

// Mounted at /api/listing-images
export const imageRoutes = Router();
imageRoutes.post('/:imageId/analyse', ...guard, asyncHandler(analyse));
imageRoutes.post('/:imageId/retry', ...guard, asyncHandler(retry));
imageRoutes.patch('/:imageId/review', ...guard, asyncHandler(review));

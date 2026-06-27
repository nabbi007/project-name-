import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { requireActiveAccount } from '../../middleware/accountStatus.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { audioUpload } from '../../middleware/upload.middleware';
import { generateListing, generateOrder, detail, played, farmerConfirmed } from './audio.controller';
import { supplementVoice } from '../listings/listings.controller';

const guard = [
  authenticate,
  requireActiveAccount,
  authorize(UserRole.FIELD_AGENT, UserRole.ADMIN),
];

// Mounted at /api/listings : POST /api/listings/:listingId/audio
export const listingAudioRoutes = Router();
listingAudioRoutes.post('/:listingId/audio', ...guard, asyncHandler(generateListing));
listingAudioRoutes.post(
  '/:listingId/supplement-voice',
  ...guard,
  audioUpload.single('audio'),
  asyncHandler(supplementVoice)
);

// Mounted at /api/orders : POST /api/orders/:orderId/audio
export const orderAudioRoutes = Router();
orderAudioRoutes.post('/:orderId/audio', ...guard, asyncHandler(generateOrder));

// Mounted at /api/generated-audio
export const generatedAudioRoutes = Router();
generatedAudioRoutes.get('/:audioId', ...guard, asyncHandler(detail));
generatedAudioRoutes.patch('/:audioId/played', ...guard, asyncHandler(played));
generatedAudioRoutes.patch('/:audioId/farmer-confirmed', ...guard, asyncHandler(farmerConfirmed));

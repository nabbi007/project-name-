import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { requireActiveAccount } from '../../middleware/accountStatus.middleware';
import { audioUpload } from '../../middleware/upload.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  create,
  detail,
  response,
  transcribe,
  retry,
  correctTranscript,
  complete,
} from './voice.controller';
import { extract as extractListing } from '../listings/listings.controller';

const guard = [
  authenticate,
  requireActiveAccount,
  authorize(UserRole.FIELD_AGENT, UserRole.ADMIN),
];

// Nested under /api/farmers : POST /api/farmers/:farmerId/voice-sessions
export const voiceFarmerRoutes = Router();
voiceFarmerRoutes.post(
  '/:farmerId/voice-sessions',
  ...guard,
  asyncHandler(create)
);

// Mounted at /api/voice-sessions
export const voiceSessionRoutes = Router();
voiceSessionRoutes.get('/:sessionId', ...guard, asyncHandler(detail));
voiceSessionRoutes.post(
  '/:sessionId/responses',
  ...guard,
  audioUpload.single('audio'),
  asyncHandler(response)
);
// Phase 5: turn a session's transcripts into a draft listing via the Agents API.
voiceSessionRoutes.post(
  '/:sessionId/extract-listing',
  ...guard,
  asyncHandler(extractListing)
);
voiceSessionRoutes.post('/:sessionId/complete', ...guard, asyncHandler(complete));

// Mounted at /api/voice-responses
export const voiceResponseRoutes = Router();
voiceResponseRoutes.post('/:responseId/transcribe', ...guard, asyncHandler(transcribe));
voiceResponseRoutes.post('/:responseId/retry', ...guard, asyncHandler(retry));
voiceResponseRoutes.patch('/:responseId/transcript', ...guard, asyncHandler(correctTranscript));

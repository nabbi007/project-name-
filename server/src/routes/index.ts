import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from '../modules/auth/auth.routes';
import adminRoutes from '../modules/auth/admin.routes';
import farmerRoutes from '../modules/farmers/farmers.routes';
import {
  voiceFarmerRoutes,
  voiceSessionRoutes,
  voiceResponseRoutes,
} from '../modules/voice/voice.routes';
import {
  listingImageRoutes,
  imageRoutes,
} from '../modules/listings/images.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);

// Voice session creation is nested under farmers; mount it before the farmer
// router so the nested route matches first.
router.use('/farmers', voiceFarmerRoutes);
router.use('/farmers', farmerRoutes);
router.use('/voice-sessions', voiceSessionRoutes);
router.use('/voice-responses', voiceResponseRoutes);

// Listing images (Phase 6 Vision)
router.use('/listings', listingImageRoutes);
router.use('/listing-images', imageRoutes);

// Placeholder mounts for upcoming phases (7-11). Teammates can replace these
// with their module routers.
// router.use('/crop-categories', cropRoutes);
// router.use('/voice-sessions', voiceRoutes);
// router.use('/listings', listingRoutes);
// router.use('/marketplace', marketplaceRoutes);
// router.use('/orders', orderRoutes);

export default router;

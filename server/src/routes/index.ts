import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from '../modules/auth/auth.routes';
import adminRoutes from '../modules/auth/admin.routes';
import adminDashboardRoutes from '../modules/admin/admin.routes';
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
import listingRoutes from '../modules/listings/listings.routes';
import cropRoutes from '../modules/crops/crops.routes';
import marketplaceRoutes from '../modules/marketplace/marketplace.routes';
import orderRoutes from '../modules/orders/orders.routes';
import complaintRoutes from '../modules/complaints/complaints.routes';
import {
  listingAudioRoutes,
  orderAudioRoutes,
  generatedAudioRoutes,
} from '../modules/audio/audio.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/admin', adminDashboardRoutes);

// Voice session creation is nested under farmers; mount it before the farmer
// router so the nested route matches first.
router.use('/farmers', voiceFarmerRoutes);
router.use('/farmers', farmerRoutes);
router.use('/voice-sessions', voiceSessionRoutes);
router.use('/voice-responses', voiceResponseRoutes);

// Public marketplace (Phase 9)
router.use('/marketplace', marketplaceRoutes);

// Orders & inventory (Phase 10)
router.use('/orders', orderRoutes);
router.use('/complaints', complaintRoutes);

// Crop categories (Phase 7)
router.use('/crop-categories', cropRoutes);

// Listings: images (Phase 6) + management/publication (Phase 7) + audio (Phase 8)
router.use('/listings', listingImageRoutes);
router.use('/listings', listingAudioRoutes);
router.use('/listings', listingRoutes);
router.use('/listing-images', imageRoutes);

// Generated audio / TTS notifications (Phase 8)
router.use('/orders', orderAudioRoutes);
router.use('/generated-audio', generatedAudioRoutes);

export default router;

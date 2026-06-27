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
import listingRoutes from '../modules/listings/listings.routes';
import cropRoutes from '../modules/crops/crops.routes';
import marketplaceRoutes from '../modules/marketplace/marketplace.routes';
import orderRoutes from '../modules/orders/orders.routes';

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

// Public marketplace (Phase 9)
router.use('/marketplace', marketplaceRoutes);

// Orders & inventory (Phase 10)
router.use('/orders', orderRoutes);

// Crop categories (Phase 7)
router.use('/crop-categories', cropRoutes);

// Listings: images (Phase 6) + management/publication (Phase 7)
router.use('/listings', listingImageRoutes);
router.use('/listings', listingRoutes);
router.use('/listing-images', imageRoutes);

// Placeholder mounts for upcoming phases (8-11). Teammates can replace these
// with their module routers.
// router.use('/marketplace', marketplaceRoutes);
// router.use('/voice-sessions', voiceRoutes);
// router.use('/listings', listingRoutes);
// router.use('/marketplace', marketplaceRoutes);
// router.use('/orders', orderRoutes);

export default router;

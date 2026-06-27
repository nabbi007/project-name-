import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from '../modules/auth/auth.routes';
import adminRoutes from '../modules/auth/admin.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);

// Placeholder mounts for upcoming phases (3-11). Teammates can replace these
// with their module routers.
// router.use('/farmers', farmerRoutes);
// router.use('/crop-categories', cropRoutes);
// router.use('/voice-sessions', voiceRoutes);
// router.use('/listings', listingRoutes);
// router.use('/marketplace', marketplaceRoutes);
// router.use('/orders', orderRoutes);

export default router;

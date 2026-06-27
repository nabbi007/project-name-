import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { browse, detail, farmerProfile } from './marketplace.controller';

// Public marketplace - no authentication. Only published, in-stock, non-expired
// listings are exposed, and farmer phone numbers are never included.
const router = Router();

router.get('/listings', asyncHandler(browse));
router.get('/listings/:listingId', asyncHandler(detail));
router.get('/farmers/:farmerId', asyncHandler(farmerProfile));

export default router;

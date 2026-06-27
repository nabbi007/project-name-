import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireActiveAccount } from '../../middleware/accountStatus.middleware';
import { authRateLimiter } from '../../middleware/rateLimit.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { register, login, me, logout } from './auth.controller';

const router = Router();

router.post('/register', authRateLimiter, asyncHandler(register));
router.post('/login', authRateLimiter, asyncHandler(login));
router.get('/me', authenticate, requireActiveAccount, asyncHandler(me));
router.post('/logout', authenticate, asyncHandler(logout));

export default router;

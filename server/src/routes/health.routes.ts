import { Router } from 'express';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();

// GET /api/health
router.get('/', (_req, res) => {
  sendSuccess(res, { uptime: process.uptime() }, 'AgroVoice API is running');
});

export default router;

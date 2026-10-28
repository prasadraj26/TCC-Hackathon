import { Router } from 'express';
import { estimatePriceHandler } from '../controllers/pricingController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// POST /api/pricing/estimate — requires auth to prevent anonymous abuse
router.post('/estimate', authenticate, estimatePriceHandler);

export default router;

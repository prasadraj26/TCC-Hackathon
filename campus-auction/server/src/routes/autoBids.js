import { Router } from 'express';
import * as biddingController from '../controllers/biddingController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router({ mergeParams: true });

// Public view of auto-bids for transparency
router.get('/', biddingController.getAuctionAutoBids);

// Register / update auto-bid (protected)
router.post('/', authenticate, biddingController.setAutoBid);

// Cancel auto-bid (protected)
router.delete('/', authenticate, biddingController.cancelAutoBid);

export default router;

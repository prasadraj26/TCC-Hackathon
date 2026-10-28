import { Router } from 'express';
import * as biddingController from '../controllers/biddingController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router({ mergeParams: true });

// Public bid history
router.get('/', biddingController.getAuctionBids);

// Place manual bid (protected)
router.post('/', authenticate, biddingController.placeBid);

export default router;

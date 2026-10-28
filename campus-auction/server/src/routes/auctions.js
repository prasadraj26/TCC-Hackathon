import { Router } from 'express';
import * as auctionController from '../controllers/auctionController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Public routes
router.get('/', auctionController.listAuctions);
router.get('/:id', auctionController.getAuction);

// Protected routes (require valid auth)
router.post('/', authenticate, auctionController.createAuction);
router.patch('/:id', authenticate, auctionController.updateAuction);
router.post('/:id/cancel', authenticate, auctionController.cancelAuction);

// Seller sale lifecycle outcomes
router.post('/:id/approve', authenticate, auctionController.approveWinningBid);
router.post('/:id/reject', authenticate, auctionController.rejectWinningBid);
router.post('/:id/handover', authenticate, auctionController.confirmHandover);
router.post('/:id/pickup-failed', authenticate, auctionController.markPickupFailed);

export default router;

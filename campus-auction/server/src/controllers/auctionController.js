import * as auctionService from '../services/auctionService.js';
import * as autoBidService from '../services/autoBidService.js';

export async function listAuctions(req, res, next) {
  try {
    const {
      search,
      category,
      condition,
      status,
      tab,
      minPricePaise,
      maxPricePaise,
      sellerUid,
      bidderUid,
      winnerUid
    } = req.query;

    const auctions = await auctionService.getAuctions({
      search,
      category,
      condition,
      status,
      tab,
      minPricePaise,
      maxPricePaise,
      sellerUid,
      bidderUid,
      winnerUid
    });

    res.json({ success: true, count: auctions.length, auctions });
  } catch (error) {
    next(error);
  }
}

export async function getAuction(req, res, next) {
  try {
    const auction = await auctionService.getAuctionById(req.params.id);
    if (!auction) {
      return res.status(404).json({ success: false, error: 'Auction not found' });
    }
    res.json({ success: true, auction });
  } catch (error) {
    next(error);
  }
}

export async function createAuction(req, res, next) {
  try {
    const {
      title,
      category,
      condition,
      description,
      images,
      startingPricePaise,
      minIncrementPaise,
      endsAt,
      location
    } = req.body;

    // Validation
    if (!title || !category || !condition || !startingPricePaise || !endsAt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, category, condition, startingPricePaise, endsAt'
      });
    }

    if (new Date(endsAt).getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: 'Closing date and time must be in the future.'
      });
    }

    const auction = await auctionService.createAuction({
      title,
      category,
      condition,
      description,
      images,
      startingPricePaise,
      minIncrementPaise: minIncrementPaise || 5000, // default ₹50
      endsAt,
      location
    }, req.user);

    res.status(201).json({ success: true, auction });
  } catch (error) {
    next(error);
  }
}

export async function updateAuction(req, res, next) {
  try {
    const auction = await auctionService.updateAuction(req.params.id, req.body, req.user);
    res.json({ success: true, auction });
  } catch (error) {
    next(error);
  }
}

export async function cancelAuction(req, res, next) {
  try {
    const { reason } = req.body;
    const auction = await auctionService.cancelAuction(req.params.id, reason, req.user);
    res.json({ success: true, auction });
  } catch (error) {
    next(error);
  }
}

export async function approveWinningBid(req, res, next) {
  try {
    const auction = await auctionService.approveWinningBid(req.params.id, req.user);
    res.json({ success: true, auction });
  } catch (error) {
    next(error);
  }
}

export async function rejectWinningBid(req, res, next) {
  try {
    const { reason } = req.body;
    const auction = await auctionService.rejectWinningBid(req.params.id, reason, req.user);
    res.json({ success: true, auction });
  } catch (error) {
    next(error);
  }
}

export async function confirmHandover(req, res, next) {
  try {
    const auction = await auctionService.confirmHandover(req.params.id, req.user);
    res.json({ success: true, auction });
  } catch (error) {
    next(error);
  }
}

export async function markPickupFailed(req, res, next) {
  try {
    const { reason } = req.body;
    const auction = await auctionService.markPickupFailed(req.params.id, reason, req.user);
    res.json({ success: true, auction });
  } catch (error) {
    next(error);
  }
}

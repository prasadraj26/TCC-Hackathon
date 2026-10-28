import * as biddingService from '../services/biddingService.js';
import * as autoBidService from '../services/autoBidService.js';

export async function placeBid(req, res, next) {
  try {
    const { amountPaise } = req.body;
    const auctionId = req.params.id;

    if (!amountPaise) {
      return res.status(400).json({
        success: false,
        error: 'Missing amountPaise in request body.'
      });
    }

    const result = await biddingService.placeBid(auctionId, Number(amountPaise), req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAuctionBids(req, res, next) {
  try {
    const auctionId = req.params.id;
    const bids = await biddingService.getAuctionBids(auctionId);
    res.json({ success: true, count: bids.length, bids });
  } catch (error) {
    next(error);
  }
}

export async function setAutoBid(req, res, next) {
  try {
    const { maxAmountPaise } = req.body;
    const auctionId = req.params.id;

    if (!maxAmountPaise) {
      return res.status(400).json({
        success: false,
        error: 'Missing maxAmountPaise in request body.'
      });
    }

    const autoBid = await autoBidService.registerAutoBid({
      auctionId,
      maxAmountPaise: Number(maxAmountPaise),
      user: req.user
    });

    res.status(201).json({ success: true, autoBid });
  } catch (error) {
    next(error);
  }
}

export async function getAuctionAutoBids(req, res, next) {
  try {
    const auctionId = req.params.id;
    const autoBids = await autoBidService.getAuctionAutoBids(auctionId);
    res.json({ success: true, autoBids });
  } catch (error) {
    next(error);
  }
}

export async function cancelAutoBid(req, res, next) {
  try {
    const auctionId = req.params.id;
    const result = await autoBidService.cancelAutoBid(auctionId, req.user.uid);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

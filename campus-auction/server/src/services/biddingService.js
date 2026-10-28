import { db, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { mockAuctions, mockBids } from '../utils/mockStore.js';
import { createNotification } from './notificationService.js';
import { processAutoBidsAfterNewBid } from './autoBidService.js';

/**
 * Executes a manual bid within an atomic transaction.
 * Supports both Firestore Transactions (when configured) and
 * In-Memory Atomic Lock (when in demo/local/test mode).
 */
export async function placeBid(auctionId, amountPaise, user) {
  const bidderUid = user.uid;
  const bidderName = user.name || user.email?.split('@')[0] || 'Campus Student';

  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    const error = new Error('Bid amount must be a positive integer in paise.');
    error.statusCode = 400;
    throw error;
  }

  let transactionResult = null;

  if (isFirebaseConfigured && db) {
    // --- REAL FIRESTORE TRANSACTION ---
    try {
      transactionResult = await db.runTransaction(async (transaction) => {
        const auctionRef = db.collection('auctions').doc(auctionId);
        const auctionDoc = await transaction.get(auctionRef);

        if (!auctionDoc.exists) {
          const err = new Error('Auction not found');
          err.statusCode = 404;
          throw err;
        }

        const auction = auctionDoc.data();
        const serverNow = Date.now();
        const endsAtTime = new Date(auction.endsAt).getTime();

        // 1. Verify auction status
        if (auction.status !== 'LIVE') {
          const err = new Error(`Cannot bid: auction is currently ${auction.status}`);
          err.statusCode = 400;
          throw err;
        }

        // 2. Verify server deadline
        if (serverNow >= endsAtTime) {
          const err = new Error('Auction has already ended.');
          err.statusCode = 400;
          throw err;
        }

        // 3. Reject seller self-bidding
        if (auction.sellerUid === bidderUid) {
          const err = new Error('Sellers cannot bid on their own listings.');
          err.statusCode = 403;
          throw err;
        }

        // 4. Validate bid amount
        const minRequiredPaise = auction.bidCount === 0
          ? auction.startingPricePaise
          : auction.currentPricePaise + auction.minIncrementPaise;

        if (amountPaise < minRequiredPaise) {
          const err = new Error(
            `Bid must be at least ₹${minRequiredPaise / 100} (Minimum increment: ₹${auction.minIncrementPaise / 100})`
          );
          err.statusCode = 400;
          throw err;
        }

        // 5. Check anti-sniping: If bid arrives in final 30 seconds, extend to 60 seconds from now
        let newEndsAt = auction.endsAt;
        let extended = false;
        const remainingMs = endsAtTime - serverNow;
        if (remainingMs <= 30000) {
          newEndsAt = new Date(serverNow + 60000).toISOString();
          extended = true;
        }

        // 6. Create immutable bid document
        const bidId = `bid-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const bidRef = auctionRef.collection('bids').doc(bidId);
        const bidData = {
          id: bidId,
          auctionId,
          bidderUid,
          bidderName,
          amountPaise,
          timestamp: new Date(serverNow).toISOString(),
          type: 'MANUAL'
        };

        // 7. Atomic writes: update auction and append bid
        const previousLeaderUid = auction.currentLeaderUid;
        transaction.set(bidRef, bidData);
        transaction.update(auctionRef, {
          currentPricePaise: amountPaise,
          currentLeaderUid: bidderUid,
          currentLeaderName: bidderName,
          bidCount: (auction.bidCount || 0) + 1,
          endsAt: newEndsAt,
          updatedAt: new Date(serverNow).toISOString()
        });

        return {
          bid: bidData,
          previousLeaderUid,
          extended,
          newEndsAt,
          auctionTitle: auction.title
        };
      });
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      throw err;
    }
  } else {
    // --- IN-MEMORY ATOMIC TRANSACTION (FALLBACK / DEMO / TEST) ---
    const auction = mockAuctions.find(a => a.id === auctionId);
    if (!auction) {
      const err = new Error('Auction not found');
      err.statusCode = 404;
      throw err;
    }

    const serverNow = Date.now();
    const endsAtTime = new Date(auction.endsAt).getTime();

    if (auction.status !== 'LIVE') {
      const err = new Error(`Cannot bid: auction is currently ${auction.status}`);
      err.statusCode = 400;
      throw err;
    }

    if (serverNow >= endsAtTime) {
      const err = new Error('Auction has already ended.');
      err.statusCode = 400;
      throw err;
    }

    if (auction.sellerUid === bidderUid) {
      const err = new Error('Sellers cannot bid on their own listings.');
      err.statusCode = 403;
      throw err;
    }

    const minRequiredPaise = auction.bidCount === 0
      ? auction.startingPricePaise
      : auction.currentPricePaise + auction.minIncrementPaise;

    if (amountPaise < minRequiredPaise) {
      const err = new Error(
        `Bid must be at least ₹${minRequiredPaise / 100} (Minimum increment: ₹${auction.minIncrementPaise / 100})`
      );
      err.statusCode = 400;
      throw err;
    }

    // Anti-sniping check
    let newEndsAt = auction.endsAt;
    let extended = false;
    const remainingMs = endsAtTime - serverNow;
    if (remainingMs <= 30000) {
      newEndsAt = new Date(serverNow + 60000).toISOString();
      extended = true;
    }

    const previousLeaderUid = auction.currentLeaderUid;
    const bidId = `bid-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const bidData = {
      id: bidId,
      auctionId,
      bidderUid,
      bidderName,
      amountPaise,
      timestamp: new Date(serverNow).toISOString(),
      type: 'MANUAL'
    };

    // Commit atomic changes
    auction.currentPricePaise = amountPaise;
    auction.currentLeaderUid = bidderUid;
    auction.currentLeaderName = bidderName;
    auction.bidCount = (auction.bidCount || 0) + 1;
    auction.endsAt = newEndsAt;
    auction.updatedAt = new Date(serverNow).toISOString();

    mockBids.unshift(bidData);

    transactionResult = {
      bid: bidData,
      previousLeaderUid,
      extended,
      newEndsAt,
      auctionTitle: auction.title
    };
  }

  // --- POST-TRANSACTION ASYNC ACTIONS (Never execute inside transaction callback) ---
  const { bid, previousLeaderUid, extended, newEndsAt, auctionTitle } = transactionResult;

  // 1. Notify previous leader they have been outbid
  if (previousLeaderUid && previousLeaderUid !== bidderUid) {
    createNotification({
      userId: previousLeaderUid,
      title: 'You Have Been Outbid!',
      message: `Someone placed a higher bid of ₹${amountPaise / 100} on "${auctionTitle}". Bid again to regain the lead!`,
      type: 'OUTBID',
      auctionId
    }).catch(console.error);
  }

  // 2. Notify about anti-sniping extension
  if (extended) {
    createNotification({
      userId: bidderUid,
      title: 'Auction Deadline Extended (Anti-Sniping)',
      message: `A bid in the final 30 seconds extended the closing time of "${auctionTitle}" by 60 seconds.`,
      type: 'ANTI_SNIPING_EXTENSION',
      auctionId
    }).catch(console.error);
  }

  // 3. Process automatic bids if any exist on this auction
  try {
    await processAutoBidsAfterNewBid(auctionId, amountPaise, bidderUid);
  } catch (autoErr) {
    console.error('[BiddingService] Auto-bid processing warning:', autoErr.message);
  }

  return {
    success: true,
    bid,
    extended,
    newEndsAt
  };
}

/**
 * Get public bid history for an auction.
 */
export async function getAuctionBids(auctionId) {
  if (isFirebaseConfigured && db) {
    try {
      const snapshot = await db
        .collection('auctions')
        .doc(auctionId)
        .collection('bids')
        .orderBy('timestamp', 'desc')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[BiddingService] Firestore get bids failed:', err.message);
    }
  }

  return mockBids
    .filter(b => b.auctionId === auctionId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

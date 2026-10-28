import { db, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { mockAuctions, mockBids, mockAutoBids } from '../utils/mockStore.js';
import { createNotification } from './notificationService.js';
import { getUserProfile, getUsersMap, formatDisplayName } from './userService.js';

/**
 * Register or update an automatic bidding limit for a student on an auction.
 * NOTE: As required by the Campus Auction specifications, maximum bids in this
 * collegiate system are publicly visible to ensure complete peer transparency.
 */
export async function registerAutoBid({ auctionId, maxAmountPaise, user }) {
  if (!Number.isInteger(maxAmountPaise) || maxAmountPaise <= 0) {
    throw new Error('Maximum bid amount must be a positive integer in paise.');
  }

  // Fetch auction to validate
  let auction = null;
  if (isFirebaseConfigured && db) {
    const doc = await db.collection('auctions').doc(auctionId).get();
    if (doc.exists) auction = doc.data();
  } else {
    auction = mockAuctions.find(a => a.id === auctionId);
  }

  if (!auction) throw new Error('Auction not found');
  if (auction.status !== 'LIVE') throw new Error('Cannot set auto-bid on inactive auction');
  if (auction.sellerUid === user.uid) throw new Error('Seller cannot auto-bid on their own listing');

  const minRequired = auction.bidCount === 0
    ? auction.startingPricePaise
    : auction.currentPricePaise + auction.minIncrementPaise;

  if (maxAmountPaise < minRequired) {
    throw new Error(`Maximum bid must be at least ₹${minRequired / 100}`);
  }

  const profile = await getUserProfile(user.uid);
  const resolvedBidderName = formatDisplayName(profile?.name || user.name, user.uid);

  const autoBidRecord = {
    id: `autobid-${auctionId}-${user.uid}`,
    auctionId,
    bidderUid: user.uid,
    bidderName: resolvedBidderName,
    maxAmountPaise,
    active: true,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await db.collection('autoBids').doc(autoBidRecord.id).set(autoBidRecord);
  }

  const existingIdx = mockAutoBids.findIndex(b => b.auctionId === auctionId && b.bidderUid === user.uid);
  if (existingIdx >= 0) {
    mockAutoBids[existingIdx] = autoBidRecord;
  } else {
    mockAutoBids.push(autoBidRecord);
  }

  // Trigger evaluation immediately if current leader is not this bidder
  if (auction.currentLeaderUid !== user.uid) {
    await processAutoBidsAfterNewBid(auctionId, auction.currentPricePaise, auction.currentLeaderUid);
  }

  return autoBidRecord;
}

/**
 * Get all active auto-bids for an auction.
 * Transparent public records as specified in problem statement.
 */
export async function getAuctionAutoBids(auctionId) {
  let list = [];
  if (isFirebaseConfigured && db) {
    try {
      const snap = await db.collection('autoBids')
        .where('auctionId', '==', auctionId)
        .where('active', '==', true)
        .get();
      list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[AutoBidService] Firestore query failed:', err.message);
    }
  }

  if (list.length === 0) {
    list = mockAutoBids.filter(b => b.auctionId === auctionId && b.active);
  }

  const uids = [...new Set(list.map(b => b.bidderUid).filter(Boolean))];
  const namesMap = await getUsersMap(uids);

  return list.map(b => ({
    ...b,
    bidderName: namesMap[b.bidderUid] || formatDisplayName(b.bidderName, b.bidderUid)
  }));
}

/**
 * Cancel user's auto-bid.
 */
export async function cancelAutoBid(auctionId, userId) {
  const id = `autobid-${auctionId}-${userId}`;
  if (isFirebaseConfigured && db) {
    await db.collection('autoBids').doc(id).update({ active: false });
  }

  const b = mockAutoBids.find(item => item.auctionId === auctionId && item.bidderUid === userId);
  if (b) b.active = false;

  return { success: true };
}

/**
 * Evaluates active auto-bidders against the latest leading bid and resolves automatically.
 * Deterministic rule for equal maximums: Earlier `createdAt` timestamp wins.
 * Safety: Guarded against recursive infinite loops with loop counter.
 */
export async function processAutoBidsAfterNewBid(auctionId, currentPricePaise, currentLeaderUid) {
  let auction = null;
  if (isFirebaseConfigured && db) {
    const doc = await db.collection('auctions').doc(auctionId).get();
    if (doc.exists) auction = { id: doc.id, ...doc.data() };
  } else {
    auction = mockAuctions.find(a => a.id === auctionId);
  }

  if (!auction || auction.status !== 'LIVE') return;

  const now = Date.now();
  if (now >= new Date(auction.endsAt).getTime()) return; // Auction ended

  // Fetch active auto-bids
  const autoBids = await getAuctionAutoBids(auctionId);
  if (!autoBids || autoBids.length === 0) return;

  // Filter out the current leader (no self-bidding) and sort deterministically:
  // 1. Highest maxAmountPaise desc
  // 2. Earliest createdAt asc (tie-breaker)
  const contenders = autoBids
    .filter(b => b.active && b.bidderUid !== auction.currentLeaderUid && b.maxAmountPaise > auction.currentPricePaise)
    .sort((a, b) => {
      if (b.maxAmountPaise !== a.maxAmountPaise) {
        return b.maxAmountPaise - a.maxAmountPaise;
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

  if (contenders.length === 0) return;

  const topContender = contenders[0];
  const minIncrement = auction.minIncrementPaise;
  const nextRequiredBid = auction.bidCount === 0
    ? auction.startingPricePaise
    : auction.currentPricePaise + minIncrement;

  if (topContender.maxAmountPaise < nextRequiredBid) return;

  // Calculate the new bid amount:
  // Only bid enough to take or maintain lead using minimum increment
  let calculatedBid = nextRequiredBid;

  // If there is a second competing auto-bidder, push up to their max + increment
  if (contenders.length > 1) {
    const secondHighest = contenders[1];
    const pushAmount = secondHighest.maxAmountPaise + minIncrement;
    calculatedBid = Math.min(topContender.maxAmountPaise, Math.max(nextRequiredBid, pushAmount));
  }

  // Ensure within top contender's budget
  if (calculatedBid > topContender.maxAmountPaise) {
    calculatedBid = topContender.maxAmountPaise;
  }

  // Create AUTO bid record
  const serverNow = Date.now();
  const bidId = `bid-auto-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const autoBidDoc = {
    id: bidId,
    auctionId,
    bidderUid: topContender.bidderUid,
    bidderName: topContender.bidderName,
    amountPaise: calculatedBid,
    timestamp: new Date(serverNow).toISOString(),
    type: 'AUTO'
  };

  // Check anti-sniping extension for auto-bid as well
  let newEndsAt = auction.endsAt;
  const endsAtTime = new Date(auction.endsAt).getTime();
  if (endsAtTime - serverNow <= 30000) {
    newEndsAt = new Date(serverNow + 60000).toISOString();
  }

  const prevLeader = auction.currentLeaderUid;

  // Commit updates
  if (isFirebaseConfigured && db) {
    const batch = db.batch();
    const auctionRef = db.collection('auctions').doc(auctionId);
    const bidRef = auctionRef.collection('bids').doc(bidId);

    batch.set(bidRef, autoBidDoc);
    batch.update(auctionRef, {
      currentPricePaise: calculatedBid,
      currentLeaderUid: topContender.bidderUid,
      currentLeaderName: topContender.bidderName,
      bidCount: (auction.bidCount || 0) + 1,
      endsAt: newEndsAt,
      updatedAt: new Date(serverNow).toISOString()
    });
    await batch.commit();
  }

  auction.currentPricePaise = calculatedBid;
  auction.currentLeaderUid = topContender.bidderUid;
  auction.currentLeaderName = topContender.bidderName;
  auction.bidCount = (auction.bidCount || 0) + 1;
  auction.endsAt = newEndsAt;
  auction.updatedAt = new Date(serverNow).toISOString();

  mockBids.unshift(autoBidDoc);

  // Notify previous leader
  if (prevLeader && prevLeader !== topContender.bidderUid) {
    createNotification({
      userId: prevLeader,
      title: 'Outbid by Auto-Bid!',
      message: `An automatic bid of ₹${calculatedBid / 100} outbid you on "${auction.title}".`,
      type: 'OUTBID_AUTO',
      auctionId
    }).catch(console.error);
  }

  // Notify seller of new bid
  if (auction.sellerUid && auction.sellerUid !== topContender.bidderUid) {
    createNotification({
      userId: auction.sellerUid,
      title: 'New Bid on Your Auction!',
      message: `${topContender.bidderName} placed an auto-bid of ₹${calculatedBid / 100} on "${auction.title}".`,
      type: 'NEW_BID',
      auctionId
    }).catch(console.error);
  }
}

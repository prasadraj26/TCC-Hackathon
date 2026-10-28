import { db, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { mockAuctions } from '../utils/mockStore.js';
import { createNotification, checkSavedSearchesAndNotify } from './notificationService.js';
import { getUserProfile, getUsersMap, formatDisplayName, isRawUidOrFake } from './userService.js';

/**
 * Checks if an auction has reached its closing deadline and transitions its status.
 * Reusable across queries, detail fetches, and bidding attempts.
 */
export async function checkAndCloseAuctionIfExpired(auction) {
  if (auction.status !== 'LIVE') return auction;

  const now = Date.now();
  const endsAtTime = new Date(auction.endsAt).getTime();

  if (now >= endsAtTime) {
    const newStatus = (auction.bidCount > 0 && auction.currentLeaderUid) ? 'ENDED_PENDING_SELLER' : 'UNSOLD';
    const outcome = newStatus === 'UNSOLD' ? 'NO_BIDS' : 'PENDING_SELLER_APPROVAL';
    const outcomeNote = newStatus === 'UNSOLD' 
      ? 'Auction closed with no bids received.' 
      : 'Auction closed. Waiting for seller to review and approve the winning bid.';

    if (isFirebaseConfigured && db) {
      try {
        const ref = db.collection('auctions').doc(auction.id);
        await ref.update({
          status: newStatus,
          outcome,
          outcomeNote,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('[AuctionService] Firestore close update failed:', err.message);
      }
    }

    // Update in-memory / local object
    auction.status = newStatus;
    auction.outcome = outcome;
    auction.outcomeNote = outcomeNote;
    auction.updatedAt = new Date().toISOString();

    // Trigger notification to seller
    if (newStatus === 'ENDED_PENDING_SELLER') {
      createNotification({
        userId: auction.sellerUid,
        title: 'Auction Ended: Action Required',
        message: `Your auction "${auction.title}" ended with a winning bid of ₹${auction.currentPricePaise / 100}. Please approve or reject the outcome.`,
        type: 'AUCTION_ENDED_SELLER',
        auctionId: auction.id
      }).catch(console.error);

      if (auction.currentLeaderUid) {
        createNotification({
          userId: auction.currentLeaderUid,
          title: 'You Won the Auction!',
          message: `Congratulations! You are the provisional winner of "${auction.title}" at ₹${auction.currentPricePaise / 100}. Awaiting seller approval.`,
          type: 'AUCTION_WON_BUYER',
          auctionId: auction.id
        }).catch(console.error);
      }
    } else {
      createNotification({
        userId: auction.sellerUid,
        title: 'Auction Ended: Unsold',
        message: `Your auction "${auction.title}" closed with no bids.`,
        type: 'AUCTION_UNSOLD',
        auctionId: auction.id
      }).catch(console.error);
    }
  }

  return auction;
}

export const SOLD_WINDOW_MS = 10 * 60 * 1000; // 10 minutes (600,000 ms)

export function isAuctionSold(auction) {
  return Boolean(auction && (auction.status === 'SOLD' || auction.outcome === 'SOLD'));
}

export function isSoldWithinWindow(auction, now = Date.now()) {
  if (!isAuctionSold(auction)) return false;
  const completedAtMs = new Date(auction.completedAt || auction.updatedAt || 0).getTime();
  if (!completedAtMs || isNaN(completedAtMs)) return false;
  const elapsed = now - completedAtMs;
  return elapsed >= 0 && elapsed <= SOLD_WINDOW_MS;
}

/**
 * List auctions with rich filtering and lazy expiration.
 */
export async function getAuctions(filters = {}) {
  let list = [];

  if (isFirebaseConfigured && db) {
    try {
      let query = db.collection('auctions');
      if (filters.status && filters.status !== 'ALL') {
        query = query.where('status', '==', filters.status);
      }
      if (filters.category && filters.category !== 'All') {
        query = query.where('category', '==', filters.category);
      }
      if (filters.sellerUid) {
        query = query.where('sellerUid', '==', filters.sellerUid);
      }
      const snapshot = await query.get();
      list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[AuctionService] Firestore query failed, falling back to mock auctions:', err.message);
      list = [...mockAuctions];
    }
  } else {
    list = [...mockAuctions];
  }

  // Run lazy expiration check on all items
  for (let i = 0; i < list.length; i++) {
    list[i] = await checkAndCloseAuctionIfExpired(list[i]);
  }

  // In-memory filters for keyword, condition, price range, and tab views
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(a => 
      a.title.toLowerCase().includes(q) || 
      (a.description && a.description.toLowerCase().includes(q)) ||
      (a.location && a.location.toLowerCase().includes(q))
    );
  }

  if (filters.category && filters.category !== 'All') {
    list = list.filter(a => a.category === filters.category);
  }

  if (filters.condition && filters.condition !== 'All') {
    list = list.filter(a => a.condition === filters.condition);
  }

  if (filters.sellerUid) {
    list = list.filter(a => a.sellerUid === filters.sellerUid);
  }

  if (filters.bidderUid) {
    list = list.filter(a =>
      a.currentLeaderUid === filters.bidderUid ||
      (Array.isArray(a.bidderUids) && a.bidderUids.includes(filters.bidderUid))
    );
  }

  if (filters.winnerUid) {
    list = list.filter(a =>
      a.currentLeaderUid === filters.winnerUid &&
      (a.status === 'SOLD' || a.status === 'RESERVED' || a.status === 'ENDED_PENDING_SELLER')
    );
  }

  if (filters.minPricePaise) {
    list = list.filter(a => a.currentPricePaise >= Number(filters.minPricePaise));
  }

  if (filters.maxPricePaise) {
    list = list.filter(a => a.currentPricePaise <= Number(filters.maxPricePaise));
  }

  const isPersonalQuery = Boolean(filters.sellerUid || filters.bidderUid || filters.winnerUid);

  // If a specific status was explicitly requested and not ALL, enforce it
  if (filters.status && filters.status !== 'ALL') {
    list = list.filter(a => a.status === filters.status);
  }

  // Tab & Lifecycle Sorting Rules
  const now = Date.now();
  if (!isPersonalQuery) {
    // PUBLIC / HOMEPAGE BROWSING RULES:
    if (filters.tab === 'CLOSING_SOON') {
      // Closing Soon: active auctions ordered by remaining time
      list = list
        .filter(a => a.status === 'LIVE' && new Date(a.endsAt).getTime() > now)
        .sort((a, b) => new Date(a.endsAt) - new Date(b.endsAt));
    } else if (filters.tab === 'FEATURED') {
      // Most Active: active auctions ranked using real bidding activity
      list = list
        .filter(a => a.status === 'LIVE')
        .sort((a, b) => {
          if ((b.bidCount || 0) !== (a.bidCount || 0)) {
            return (b.bidCount || 0) - (a.bidCount || 0);
          }
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
    } else if (filters.tab === 'RECENT') {
      // Recently Listed: recently created active listings PLUS sold/completed listings that qualify for the 10-minute window
      list = list
        .filter(a => a.status === 'LIVE' || isSoldWithinWindow(a, now))
        .sort((a, b) => {
          const timeA = new Date(isAuctionSold(a) ? (a.completedAt || a.updatedAt || a.createdAt) : a.createdAt).getTime();
          const timeB = new Date(isAuctionSold(b) ? (b.completedAt || b.updatedAt || b.createdAt) : b.createdAt).getTime();
          return timeB - timeA;
        });
    } else {
      // All Listings (ALL or default): all currently active auctions (sold items excluded)
      list = list
        .filter(a => a.status === 'LIVE')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  } else {
    // PERSONAL QUERY SORTING (preserves full historical records for seller & buyer history)
    list.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }

  // Resolve real seller and leader names from user profiles (handling old or missing name records)
  const uids = [...new Set(list.flatMap(a => [a.sellerUid, a.currentLeaderUid]).filter(Boolean))];
  const namesMap = await getUsersMap(uids);
  for (const a of list) {
    if (a.sellerUid && namesMap[a.sellerUid] && namesMap[a.sellerUid] !== 'User') {
      a.sellerName = namesMap[a.sellerUid];
    } else if (isRawUidOrFake(a.sellerName, a.sellerUid)) {
      a.sellerName = 'User';
    }
    if (a.currentLeaderUid) {
      if (namesMap[a.currentLeaderUid] && namesMap[a.currentLeaderUid] !== 'User') {
        a.currentLeaderName = namesMap[a.currentLeaderUid];
      } else if (isRawUidOrFake(a.currentLeaderName, a.currentLeaderUid)) {
        a.currentLeaderName = 'User';
      }
    }
  }

  return list;
}

/**
 * Get auction by ID with lazy expiration check.
 */
export async function getAuctionById(id) {
  let auction = null;

  if (isFirebaseConfigured && db) {
    try {
      const doc = await db.collection('auctions').doc(id).get();
      if (doc.exists) {
        auction = { id: doc.id, ...doc.data() };
      }
    } catch (err) {
      console.warn('[AuctionService] Firestore get failed:', err.message);
    }
  }

  if (!auction) {
    auction = mockAuctions.find(a => a.id === id);
  }

  if (!auction) return null;

  // Resolve seller and leader display names safely
  if (auction.sellerUid) {
    const sellerProfile = await getUserProfile(auction.sellerUid);
    auction.sellerName = formatDisplayName(sellerProfile?.name, auction.sellerUid);
  } else if (isRawUidOrFake(auction.sellerName, auction.sellerUid)) {
    auction.sellerName = 'User';
  }

  if (auction.currentLeaderUid) {
    const leaderProfile = await getUserProfile(auction.currentLeaderUid);
    auction.currentLeaderName = formatDisplayName(leaderProfile?.name, auction.currentLeaderUid);
  }

  return await checkAndCloseAuctionIfExpired(auction);
}

/**
 * Create a new auction.
 */
export async function createAuction(auctionData, user) {
  const {
    title,
    category,
    condition,
    description,
    images = [],
    startingPricePaise,
    minIncrementPaise,
    endsAt,
    location = 'Campus Central'
  } = auctionData;

  const now = new Date().toISOString();
  const id = `auction-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  // Resolve real display name from authenticated user profile
  const profile = await getUserProfile(user.uid);
  const resolvedSellerName = formatDisplayName(profile?.name || user.name, user.uid);

  const newAuction = {
    id,
    sellerUid: user.uid,
    sellerName: resolvedSellerName,
    sellerEmail: user.email,
    title,
    category,
    condition,
    description,
    images: Array.isArray(images) ? images : [],
    startingPricePaise: Number(startingPricePaise),
    minIncrementPaise: Number(minIncrementPaise),
    currentPricePaise: Number(startingPricePaise),
    currentLeaderUid: null,
    currentLeaderName: null,
    bidCount: 0,
    status: 'LIVE',
    createdAt: now,
    updatedAt: now,
    endsAt: new Date(endsAt).toISOString(),
    location,
    outcome: null,
    outcomeNote: null
  };

  if (isFirebaseConfigured && db) {
    try {
      await db.collection('auctions').doc(id).set(newAuction);
    } catch (err) {
      console.error('[AuctionService] Firestore write failed:', err.message);
    }
  }

  // Also add to mock store for local consistency
  mockAuctions.unshift(newAuction);

  // Trigger saved search alerts for interested students
  checkSavedSearchesAndNotify(newAuction).catch(console.error);

  return newAuction;
}

/**
 * Edit listing (only seller, only before any bids).
 */
export async function updateAuction(id, updates, user) {
  const auction = await getAuctionById(id);
  if (!auction) throw new Error('Auction not found');
  if (auction.sellerUid !== user.uid) throw new Error('Unauthorized: only the seller can edit this listing');
  if (auction.bidCount > 0) throw new Error('Cannot edit listing after bids have been placed');
  if (auction.status !== 'LIVE') throw new Error('Cannot edit an auction that is not LIVE');

  const allowedFields = ['title', 'category', 'condition', 'description', 'images', 'location'];
  const sanitizedUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) sanitizedUpdates[key] = updates[key];
  }
  sanitizedUpdates.updatedAt = new Date().toISOString();

  if (isFirebaseConfigured && db) {
    await db.collection('auctions').doc(id).update(sanitizedUpdates);
  }

  Object.assign(auction, sanitizedUpdates);
  return auction;
}

/**
 * Seller cancels listing with outcome note.
 */
export async function cancelAuction(id, reason, user) {
  const auction = await getAuctionById(id);
  if (!auction) throw new Error('Auction not found');
  if (auction.sellerUid !== user.uid) throw new Error('Unauthorized: only the seller can cancel this listing');
  if (auction.status === 'SOLD' || auction.status === 'CANCELLED') {
    throw new Error(`Cannot cancel an auction with status ${auction.status}`);
  }

  const updates = {
    status: 'CANCELLED',
    outcome: 'CANCELLED_BY_SELLER',
    outcomeNote: reason || 'Cancelled by seller.',
    updatedAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await db.collection('auctions').doc(id).update(updates);
  }

  Object.assign(auction, updates);

  // Notify current leader if any
  if (auction.currentLeaderUid) {
    createNotification({
      userId: auction.currentLeaderUid,
      title: 'Auction Cancelled',
      message: `The auction for "${auction.title}" was cancelled by the seller: ${updates.outcomeNote}`,
      type: 'AUCTION_CANCELLED',
      auctionId: id
    }).catch(console.error);
  }

  return auction;
}

/**
 * Seller approves winning price -> RESERVED
 */
export async function approveWinningBid(id, user) {
  const auction = await getAuctionById(id);
  if (!auction) throw new Error('Auction not found');
  if (auction.sellerUid !== user.uid) throw new Error('Unauthorized: only the seller can approve this winning bid');
  if (auction.status !== 'ENDED_PENDING_SELLER') {
    throw new Error(`Invalid state transition: auction status is ${auction.status}, expected ENDED_PENDING_SELLER`);
  }

  const updates = {
    status: 'RESERVED',
    outcome: 'APPROVED',
    outcomeNote: 'Seller approved winning bid. Ready for campus meetup and handover.',
    reservedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await db.collection('auctions').doc(id).update(updates);
  }

  Object.assign(auction, updates);

  createNotification({
    userId: auction.currentLeaderUid,
    title: 'Winning Bid Approved!',
    message: `The seller has approved your winning bid of ₹${auction.currentPricePaise / 100} for "${auction.title}". The item is reserved for you. Please coordinate campus handover.`,
    type: 'BID_APPROVED',
    auctionId: id
  }).catch(console.error);

  return auction;
}

/**
 * Seller rejects winning price -> REJECTED
 */
export async function rejectWinningBid(id, reason, user) {
  const auction = await getAuctionById(id);
  if (!auction) throw new Error('Auction not found');
  if (auction.sellerUid !== user.uid) throw new Error('Unauthorized: only the seller can reject this winning bid');
  if (auction.status !== 'ENDED_PENDING_SELLER') {
    throw new Error(`Invalid state transition: auction status is ${auction.status}, expected ENDED_PENDING_SELLER`);
  }

  const updates = {
    status: 'REJECTED',
    outcome: 'REJECTED_BY_SELLER',
    outcomeNote: reason || 'Seller declined the final winning price.',
    updatedAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await db.collection('auctions').doc(id).update(updates);
  }

  Object.assign(auction, updates);

  createNotification({
    userId: auction.currentLeaderUid,
    title: 'Winning Bid Rejected',
    message: `The seller did not accept the final bid for "${auction.title}". Reason: ${updates.outcomeNote}`,
    type: 'BID_REJECTED',
    auctionId: id
  }).catch(console.error);

  return auction;
}

/**
 * Confirm handover -> SOLD
 */
export async function confirmHandover(id, user) {
  const auction = await getAuctionById(id);
  if (!auction) throw new Error('Auction not found');
  if (auction.sellerUid !== user.uid) throw new Error('Unauthorized: only the seller can confirm handover');
  if (auction.status !== 'RESERVED') {
    throw new Error(`Invalid state transition: auction status is ${auction.status}, expected RESERVED`);
  }

  const updates = {
    status: 'SOLD',
    outcome: 'SOLD',
    outcomeNote: 'Item successfully handed over on campus. Sale completed.',
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await db.collection('auctions').doc(id).update(updates);
  }

  Object.assign(auction, updates);

  createNotification({
    userId: auction.currentLeaderUid,
    title: 'Sale Completed!',
    message: `Handover confirmed for "${auction.title}". Congratulations on your purchase!`,
    type: 'SALE_COMPLETED',
    auctionId: id
  }).catch(console.error);

  return auction;
}

/**
 * Report pickup failed -> PICKUP_FAILED
 */
export async function markPickupFailed(id, reason, user) {
  const auction = await getAuctionById(id);
  if (!auction) throw new Error('Auction not found');
  if (auction.sellerUid !== user.uid) throw new Error('Unauthorized: only the seller can report failed pickup');
  if (auction.status !== 'RESERVED') {
    throw new Error(`Invalid state transition: auction status is ${auction.status}, expected RESERVED`);
  }

  const updates = {
    status: 'PICKUP_FAILED',
    outcome: 'PICKUP_FAILED',
    outcomeNote: reason || 'Buyer did not show up for campus pickup.',
    updatedAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await db.collection('auctions').doc(id).update(updates);
  }

  Object.assign(auction, updates);

  createNotification({
    userId: auction.currentLeaderUid,
    title: 'Pickup Marked as Failed',
    message: `The seller marked campus pickup failed for "${auction.title}".`,
    type: 'PICKUP_FAILED',
    auctionId: id
  }).catch(console.error);

  return auction;
}

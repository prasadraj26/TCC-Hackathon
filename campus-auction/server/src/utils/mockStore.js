/**
 * In-Memory Transactional Store for Local / Test Mode.
 * Initialized as a completely clean marketplace with no seeded demo auctions or users.
 * When real auctions, bids, or notifications are created through the app,
 * they are dynamically recorded here and in Firestore.
 */

// Clean initial store collections
export const mockUsers = {};
export const mockAuctions = [];
export const mockBids = [];
export const mockAutoBids = [];
export const mockNotifications = [];
export const mockSavedSearches = [];

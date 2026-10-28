import { db, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { mockNotifications, mockSavedSearches } from '../utils/mockStore.js';

export async function createNotification({ userId, title, message, type, auctionId }) {
  const notifData = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    userId,
    title,
    message,
    type,
    auctionId,
    read: false,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    try {
      const docRef = await db.collection('notifications').add(notifData);
      return { id: docRef.id, ...notifData };
    } catch (err) {
      console.error('[NotificationService] Firestore write failed:', err.message);
    }
  }

  // Fallback to in-memory store
  mockNotifications.unshift(notifData);
  return notifData;
}

export async function getUserNotifications(userId) {
  if (isFirebaseConfigured && db) {
    try {
      const snapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[NotificationService] Falling back to mock notifications:', err.message);
    }
  }

  return mockNotifications.filter(n => n.userId === userId);
}

export async function markNotificationAsRead(notifId, userId) {
  if (isFirebaseConfigured && db) {
    try {
      const ref = db.collection('notifications').doc(notifId);
      const doc = await ref.get();
      if (doc.exists && doc.data().userId === userId) {
        await ref.update({ read: true, readAt: new Date().toISOString() });
        return true;
      }
    } catch (err) {
      console.error('[NotificationService] Mark read failed:', err.message);
    }
  }

  const notif = mockNotifications.find(n => n.id === notifId && n.userId === userId);
  if (notif) {
    notif.read = true;
    notif.readAt = new Date().toISOString();
    return true;
  }
  return false;
}

export async function checkSavedSearchesAndNotify(newAuction) {
  let searches = [];
  if (isFirebaseConfigured && db) {
    try {
      const snap = await db.collection('savedSearches').get();
      searches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      searches = mockSavedSearches;
    }
  } else {
    searches = mockSavedSearches;
  }

  const titleLower = newAuction.title.toLowerCase();
  const descLower = (newAuction.description || '').toLowerCase();

  for (const s of searches) {
    if (s.userId === newAuction.sellerUid) continue; // Don't notify seller about their own listing

    const matchesKeyword = !s.keyword || titleLower.includes(s.keyword.toLowerCase()) || descLower.includes(s.keyword.toLowerCase());
    const matchesCategory = !s.category || s.category === 'All' || s.category === newAuction.category;
    const matchesPrice = !s.maxPricePaise || newAuction.startingPricePaise <= s.maxPricePaise;

    if (matchesKeyword && matchesCategory && matchesPrice) {
      await createNotification({
        userId: s.userId,
        title: 'New Matching Listing!',
        message: `A new item matching your saved search "${s.keyword || s.category}" was just posted: "${newAuction.title}".`,
        type: 'SAVED_SEARCH_MATCH',
        auctionId: newAuction.id
      });
    }
  }
}

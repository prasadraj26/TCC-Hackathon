import * as notificationService from '../services/notificationService.js';
import { db, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { mockSavedSearches } from '../utils/mockStore.js';

export async function getNotifications(req, res, next) {
  try {
    const notifications = await notificationService.getUserNotifications(req.user.uid);
    res.json({ success: true, count: notifications.length, notifications });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const success = await notificationService.markNotificationAsRead(req.params.id, req.user.uid);
    res.json({ success });
  } catch (error) {
    next(error);
  }
}

export async function getSavedSearches(req, res, next) {
  try {
    if (isFirebaseConfigured && db) {
      const snap = await db.collection('savedSearches')
        .where('userId', '==', req.user.uid)
        .get();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json({ success: true, savedSearches: list });
    }

    const list = mockSavedSearches.filter(s => s.userId === req.user.uid);
    res.json({ success: true, savedSearches: list });
  } catch (error) {
    next(error);
  }
}

export async function createSavedSearch(req, res, next) {
  try {
    const { keyword, category, maxPricePaise } = req.body;
    const searchData = {
      id: `saved-${Date.now()}`,
      userId: req.user.uid,
      keyword: keyword || '',
      category: category || 'All',
      maxPricePaise: maxPricePaise ? Number(maxPricePaise) : null,
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConfigured && db) {
      await db.collection('savedSearches').doc(searchData.id).set(searchData);
    } else {
      mockSavedSearches.push(searchData);
    }

    res.status(201).json({ success: true, savedSearch: searchData });
  } catch (error) {
    next(error);
  }
}

export async function deleteSavedSearch(req, res, next) {
  try {
    const { id } = req.params;
    if (isFirebaseConfigured && db) {
      await db.collection('savedSearches').doc(id).delete();
    } else {
      const idx = mockSavedSearches.findIndex(s => s.id === id && s.userId === req.user.uid);
      if (idx >= 0) mockSavedSearches.splice(idx, 1);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

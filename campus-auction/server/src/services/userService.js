import { db, auth, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { mockUsers } from '../utils/mockStore.js';

/**
 * Checks if a string looks like a raw UID rather than a real human name.
 * e.g. "user_12345", "aZ89xK12...3", "user_test_buyer"
 */
export function isRawUidOrFake(name, uid) {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (uid && trimmed === uid) return true;
  if (trimmed === 'Campus Student' || trimmed === 'Campus Senior') return true;
  if (trimmed.startsWith('user_') && !trimmed.includes(' ')) return true;
  // Firebase UIDs are typically 28-char alphanumeric strings
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return true;
  return false;
}

/**
 * Formats a display name safely without inventing fake identities.
 * Shows "User" or "Profile incomplete" when no valid profile exists.
 */
export function formatDisplayName(name, uid) {
  if (!name || isRawUidOrFake(name, uid)) {
    return 'User';
  }
  return name.trim();
}

/**
 * Get a user's profile by UID.
 * Reads from Firestore 'users' collection, falls back to Firebase Auth record,
 * or mockUsers in local/test mode.
 */
export async function getUserProfile(uid) {
  if (!uid) return null;

  // 1. Check Firestore 'users' collection
  if (isFirebaseConfigured && db) {
    try {
      const docRef = db.collection('users').doc(uid);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const rawName = data.name || data.displayName || null;
        return {
          uid,
          name: rawName && !isRawUidOrFake(rawName, uid) ? rawName : null,
          email: data.email || null,
          campusYear: data.campusYear || '',
          hostel: data.hostel || '',
          createdAt: data.createdAt || null,
          profileIncomplete: !rawName || isRawUidOrFake(rawName, uid)
        };
      }
    } catch (err) {
      console.warn(`[UserService] Firestore read failed for user ${uid}:`, err.message);
    }

    // 2. Fall back to Firebase Auth record
    if (auth) {
      try {
        const userRecord = await auth.getUser(uid);
        const rawName = userRecord.displayName || null;
        return {
          uid,
          name: rawName && !isRawUidOrFake(rawName, uid) ? rawName : null,
          email: userRecord.email || null,
          campusYear: '',
          hostel: '',
          createdAt: userRecord.metadata?.creationTime || null,
          profileIncomplete: !rawName || isRawUidOrFake(rawName, uid)
        };
      } catch (authErr) {
        // User not in auth or deleted
      }
    }
  }

  // 3. Fall back to in-memory mockUsers (for local/test mode)
  const mock = mockUsers[uid];
  if (mock) {
    const rawName = mock.name || mock.displayName || null;
    return {
      uid,
      name: rawName && !isRawUidOrFake(rawName, uid) ? rawName : null,
      email: mock.email || null,
      campusYear: mock.campusYear || '',
      hostel: mock.hostel || '',
      createdAt: mock.createdAt || null,
      profileIncomplete: !rawName || isRawUidOrFake(rawName, uid)
    };
  }

  return {
    uid,
    name: null,
    email: null,
    campusYear: '',
    hostel: '',
    createdAt: null,
    profileIncomplete: true
  };
}

/**
 * Batch resolve display names for an array of UIDs.
 * Returns a map of { [uid]: formattedName }
 */
export async function getUsersMap(uids = []) {
  const uniqueUids = [...new Set(uids.filter(Boolean))];
  const map = {};

  if (uniqueUids.length === 0) return map;

  await Promise.all(
    uniqueUids.map(async (uid) => {
      try {
        const profile = await getUserProfile(uid);
        map[uid] = formatDisplayName(profile?.name, uid);
      } catch (err) {
        map[uid] = 'User';
      }
    })
  );

  return map;
}

/**
 * Upsert or update a user's profile in Firestore and Firebase Auth.
 */
export async function upsertUserProfile(uid, { name, campusYear, hostel, email }) {
  if (!uid) {
    const err = new Error('UID is required to update profile.');
    err.statusCode = 400;
    throw err;
  }

  const updates = {
    uid,
    updatedAt: new Date().toISOString()
  };

  if (name !== undefined) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      const err = new Error('Full name cannot be empty.');
      err.statusCode = 400;
      throw err;
    }
    updates.name = trimmed;
  }

  if (email !== undefined) updates.email = email;
  if (campusYear !== undefined) updates.campusYear = (campusYear || '').trim();
  if (hostel !== undefined) updates.hostel = (hostel || '').trim();

  // 1. Write to Firestore 'users' collection
  if (isFirebaseConfigured && db) {
    try {
      const docRef = db.collection('users').doc(uid);
      const existing = await docRef.get();
      if (!existing.exists) {
        updates.createdAt = new Date().toISOString();
      }
      await docRef.set(updates, { merge: true });
    } catch (err) {
      console.error(`[UserService] Firestore profile update failed for ${uid}:`, err.message);
      throw err;
    }

    // 2. Also update Firebase Auth displayName if name was updated
    if (auth && updates.name) {
      try {
        await auth.updateUser(uid, { displayName: updates.name });
      } catch (authErr) {
        console.warn(`[UserService] Firebase Auth displayName update warning:`, authErr.message);
      }
    }
  }

  // 3. Keep local mock store in sync
  mockUsers[uid] = {
    ...(mockUsers[uid] || {}),
    ...updates
  };

  return await getUserProfile(uid);
}

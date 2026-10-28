import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';

const SESSION_STORAGE_KEY = 'campusbid_session_user';

export function getStoredUser() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_e) {
      // ignore
    }
  }
  return null;
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export async function loginWithEmail(email, password) {
  if (isFirebaseConfigured && auth) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await fetchUserProfile(cred.user.uid);
    const sessionUser = {
      uid: cred.user.uid,
      email: cred.user.email,
      name: profile?.name || cred.user.displayName || null,
      displayName: profile?.name || cred.user.displayName || null,
      campusYear: profile?.campusYear || '',
      hostel: profile?.hostel || '',
      profileIncomplete: !profile?.name && !cred.user.displayName
    };
    setStoredUser(sessionUser);
    return cred.user;
  }

  // Local authentication session when Firebase is not connected
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const stored = getStoredUser();
  const user = {
    uid: stored?.uid || `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    name: stored?.name || null,
    displayName: stored?.name || null,
    campusYear: stored?.campusYear || '',
    hostel: stored?.hostel || '',
    profileIncomplete: !stored?.name
  };
  setStoredUser(user);
  return user;
}

export async function registerWithEmail(email, password, displayName, details = {}) {
  const trimmedName = (displayName || '').trim();

  if (isFirebaseConfigured && auth) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (trimmedName) {
      await updateProfile(cred.user, { displayName: trimmedName });
    }

    const userData = {
      uid: cred.user.uid,
      name: trimmedName || null,
      email: cred.user.email,
      campusYear: details.campusYear ? details.campusYear.trim() : '',
      hostel: details.hostel ? details.hostel.trim() : '',
      createdAt: new Date().toISOString()
    };

    if (db) {
      try {
        await setDoc(doc(db, 'users', cred.user.uid), userData, { merge: true });
      } catch (firestoreErr) {
        console.error('[authService] Failed to create user Firestore document:', firestoreErr.message);
      }
    }

    const sessionUser = {
      ...userData,
      displayName: trimmedName || null,
      profileIncomplete: !trimmedName
    };
    setStoredUser(sessionUser);
    return cred.user;
  }

  // Local registration session when Firebase is not connected
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const user = {
    uid: `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    name: trimmedName || null,
    displayName: trimmedName || null,
    campusYear: details.campusYear ? details.campusYear.trim() : '',
    hostel: details.hostel ? details.hostel.trim() : '',
    createdAt: new Date().toISOString(),
    profileIncomplete: !trimmedName
  };
  setStoredUser(user);
  return user;
}

export async function fetchUserProfile(uid) {
  if (!uid) return null;

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        return snap.data();
      }
    } catch (err) {
      console.warn('[authService] Firestore fetch user failed:', err.message);
    }
  }

  const stored = getStoredUser();
  if (stored && stored.uid === uid) {
    return stored;
  }

  return null;
}

export async function updateUserProfile(uid, { name, campusYear, hostel }) {
  if (!uid) throw new Error('User not authenticated.');
  const trimmedName = (name || '').trim();
  if (!trimmedName) throw new Error('Full name cannot be empty.');

  const updates = {
    uid,
    name: trimmedName,
    updatedAt: new Date().toISOString()
  };
  if (campusYear !== undefined) updates.campusYear = (campusYear || '').trim();
  if (hostel !== undefined) updates.hostel = (hostel || '').trim();

  // 1. Update Firestore
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'users', uid), updates, { merge: true });
    } catch (err) {
      console.error('[authService] Failed to update user profile in Firestore:', err.message);
      throw err;
    }
  }

  // 2. Update Firebase Auth displayName
  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      await updateProfile(auth.currentUser, { displayName: trimmedName });
    } catch (authErr) {
      console.warn('[authService] Failed to update Firebase auth displayName:', authErr.message);
    }
  }

  // 3. Update localStorage session
  const stored = getStoredUser() || {};
  const merged = { ...stored, ...updates, displayName: trimmedName, profileIncomplete: false };
  setStoredUser(merged);

  return merged;
}

export async function logoutUser() {
  if (isFirebaseConfigured && auth) {
    await signOut(auth);
  }
  setStoredUser(null);
}

export async function getAuthToken(currentUser) {
  if (isFirebaseConfigured && auth?.currentUser) {
    return await auth.currentUser.getIdToken();
  }
  if (currentUser?.uid) {
    return `demo_${currentUser.uid}`;
  }
  return null;
}

export function subscribeToAuth(callback) {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setStoredUser(null);
        callback(null);
        return;
      }

      // Resolve Firestore user profile
      let profile = null;
      if (db) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            profile = snap.data();
          } else if (firebaseUser.displayName) {
            // Existing user who had displayName in auth but no Firestore doc yet
            profile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName,
              email: firebaseUser.email,
              campusYear: '',
              hostel: '',
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), profile, { merge: true });
          }
        } catch (err) {
          console.warn('[authService] Error syncing user profile in auth listener:', err.message);
        }
      }

      const effectiveName = profile?.name || firebaseUser.displayName || null;
      const enrichedUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: effectiveName,
        name: effectiveName,
        campusYear: profile?.campusYear || '',
        hostel: profile?.hostel || '',
        profileIncomplete: !effectiveName,
        getIdToken: () => firebaseUser.getIdToken()
      };

      setStoredUser(enrichedUser);
      callback(enrichedUser);
    });
  }

  const activeUser = getStoredUser();
  callback(activeUser);
  return () => {};
}


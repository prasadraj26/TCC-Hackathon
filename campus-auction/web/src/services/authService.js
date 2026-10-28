import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

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
    return cred.user;
  }

  // Local authentication session when Firebase is not connected
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const user = {
    uid: `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    displayName: email.split('@')[0]
  };
  setStoredUser(user);
  return user;
}

export async function registerWithEmail(email, password, displayName, details = {}) {
  if (isFirebaseConfigured && auth) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    return cred.user;
  }

  // Local registration session when Firebase is not connected
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const user = {
    uid: `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    displayName: displayName || email.split('@')[0],
    campusYear: details.campusYear || '',
    hostel: details.hostel || ''
  };
  setStoredUser(user);
  return user;
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
    return onAuthStateChanged(auth, callback);
  }

  // Initialize with null or current active session (no auto-selection of demo users)
  const activeUser = getStoredUser();
  callback(activeUser);
  return () => {};
}

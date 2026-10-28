import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

export const DEMO_USERS = [
  {
    uid: 'user_alex_senior',
    email: 'alex.sharma@campus.edu',
    displayName: 'Alex Sharma',
    role: 'Graduating Senior (Seller)',
    campusYear: 'Final Year B.Tech CS',
    hostel: 'Hostel 4, Room 218'
  },
  {
    uid: 'user_priya_junior',
    email: 'priya.patel@campus.edu',
    displayName: 'Priya Patel',
    role: 'Junior Student (Buyer)',
    campusYear: '2nd Year Mechanical',
    hostel: 'Hostel 7, Room 104'
  },
  {
    uid: 'user_rohan_tech',
    email: 'rohan.verma@campus.edu',
    displayName: 'Rohan Verma',
    role: 'Tech Enthusiast (Bidder)',
    campusYear: '3rd Year Electrical',
    hostel: 'Hostel 2, Room 302'
  }
];

const DEMO_STORAGE_KEY = 'campusbid_demo_user';

export function getStoredDemoUser() {
  const raw = localStorage.getItem(DEMO_STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_e) {
      // ignore
    }
  }
  // Default demo user is Alex Sharma
  return DEMO_USERS[0];
}

export function setStoredDemoUser(user) {
  if (user) {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(DEMO_STORAGE_KEY);
  }
}

export async function loginWithEmail(email, password) {
  if (isFirebaseConfigured && auth) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  // Demo mode login
  const found = DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
  const user = found || {
    uid: `user_demo_${Date.now()}`,
    email,
    displayName: email.split('@')[0],
    campusYear: 'Campus Student',
    hostel: 'Campus Hostel'
  };
  setStoredDemoUser(user);
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

  // Demo mode register
  const user = {
    uid: `user_${Date.now()}`,
    email,
    displayName: displayName || email.split('@')[0],
    role: 'Campus Student',
    campusYear: details.campusYear || 'Campus Student',
    hostel: details.hostel || 'Hostel Block'
  };
  setStoredDemoUser(user);
  return user;
}

export async function logoutUser() {
  if (isFirebaseConfigured && auth) {
    await signOut(auth);
  }
  setStoredDemoUser(null);
}

export async function getAuthToken(currentUser) {
  if (isFirebaseConfigured && auth?.currentUser) {
    return await auth.currentUser.getIdToken();
  }
  if (currentUser) {
    return `demo_${currentUser.uid}`;
  }
  return null;
}

export function subscribeToAuth(callback) {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, callback);
  }

  // Demo mode initial trigger
  const demoUser = getStoredDemoUser();
  callback(demoUser);
  return () => {};
}

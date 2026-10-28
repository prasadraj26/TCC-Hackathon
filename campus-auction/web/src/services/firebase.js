import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

const isConfigured = Boolean(
  apiKey && 
  apiKey !== 'your-firebase-api-key' && 
  projectId && 
  projectId !== 'your-firebase-project-id'
);

let app = null;
let auth = null;
let db = null;

if (isConfigured) {
  try {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('[Firebase Client] Initialized successfully with project:', projectId);
  } catch (error) {
    console.warn('[Firebase Client] Initialization failed, falling back to Demo Mode:', error.message);
  }
} else {
  console.log('[Firebase Client] No live credentials configured. Running in Demo / Setup Mode.');
}

export { app, auth, db, isConfigured as isFirebaseConfigured };

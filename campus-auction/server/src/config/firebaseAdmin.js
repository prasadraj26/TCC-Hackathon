
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

let db = null;
let auth = null;
let isFirebaseConfigured = false;

const projectId = process.env.FIREBASE_PROJECT_ID;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const isTestEnv = process.env.NODE_ENV === 'test' || (process.argv[1] && process.argv[1].includes('test'));

try {
  if (isTestEnv) {
    console.log('[Firebase Admin] Running in isolated test mode (in-memory mock store).');
  } else if (getApps().length > 0) {
    const app = getApps()[0];
    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    auth = getAuth(app);
    isFirebaseConfigured = true;
    console.log('[Firebase Admin] Reusing existing Firebase app.');
  } else if (credPath && fs.existsSync(path.resolve(credPath))) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(path.resolve(credPath), 'utf8')
    );

    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId
    });

    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    auth = getAuth(app);
    isFirebaseConfigured = true;

    console.log('[Firebase Admin] Initialized with service account.');
  } else if (projectId && projectId !== 'your-firebase-project-id') {
    const app = initializeApp({
      credential: applicationDefault(),
      projectId
    });

    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    auth = getAuth(app);
    isFirebaseConfigured = true;

    console.log('[Firebase Admin] Initialized with Application Default Credentials.');
  } else {
    console.warn('[Firebase Admin] Credentials missing. Running in demo mode.');
  }
} catch (error) {
  console.error('[Firebase Admin] Initialization failed:', error.message);
  isFirebaseConfigured = false;
  db = null;
  auth = null;
}

export { db, auth, isFirebaseConfigured };

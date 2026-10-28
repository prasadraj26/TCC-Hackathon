import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

let db = null;
let auth = null;
let isFirebaseConfigured = false;

const projectId = process.env.FIREBASE_PROJECT_ID;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

try {
  if (credPath && fs.existsSync(path.resolve(credPath))) {
    const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(credPath), 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId
    });
    isFirebaseConfigured = true;
    console.log('[Firebase Admin] Successfully initialized with service account key.');
  } else if (projectId && projectId !== 'your-firebase-project-id') {
    admin.initializeApp({
      projectId: projectId
    });
    isFirebaseConfigured = true;
    console.log(`[Firebase Admin] Initialized with project ID: ${projectId}`);
  } else {
    console.warn('[Firebase Admin] No real Firebase credentials found. Running in Local/Demo Mode.');
  }

  if (isFirebaseConfigured) {
    db = admin.firestore();
    auth = admin.auth();
  }
} catch (error) {
  console.warn('[Firebase Admin] Initialization failed, falling back to Local/Demo Mode:', error.message);
  isFirebaseConfigured = false;
}

export { admin, db, auth, isFirebaseConfigured };

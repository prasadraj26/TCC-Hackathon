import { auth, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { mockUsers } from '../utils/mockStore.js';
import { getUserProfile, formatDisplayName } from '../services/userService.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const demoUserIdHeader = req.headers['x-demo-user-id'];

    if (!authHeader && !demoUserIdHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing Authorization header or demo identity.'
      });
    }

    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1].trim();
    }

    // 1. Production Firebase verification:
    // If Firebase is configured and a non-demo Bearer token is provided, verify it strictly.
    // Never trust client-provided x-demo-user-id when Firebase is configured.
    if (isFirebaseConfigured && auth && token && !token.startsWith('demo_')) {
      const decodedToken = await auth.verifyIdToken(token);
      const profile = await getUserProfile(decodedToken.uid);

      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || profile?.email || null,
        name: profile?.name || decodedToken.name || null,
        displayName: profile?.name ? formatDisplayName(profile.name, decodedToken.uid) : (decodedToken.name || null),
        campusYear: profile?.campusYear || '',
        hostel: profile?.hostel || '',
        isDemo: false
      };
      return next();
    }

    // 2. Local / Test Mode (when Firebase credentials are not configured or demo token is used)
    if (!isFirebaseConfigured || token?.startsWith('demo_')) {
      const demoUid = (token?.startsWith('demo_') ? token.replace('demo_', '') : null) || demoUserIdHeader;
      if (!demoUid) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required. Missing user identity.'
        });
      }

      const user = mockUsers[demoUid] || null;
      const profile = await getUserProfile(demoUid);

      req.user = {
        uid: demoUid,
        email: user?.email || profile?.email || `${demoUid}@campus.edu`,
        name: profile?.name || user?.name || null,
        displayName: profile?.name ? formatDisplayName(profile.name, demoUid) : null,
        campusYear: profile?.campusYear || user?.campusYear || '',
        hostel: profile?.hostel || user?.hostel || '',
        isDemo: true
      };
      return next();
    }

    // If Firebase is configured but token is missing or invalid
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing Firebase authentication token.'
    });
  } catch (error) {
    console.error('[Auth Middleware] Verification failed:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.',
      details: error.message
    });
  }
}


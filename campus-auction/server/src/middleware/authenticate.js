import { auth, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { mockUsers } from '../utils/mockStore.js';

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

    // Check for demo token or user header when in local/test Mode
    if (!isFirebaseConfigured || token?.startsWith('demo_') || demoUserIdHeader) {
      const demoUid = demoUserIdHeader || (token?.startsWith('demo_') ? token.replace('demo_', '') : null);
      if (!demoUid) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required. Missing user identity.'
        });
      }

      const user = mockUsers[demoUid] || {
        uid: demoUid,
        email: `${demoUid}@campus.edu`,
        displayName: demoUid.replace('user_', '').replace('_', ' ')
      };

      req.user = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.name || 'Campus Student',
        isDemo: true
      };
      return next();
    }

    // Production Firebase verification
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Authorization header format. Expected Bearer <token>.'
      });
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email.split('@')[0],
      isDemo: false
    };

    next();
  } catch (error) {
    console.error('[Auth Middleware] Verification failed:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.',
      details: error.message
    });
  }
}

import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getUserProfile, upsertUserProfile, formatDisplayName } from '../services/userService.js';

const router = express.Router();

/**
 * GET /api/users/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.user.uid);
    res.json({
      success: true,
      profile: {
        uid: req.user.uid,
        email: req.user.email,
        name: profile?.name || null,
        displayName: profile?.name ? formatDisplayName(profile.name, req.user.uid) : null,
        campusYear: profile?.campusYear || '',
        hostel: profile?.hostel || '',
        createdAt: profile?.createdAt || null,
        profileIncomplete: Boolean(profile?.profileIncomplete)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/me
 * Update the authenticated user's own profile (name, campusYear, hostel).
 */
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const { name, campusYear, hostel } = req.body;
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name cannot be empty.'
      });
    }

    const updated = await upsertUserProfile(req.user.uid, {
      name,
      campusYear,
      hostel,
      email: req.user.email
    });

    res.json({
      success: true,
      profile: {
        uid: req.user.uid,
        email: req.user.email,
        name: updated.name,
        displayName: formatDisplayName(updated.name, req.user.uid),
        campusYear: updated.campusYear,
        hostel: updated.hostel,
        createdAt: updated.createdAt,
        profileIncomplete: Boolean(updated.profileIncomplete)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:uid
 * Public lookup for safe display name of a seller or bidder.
 */
router.get('/:uid', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const profile = await getUserProfile(uid);

    res.json({
      success: true,
      user: {
        uid,
        name: profile?.name ? formatDisplayName(profile.name, uid) : 'User',
        displayName: profile?.name ? formatDisplayName(profile.name, uid) : 'User',
        campusYear: profile?.campusYear || '',
        hostel: profile?.hostel || ''
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

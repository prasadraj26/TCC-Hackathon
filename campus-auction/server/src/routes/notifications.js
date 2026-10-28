import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Notifications
router.get('/', authenticate, notificationController.getNotifications);
router.patch('/:id/read', authenticate, notificationController.markAsRead);

// Saved Searches
router.get('/saved-searches', authenticate, notificationController.getSavedSearches);
router.post('/saved-searches', authenticate, notificationController.createSavedSearch);
router.delete('/saved-searches/:id', authenticate, notificationController.deleteSavedSearch);

export default router;

import express from 'express';
import {
  getSchemes, getSchemeById, getNotifications, markNotificationRead,
  markAllRead, getUnreadCount, getRecommendations,
} from '../controllers/schemesController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Schemes
router.get('/schemes', getSchemes);
router.get('/schemes/:id', getSchemeById);

// Notifications
router.get('/notifications', getNotifications);
router.get('/notifications/count', getUnreadCount);
router.put('/notifications/:id/read', markNotificationRead);
router.put('/notifications/mark-all-read', markAllRead);

// Recommendations
router.get('/recommendations', getRecommendations);

export default router;

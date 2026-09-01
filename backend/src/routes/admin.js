import express from 'express';
import { getAdminStats, getAllFarmers, getMarketTrends } from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate, authorize('ADMIN', 'AGRICULTURE_OFFICER'));

router.get('/stats', getAdminStats);
router.get('/farmers', getAllFarmers);
router.get('/market-trends', getMarketTrends);

export default router;

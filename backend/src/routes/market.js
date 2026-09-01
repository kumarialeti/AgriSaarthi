import express from 'express';
import {
  getMarketPrices, calculateNetReturn, getMarkets, validateCalculator,
  getLiveMarketPrices,
} from '../controllers/marketController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/live', getLiveMarketPrices);
router.get('/prices', getMarketPrices);
router.get('/markets', getMarkets);
router.post('/calculate', validateCalculator, calculateNetReturn);

export default router;

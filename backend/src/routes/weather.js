import express from 'express';
import { getWeather, getWeatherByDistrict } from '../controllers/weatherController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', getWeather);
router.get('/district/:district/:state', getWeatherByDistrict);

export default router;

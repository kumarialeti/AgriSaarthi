import express from 'express';
import { analyzeCropImage, getHealthReports } from '../controllers/cropHealthController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadCropImage } from '../middleware/upload.js';

const router = express.Router();
router.use(authenticate);

router.post('/analyze', uploadCropImage, analyzeCropImage);
router.get('/reports', getHealthReports);

export default router;

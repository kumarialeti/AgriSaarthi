import express from 'express';
import {
  createSoilReport, uploadSoilReportFile, getMySoilReports, updateSoilReport, validateSoilManual,
} from '../controllers/soilController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadSoilReport } from '../middleware/upload.js';

const router = express.Router();
router.use(authenticate);

router.get('/', getMySoilReports);
router.post('/manual', validateSoilManual, createSoilReport);
router.post('/upload', uploadSoilReport, uploadSoilReportFile);
router.put('/:id', updateSoilReport);

export default router;

import express from 'express';
import {
  createOrUpdateFarmerProfile, getFarmerProfile, validateFarmerProfile,
  createCrop, getMyCrops, updateCrop, deleteCrop,
  getAllCrops, validateCrop,
  getFields, createField, updateField, deleteField
} from '../controllers/farmerController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);
// Controllers enforce owner-scoped access using req.user (matching farmer_id)

// Farmer profile
router.get('/profile', getFarmerProfile);
router.put('/profile', validateFarmerProfile, createOrUpdateFarmerProfile);

// Fields
router.get('/fields', getFields);
router.post('/fields', createField);
router.put('/fields/:id', updateField);
router.delete('/fields/:id', deleteField);

// Crops
router.get('/crops/all', getAllCrops);           // reference crop list
router.get('/crops', getMyCrops);
router.post('/crops', validateCrop, createCrop);
router.put('/crops/:id', validateCrop, updateCrop);
router.delete('/crops/:id', deleteCrop);

export default router;

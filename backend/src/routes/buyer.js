import express from 'express';
import {
  getBuyerProfile, createOrUpdateBuyerProfile, createRequirement, getMyRequirements,
  validateRequirement, getFarmerMatches, findCooperativeOpportunity,
} from '../controllers/buyerController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Buyer profile
router.get('/profile', authorize('BUYER'), getBuyerProfile);
router.put('/profile', authorize('BUYER'), createOrUpdateBuyerProfile);

// Requirements (buyer creates)
router.post('/requirements', authorize('BUYER'), validateRequirement, createRequirement);
router.get('/requirements', authorize('BUYER'), getMyRequirements);

// Open requirements (visible to farmers)
router.get('/open-requirements', async (req, res, next) => {
  try {
    const { query } = await import('../db/pool.js');
    const result = await query(
      `SELECT br.id, br.quantity_kg, br.desired_price_quintal, br.delivery_location,
              br.delivery_state, br.required_by, br.quality_specs, br.status,
              c.name_en as crop_name, c.name_te as crop_name_te,
              bp.full_name as buyer_name, bp.phone as buyer_phone, bp.company_name, bp.city, bp.is_verified
       FROM buyer_requirements br
       JOIN crops c ON c.id = br.crop_id
       JOIN buyer_profiles bp ON bp.id = br.buyer_id
       WHERE br.status = 'OPEN' ORDER BY br.created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// Matches
router.get('/matches', authorize('FARMER'), getFarmerMatches);
router.get('/cooperative/:buyer_req_id', findCooperativeOpportunity);

export default router;

import { body, validationResult } from 'express-validator';
import { query, withTransaction } from '../db/pool.js';
import { logger } from '../utils/logger.js';

// ─── Buyer Profile ─────────────────────────────────────────────
export const getBuyerProfile = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM buyer_profiles WHERE user_id=$1', [req.user.id]);
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) { next(err); }
};

export const createOrUpdateBuyerProfile = async (req, res, next) => {
  try {
    const { full_name, company_name, phone, gst_number, address, city, state } = req.body;
    const result = await query(
      `INSERT INTO buyer_profiles (user_id, full_name, company_name, phone, gst_number, address, city, state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id) DO UPDATE SET full_name=EXCLUDED.full_name, company_name=EXCLUDED.company_name,
       phone=EXCLUDED.phone, gst_number=EXCLUDED.gst_number, address=EXCLUDED.address,
       city=EXCLUDED.city, state=EXCLUDED.state, updated_at=NOW() RETURNING *`,
      [req.user.id, full_name, company_name, phone, gst_number, address, city, state]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─── Buyer Requirements ─────────────────────────────────────────
export const validateRequirement = [
  body('crop_id').isUUID(),
  body('quantity_kg').isFloat({ min: 1 }).withMessage('Quantity must be positive'),
  body('desired_price_quintal').optional().isFloat({ min: 0 }),
  body('required_by').optional().isISO8601(),
];

export const createRequirement = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const buyerRes = await query('SELECT id FROM buyer_profiles WHERE user_id=$1', [req.user.id]);
    if (!buyerRes.rows.length) {
      return res.status(400).json({ success: false, error: 'Complete your buyer profile first.' });
    }

    const { crop_id, quantity_kg, desired_price_quintal, delivery_location, delivery_state, required_by, quality_specs } = req.body;
    const result = await query(
      `INSERT INTO buyer_requirements (buyer_id, crop_id, quantity_kg, desired_price_quintal, delivery_location, delivery_state, required_by, quality_specs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [buyerRes.rows[0].id, crop_id, quantity_kg, desired_price_quintal, delivery_location, delivery_state, required_by, quality_specs]
    );

    // Trigger matching in background
    triggerMatchingAsync(result.rows[0]).catch((e) => logger.warn('Match trigger failed', { error: e.message }));

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

export const getMyRequirements = async (req, res, next) => {
  try {
    const buyerRes = await query('SELECT id FROM buyer_profiles WHERE user_id=$1', [req.user.id]);
    if (!buyerRes.rows.length) return res.json({ success: true, data: [] });

    const result = await query(
      `SELECT br.*, c.name_en as crop_name, c.name_te as crop_name_te
       FROM buyer_requirements br JOIN crops c ON c.id = br.crop_id
       WHERE br.buyer_id=$1 ORDER BY br.created_at DESC`,
      [buyerRes.rows[0].id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ─── Matching Algorithm ─────────────────────────────────────────
const triggerMatchingAsync = async (requirement) => {
  const { id: req_id, crop_id, quantity_kg, delivery_state, desired_price_quintal, required_by } = requirement;

  // Find farmers with same crop, growing/planned status
  const farmerCrops = await query(
    `SELECT fc.*, fp.district, fp.state, fp.user_id,
            fp.full_name, fp.phone, u.email
     FROM farmer_crops fc
     JOIN farmer_profiles fp ON fp.id = fc.farmer_id
     JOIN users u ON u.id = fp.user_id
     WHERE fc.crop_id = $1 AND fc.status IN ('GROWING','PLANNED')`,
    [crop_id]
  );

  for (const fc of farmerCrops.rows) {
    let score = 0;
    const factors = [];

    // Quantity compatibility (farmer acreage → estimated yield)
    const estimated_yield_kg = fc.acreage * 1500; // rough avg
    const qtyRatio = Math.min(estimated_yield_kg, quantity_kg) / Math.max(estimated_yield_kg, quantity_kg);
    score += qtyRatio * 30;
    factors.push({ factor: 'Quantity compatibility', weight: 30, value: Math.round(qtyRatio * 100) + '%' });

    // Location/state match
    if (fc.state === delivery_state || !delivery_state) {
      score += 25;
      factors.push({ factor: 'State match', weight: 25, value: fc.state });
    } else {
      score += 5;
      factors.push({ factor: 'Different state', weight: 5, value: `${fc.state} vs ${delivery_state}` });
    }

    // Timing match
    if (required_by && fc.expected_harvest_date) {
      const reqDate = new Date(required_by);
      const harvestDate = new Date(fc.expected_harvest_date);
      const diffDays = Math.abs((reqDate - harvestDate) / (1000 * 86400));
      const timingScore = Math.max(0, 25 - diffDays * 0.5);
      score += timingScore;
      factors.push({ factor: 'Harvest timing', weight: 25, value: `${Math.round(diffDays)} days difference` });
    } else {
      score += 12;
      factors.push({ factor: 'Timing unknown', weight: 12, value: 'Harvest date not specified' });
    }

    // Price compatibility
    if (desired_price_quintal) {
      score += 20;
      factors.push({ factor: 'Buyer has price requirement', weight: 20, value: `₹${desired_price_quintal}/quintal` });
    } else {
      score += 10;
    }

    const normalizedScore = Math.min(score, 100) / 100;

    // Insert match if score > 30%
    if (normalizedScore >= 0.30) {
      await query(
        `INSERT INTO farmer_buyer_matches (farmer_crop_id, buyer_req_id, match_score, explanation, factors, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         ON CONFLICT (farmer_crop_id, buyer_req_id) DO UPDATE SET match_score = EXCLUDED.match_score`,
        [fc.id, req_id, normalizedScore.toFixed(4), `Match score: ${Math.round(normalizedScore * 100)}%`, JSON.stringify(factors)]
      );
    }
  }

  logger.info('Matching completed for requirement', { req_id, matches: farmerCrops.rows.length });
};

// ─── Get matches for farmer ─────────────────────────────────────
export const getFarmerMatches = async (req, res, next) => {
  try {
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.json({ success: true, data: [] });

    const result = await query(
      `SELECT fbm.*, fc.acreage, fc.sowing_date,
              c.name_en as crop_name, br.quantity_kg, br.desired_price_quintal,
              br.delivery_location, br.required_by,
              bp.company_name as buyer_company, bp.city as buyer_city, bp.is_verified as buyer_verified
       FROM farmer_buyer_matches fbm
       JOIN farmer_crops fc ON fc.id = fbm.farmer_crop_id
       JOIN crops c ON c.id = fc.crop_id
       JOIN buyer_requirements br ON br.id = fbm.buyer_req_id
       JOIN buyer_profiles bp ON bp.id = br.buyer_id
       WHERE fc.farmer_id = $1
       ORDER BY fbm.match_score DESC LIMIT 50`,
      [farmerRes.rows[0].id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ─── Cooperative Selling ────────────────────────────────────────
export const findCooperativeOpportunity = async (req, res, next) => {
  try {
    const { buyer_req_id } = req.params;

    const reqRes = await query(
      'SELECT br.*, c.name_en as crop_name FROM buyer_requirements br JOIN crops c ON c.id = br.crop_id WHERE br.id=$1',
      [buyer_req_id]
    );
    if (!reqRes.rows.length) return res.status(404).json({ success: false, error: 'Requirement not found.' });

    const requirement = reqRes.rows[0];

    // Find all matched farmers
    const matchedFarmers = await query(
      `SELECT fbm.match_score, fc.acreage, fc.farmer_id, fc.id as farmer_crop_id,
              fp.full_name, fp.village, fp.district, fc.crop_id, fc.expected_harvest_date
       FROM farmer_buyer_matches fbm
       JOIN farmer_crops fc ON fc.id = fbm.farmer_crop_id
       JOIN farmer_profiles fp ON fp.id = fc.farmer_id
       WHERE fbm.buyer_req_id=$1 AND fbm.status='PENDING'
       ORDER BY fbm.match_score DESC`,
      [buyer_req_id]
    );

    let total_kg = 0;
    const participating = [];

    for (const farmer of matchedFarmers.rows) {
      if (total_kg >= requirement.quantity_kg) break;
      const farmer_yield_kg = farmer.acreage * 1500; // estimated
      const contribution_kg = Math.min(farmer_yield_kg, requirement.quantity_kg - total_kg);
      total_kg += contribution_kg;
      participating.push({ ...farmer, estimated_contribution_kg: Math.round(contribution_kg) });
    }

    const cooperative_possible = total_kg >= requirement.quantity_kg * 0.8; // 80% threshold
    const transport_est = participating.length * 2000; // ₹2000 per farmer estimated
    const gross_revenue_est = (requirement.desired_price_quintal || 5000) * (total_kg / 100);
    const net_return_est = gross_revenue_est - transport_est;

    res.json({
      success: true,
      data: {
        requirement,
        cooperative_possible,
        participating_farmers: participating,
        combined_quantity_kg: Math.round(total_kg),
        required_quantity_kg: requirement.quantity_kg,
        fulfillment_pct: Math.round((total_kg / requirement.quantity_kg) * 100),
        estimated_transport_cost: transport_est,
        estimated_gross_revenue: Math.round(gross_revenue_est),
        estimated_net_return: Math.round(net_return_est),
        note: 'All values are estimates. Actual amounts depend on final yields and negotiated prices.',
      },
    });
  } catch (err) { next(err); }
};

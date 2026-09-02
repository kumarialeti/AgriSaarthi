import { body, validationResult } from 'express-validator';
import { query } from '../db/pool.js';
import { logger } from '../utils/logger.js';

// ─── Farmer Profile ──────────────────────────────────────────────
export const validateFarmerProfile = [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('phone').optional({ checkFalsy: true }).matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian phone number'),
  body('total_land_acres').optional({ checkFalsy: true }).isFloat({ min: 0.1, max: 9999 }).withMessage('Invalid land area'),
];

export const createOrUpdateFarmerProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { full_name, village, mandal, district, state, pincode, farming_preference } = req.body;
    let { phone, total_land_acres, location_lat, location_lng, farming_experience_years } = req.body;
    
    // Convert empty strings to null
    if (phone === '') phone = null;
    if (total_land_acres === '') total_land_acres = null;
    if (location_lat === '') location_lat = null;
    if (location_lng === '') location_lng = null;
    if (farming_experience_years === '') farming_experience_years = null;

    const userId = req.user.id;

    const result = await query(
      `INSERT INTO farmer_profiles (user_id, full_name, phone, village, mandal, district, state, pincode, total_land_acres, location_lat, location_lng, farming_experience_years, farming_preference)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = EXCLUDED.full_name, phone = EXCLUDED.phone,
         village = EXCLUDED.village, mandal = EXCLUDED.mandal,
         district = EXCLUDED.district, state = EXCLUDED.state,
         pincode = EXCLUDED.pincode, total_land_acres = EXCLUDED.total_land_acres,
         location_lat = EXCLUDED.location_lat, location_lng = EXCLUDED.location_lng,
         farming_experience_years = EXCLUDED.farming_experience_years, farming_preference = EXCLUDED.farming_preference,
         updated_at = NOW()
       RETURNING *`,
      [userId, full_name, phone, village, mandal, district, state, pincode, total_land_acres, location_lat, location_lng, farming_experience_years, farming_preference]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

export const getFarmerProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT fp.*, u.email, u.language FROM farmer_profiles fp
       JOIN users u ON u.id = fp.user_id WHERE fp.user_id = $1`,
      [userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Farmer profile not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─── Farmer Crops ─────────────────────────────────────────────────
export const validateCrop = [
  body('crop_id').isUUID().withMessage('Valid crop_id required'),
  body('acreage').isFloat({ min: 0.1 }).withMessage('Valid acreage required'),
  body('status').optional().isIn(['PLANNED','GROWING','HARVESTED','FAILED']),
  body('irrigation_type').optional().isIn(['Drip','Flood','Sprinkler','Rainfed','Canal','Borewell']),
];

export const createCrop = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) {
      return res.status(400).json({ success: false, error: 'Complete your farmer profile first.' });
    }

    const { crop_id, acreage, status, notes } = req.body;
    let { sowing_date, expected_harvest_date, irrigation_type, soil_type, field_id, variety, growth_stage, previous_crop } = req.body;
    
    if (sowing_date === '') sowing_date = null;
    if (expected_harvest_date === '') expected_harvest_date = null;
    if (irrigation_type === '') irrigation_type = null;
    if (soil_type === '') soil_type = null;
    if (field_id === '') field_id = null;
    if (variety === '') variety = null;
    if (growth_stage === '') growth_stage = null;
    if (previous_crop === '') previous_crop = null;

    const farmerId = farmerRes.rows[0].id;

    const result = await query(
      `INSERT INTO farmer_crops (farmer_id, crop_id, acreage, sowing_date, expected_harvest_date, irrigation_type, soil_type, status, notes, field_id, variety, growth_stage, previous_crop)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [farmerId, crop_id, acreage, sowing_date, expected_harvest_date, irrigation_type, soil_type, status || 'PLANNED', notes, field_id, variety, growth_stage, previous_crop]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

export const getMyCrops = async (req, res, next) => {
  try {
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.json({ success: true, data: [] });

    const result = await query(
      `SELECT fc.*, c.name_en, c.name_te, c.name_hi, c.category, c.season, f.name as field_name
       FROM farmer_crops fc 
       JOIN crops c ON c.id = fc.crop_id
       LEFT JOIN fields f ON f.id = fc.field_id
       WHERE fc.farmer_id = $1 ORDER BY fc.created_at DESC`,
      [farmerRes.rows[0].id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

export const updateCrop = async (req, res, next) => {
  try {
    const { id } = req.params;
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.status(404).json({ success: false, error: 'Profile not found.' });

    const { acreage, status, notes } = req.body;
    let { sowing_date, expected_harvest_date, irrigation_type, soil_type, field_id, variety, growth_stage, previous_crop } = req.body;
    
    if (sowing_date === '') sowing_date = null;
    if (expected_harvest_date === '') expected_harvest_date = null;
    if (irrigation_type === '') irrigation_type = null;
    if (soil_type === '') soil_type = null;
    if (field_id === '') field_id = null;
    if (variety === '') variety = null;
    if (growth_stage === '') growth_stage = null;
    if (previous_crop === '') previous_crop = null;
    const result = await query(
      `UPDATE farmer_crops SET acreage=$1, sowing_date=$2, expected_harvest_date=$3,
       irrigation_type=$4, soil_type=$5, status=$6, notes=$7, field_id=$8, variety=$9, growth_stage=$10, previous_crop=$11, updated_at=NOW()
       WHERE id=$12 AND farmer_id=$13 RETURNING *`,
      [acreage, sowing_date, expected_harvest_date, irrigation_type, soil_type, status, notes, field_id, variety, growth_stage, previous_crop, id, farmerRes.rows[0].id]
    );

    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Crop record not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

export const deleteCrop = async (req, res, next) => {
  try {
    const { id } = req.params;
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.status(404).json({ success: false, error: 'Profile not found.' });

    await query('DELETE FROM farmer_crops WHERE id=$1 AND farmer_id=$2', [id, farmerRes.rows[0].id]);
    res.json({ success: true, message: 'Crop deleted.' });
  } catch (err) { next(err); }
};

// ─── Reference: All Crops ─────────────────────────────────────────
export const getAllCrops = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM crops WHERE is_active = true ORDER BY name_en');
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ─── Fields ───────────────────────────────────────────────────────
export const getFields = async (req, res, next) => {
  try {
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.json({ success: true, data: [] });

    const result = await query(
      `SELECT * FROM fields WHERE farmer_id = $1 ORDER BY created_at DESC`,
      [farmerRes.rows[0].id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

export const createField = async (req, res, next) => {
  try {
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.status(400).json({ success: false, error: 'Complete your farmer profile first.' });

    const { name, area, area_unit, location_lat, location_lng, soil_type, soil_ph, irrigation_source, notes } = req.body;
    
    if (!name || !area) return res.status(400).json({ success: false, error: 'Name and area are required.' });

    const result = await query(
      `INSERT INTO fields (farmer_id, name, area, area_unit, location_lat, location_lng, soil_type, soil_ph, irrigation_source, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [farmerRes.rows[0].id, name, area, area_unit || 'Acres', location_lat, location_lng, soil_type, soil_ph, irrigation_source, notes]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

export const updateField = async (req, res, next) => {
  try {
    const { id } = req.params;
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.status(404).json({ success: false, error: 'Profile not found.' });

    const { name, area, area_unit, location_lat, location_lng, soil_type, soil_ph, irrigation_source, notes } = req.body;

    const result = await query(
      `UPDATE fields SET name=$1, area=$2, area_unit=$3, location_lat=$4, location_lng=$5, soil_type=$6, soil_ph=$7, irrigation_source=$8, notes=$9, updated_at=NOW()
       WHERE id=$10 AND farmer_id=$11 RETURNING *`,
      [name, area, area_unit, location_lat, location_lng, soil_type, soil_ph, irrigation_source, notes, id, farmerRes.rows[0].id]
    );

    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Field not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

export const deleteField = async (req, res, next) => {
  try {
    const { id } = req.params;
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.status(404).json({ success: false, error: 'Profile not found.' });

    await query('DELETE FROM fields WHERE id=$1 AND farmer_id=$2', [id, farmerRes.rows[0].id]);
    res.json({ success: true, message: 'Field deleted.' });
  } catch (err) { next(err); }
};

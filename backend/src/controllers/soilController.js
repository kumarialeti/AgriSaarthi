import { body, validationResult } from 'express-validator';
import { query } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';
import path from 'path';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

export const validateSoilManual = [
  body('ph').isFloat({ min: 0, max: 14 }).withMessage('pH must be between 0 and 14'),
  body('nitrogen_kg_ha').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Nitrogen must be positive'),
  body('phosphorus_kg_ha').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body('potassium_kg_ha').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body('organic_carbon_pct').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }),
  body('ec_ds_m').optional({ checkFalsy: true }).isFloat({ min: 0 }),
];

// ─── Manual soil entry ─────────────────────────────────────────
export const createSoilReport = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) {
      return res.status(400).json({ success: false, error: 'Complete your farmer profile first.' });
    }

    const { ph, farmer_crop_id } = req.body;
    let { nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_pct, ec_ds_m } = req.body;
    
    if (nitrogen_kg_ha === '') nitrogen_kg_ha = null;
    if (phosphorus_kg_ha === '') phosphorus_kg_ha = null;
    if (potassium_kg_ha === '') potassium_kg_ha = null;
    if (organic_carbon_pct === '') organic_carbon_pct = null;
    if (ec_ds_m === '') ec_ds_m = null;

    const farmerId = farmerRes.rows[0].id;

    const result = await query(
      `INSERT INTO soil_reports (farmer_id, farmer_crop_id, ph, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_pct, ec_ds_m, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'manual') RETURNING *`,
      [farmerId, farmer_crop_id || null, ph, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_pct, ec_ds_m]
    );

    const soilReport = result.rows[0];

    // Request AI analysis (non-blocking — best effort)
    try {
      const aiRes = await axios.post(`${AI_SERVICE_URL}/ai/soil-analysis`, {
        soil_data: soilReport,
        language: req.user.language || 'en',
      }, { timeout: 30000 });

      if (aiRes.data?.analysis) {
        await query('UPDATE soil_reports SET ai_analysis=$1 WHERE id=$2', [aiRes.data.analysis, soilReport.id]);
        soilReport.ai_analysis = aiRes.data.analysis;
      }
    } catch (aiErr) {
      logger.warn('AI soil analysis unavailable', { error: aiErr.message });
    }

    res.status(201).json({ success: true, data: soilReport });
  } catch (err) { next(err); }
};

// ─── Soil report upload + extraction ──────────────────────────
export const uploadSoilReportFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) {
      return res.status(400).json({ success: false, error: 'Complete your farmer profile first.' });
    }

    const fileUrl = `/uploads/documents/${path.basename(req.file.path)}`;

    // Request text extraction from AI service
    let extractedData = {};
    try {
      const aiRes = await axios.post(`${AI_SERVICE_URL}/ai/extract-soil-report`, {
        file_path: req.file.path,
        mime_type: req.file.mimetype,
      }, { timeout: 45000 });

      extractedData = aiRes.data?.extracted || {};
    } catch (aiErr) {
      logger.warn('Soil report extraction unavailable', { error: aiErr.message });
    }

    const result = await query(
      `INSERT INTO soil_reports (farmer_id, ph, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_pct, ec_ds_m, upload_url, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'upload') RETURNING *`,
      [
        farmerRes.rows[0].id,
        extractedData.ph || null,
        extractedData.nitrogen_kg_ha || null,
        extractedData.phosphorus_kg_ha || null,
        extractedData.potassium_kg_ha || null,
        extractedData.organic_carbon_pct || null,
        extractedData.ec_ds_m || null,
        fileUrl,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      extracted: extractedData,
      message: 'Soil report uploaded. Please verify the extracted values.',
    });
  } catch (err) { next(err); }
};

// ─── Get soil reports ──────────────────────────────────────────
export const getMySoilReports = async (req, res, next) => {
  try {
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.json({ success: true, data: [] });

    const result = await query(
      `SELECT sr.*, fc.crop_id, c.name_en as crop_name
       FROM soil_reports sr
       LEFT JOIN farmer_crops fc ON fc.id = sr.farmer_crop_id
       LEFT JOIN crops c ON c.id = fc.crop_id
       WHERE sr.farmer_id = $1 ORDER BY sr.created_at DESC`,
      [farmerRes.rows[0].id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ─── Update soil values (after upload verification) ────────────
export const updateSoilReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ph } = req.body;
    let { nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_pct, ec_ds_m } = req.body;
    
    if (nitrogen_kg_ha === '') nitrogen_kg_ha = null;
    if (phosphorus_kg_ha === '') phosphorus_kg_ha = null;
    if (potassium_kg_ha === '') potassium_kg_ha = null;
    if (organic_carbon_pct === '') organic_carbon_pct = null;
    if (ec_ds_m === '') ec_ds_m = null;
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);

    const result = await query(
      `UPDATE soil_reports SET ph=$1, nitrogen_kg_ha=$2, phosphorus_kg_ha=$3, potassium_kg_ha=$4,
       organic_carbon_pct=$5, ec_ds_m=$6, updated_at=NOW()
       WHERE id=$7 AND farmer_id=$8 RETURNING *`,
      [ph, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_pct, ec_ds_m, id, farmerRes.rows[0].id]
    );

    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Soil report not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

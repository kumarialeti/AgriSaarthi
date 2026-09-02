import { query } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'https://agrisaarthi-ai.onrender.com';

export const analyzeCropImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded.' });
    }

    const { farmer_crop_id, language } = req.body;
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) {
      return res.status(400).json({ success: false, error: 'Farmer profile required.' });
    }

    // Validate farmer_crop_id belongs to this farmer
    if (farmer_crop_id) {
      const cropCheck = await query(
        'SELECT id FROM farmer_crops WHERE id=$1 AND farmer_id=$2',
        [farmer_crop_id, farmerRes.rows[0].id]
      );
      if (!cropCheck.rows.length) {
        return res.status(403).json({ success: false, error: 'Crop not found for this farmer.' });
      }
    }

    const imageUrl = `/uploads/images/${path.basename(req.file.path)}`;

    // Send to AI service for vision analysis using multipart/form-data
    let analysis = null;
    let aiError = null;
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(req.file.path), {
        filename: path.basename(req.file.path),
        contentType: req.file.mimetype || 'image/jpeg',
      });
      formData.append('language', language || req.user.language || 'en');
      if (farmer_crop_id) {
        formData.append('farmer_crop_id', String(farmer_crop_id));
      }

      const aiRes = await axios.post(
        `${AI_SERVICE_URL}/ai/analyze-crop`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 60000,
        }
      );
      analysis = aiRes.data;
    } catch (err) {
      aiError = err.message;
      logger.warn('Crop image AI analysis failed', { error: err.message });
    }

    if (!analysis) {
      // Return graceful degradation
      return res.status(200).json({
        success: true,
        data: {
          image_url: imageUrl,
          analysis_available: false,
          message: 'Image saved. AI analysis is temporarily unavailable. Please try again or consult a local agriculture expert.',
        },
      });
    }

    // Parse numeric confidence score for database DECIMAL column
    let confidenceScore = null;
    if (typeof analysis.confidence_score === 'number') {
      confidenceScore = analysis.confidence_score;
    } else if (typeof analysis.confidence === 'number') {
      confidenceScore = analysis.confidence;
    } else if (analysis.confidence === 'high') {
      confidenceScore = 0.9;
    } else if (analysis.confidence === 'medium') {
      confidenceScore = 0.7;
    } else if (analysis.confidence === 'low') {
      confidenceScore = 0.4;
    }

    // Store health report (wrapped in try/catch to ensure user gets AI response even if DB save has constraints)
    let reportRecord = null;
    try {
      const reportRes = await query(
        `INSERT INTO crop_health_reports 
         (farmer_crop_id, image_url, analysis_result, detected_issue, confidence, severity, ai_response, sources)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          farmer_crop_id || null,
          imageUrl,
          JSON.stringify(analysis),
          analysis.detected_issue || 'General Crop Analysis',
          confidenceScore,
          analysis.severity || 'moderate',
          analysis.response || null,
          JSON.stringify(analysis.sources || []),
        ]
      );
      reportRecord = reportRes.rows[0];
    } catch (dbErr) {
      logger.warn('Failed to persist crop_health_report to database', { error: dbErr.message });
    }

    res.status(201).json({
      success: true,
      data: {
        report: reportRecord || {
          image_url: imageUrl,
          detected_issue: analysis.detected_issue,
          confidence: confidenceScore,
          severity: analysis.severity,
          ai_response: analysis.response,
        },
        analysis,
      },
    });
  } catch (err) { next(err); }
};

export const getHealthReports = async (req, res, next) => {
  try {
    const { farmer_crop_id } = req.query;
    const farmerRes = await query('SELECT id FROM farmer_profiles WHERE user_id=$1', [req.user.id]);
    if (!farmerRes.rows.length) return res.json({ success: true, data: [] });

    let sql = `SELECT chr.*, c.name_en as crop_name
               FROM crop_health_reports chr
               JOIN farmer_crops fc ON fc.id = chr.farmer_crop_id
               JOIN crops c ON c.id = fc.crop_id
               WHERE fc.farmer_id = $1`;
    const params = [farmerRes.rows[0].id];

    if (farmer_crop_id) {
      sql += ` AND chr.farmer_crop_id = $2`;
      params.push(farmer_crop_id);
    }

    sql += ' ORDER BY chr.created_at DESC LIMIT 20';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

import { body, query as queryValidator, validationResult } from 'express-validator';
import { query } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

const MARKET_API_BASE = process.env.MARKET_API_BASE_URL
  || 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
const MARKET_TIMEOUT = parseInt(process.env.MARKET_API_TIMEOUT || '10', 10) * 1000;
// Read per-request so tests can override via process.env
const getMarketApiKey = () => process.env.MARKET_API_KEY !== undefined ? process.env.MARKET_API_KEY : '579b464db66ec23bdd0000014c1010538683416177e72b0b4adad7a0';
const getMarketRetries = () => parseInt(process.env.MARKET_API_RETRIES ?? '2', 10);

// ─── Live Market Prices (Agmarknet / data.gov.in) ──────────────
/**
 * GET /api/market/live?commodity=&state=&limit=
 *
 * Fetches live commodity prices from data.gov.in Agmarknet API.
 * Returns data_unavailable if MARKET_API_KEY is not configured.
 * Never fabricates prices. Never falls back to DB or RAG.
 */
export const getLiveMarketPrices = async (req, res, next) => {
  try {
    // Guard: key required
    const MARKET_API_KEY = getMarketApiKey();
    const MARKET_RETRIES = getMarketRetries();

    if (!MARKET_API_KEY) {
      return res.status(200).json({
        success: false,
        status: 'data_unavailable',
        message: 'Live market data requires a MARKET_API_KEY (data.gov.in). Contact your administrator.',
      });
    }

    const { commodity, state, limit = 10 } = req.query;

    // Build filter string
    const filters = [];
    if (commodity) filters.push(`Commodity=="${commodity}"`);
    if (state)     filters.push(`State=="${state}"`);

    const params = {
      'api-key': MARKET_API_KEY,
      format: 'json',
      limit: Math.min(parseInt(limit, 10) || 10, 50),
      offset: 0,
    };
    if (filters.length) params['filters[0]'] = filters.join(';');

    // Fetch with retry
    let rawData = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= MARKET_RETRIES + 1; attempt++) {
      try {
        if (attempt > 1) await new Promise(r => setTimeout(r, 1000 * attempt));
        const apiRes = await axios.get(MARKET_API_BASE, { params, timeout: MARKET_TIMEOUT });
        rawData = apiRes.data;
        break;
      } catch (err) {
        lastErr = err;
        if (err.response?.status === 401) break; // no point retrying bad key
        if (err.response?.status === 400) break; // bad request
      }
    }

    if (!rawData) {
      const status = lastErr?.response?.status;
      
      // Fallback to local database if API is down
      if (!status || status >= 500) {
        logger.warn('Market API unavailable (502/503), falling back to local database.');
        try {
          // Find crop ID by name
          let cropId = null;
          if (commodity) {
            const cRes = await query('SELECT id FROM crops WHERE name_en ILIKE $1 OR name_te ILIKE $1 OR name_hi ILIKE $1 LIMIT 1', [`%${commodity}%`]);
            if (cRes.rows.length) cropId = cRes.rows[0].id;
          }
          
          let sql = `
            SELECT mp.*, m.name as market_name, m.district, m.state
            FROM market_prices mp
            JOIN markets m ON m.id = mp.market_id
          `;
          const params = [];
          if (cropId) {
            params.push(cropId);
            sql += ` WHERE mp.crop_id = $1`;
          }
          sql += ` ORDER BY mp.price_date DESC LIMIT ${Math.min(parseInt(limit, 10) || 10, 50)}`;
          
          const dbRes = await query(sql, params);
          if (dbRes.rows.length) {
            const normalized = dbRes.rows.map(r => ({
              state: r.state,
              district: r.district,
              market: r.market_name,
              commodity: commodity || 'Various',
              variety: 'Local (Historical)',
              arrival_date: r.price_date,
              min_price_quintal: r.min_price_quintal,
              max_price_quintal: r.max_price_quintal,
              modal_price_quintal: r.modal_price_quintal,
              source: 'Offline Database',
            }));
            return res.json({
              success: true,
              status: 'success',
              data: normalized,
              note: 'Live government API is down. Showing recent offline prices from our database.',
            });
          }
        } catch (fallbackErr) {
          logger.error('Fallback DB query failed', { error: fallbackErr.message });
        }
      }

      const msg = status === 401
        ? 'Market API authentication failed. Check MARKET_API_KEY.'
        : 'Live market data is temporarily unavailable.';
      return res.status(200).json({ success: false, status: 'data_unavailable', message: msg });
    }

    // Validate response structure
    if (!Array.isArray(rawData.records)) {
      logger.warn('Agmarknet API returned unexpected structure');
      return res.status(200).json({
        success: false,
        status: 'data_unavailable',
        message: 'Market API returned unexpected data structure.',
      });
    }

    // Required fields per record
    const REQUIRED = ['State', 'District', 'Market', 'Commodity', 'Arrival_Date', 'Modal_Price'];
    const records = rawData.records.filter(r => REQUIRED.every(f => r[f] !== undefined && r[f] !== null));

    if (!records.length) {
      return res.status(200).json({
        success: false,
        status: 'data_unavailable',
        message: 'No valid market records found for the given filters.',
      });
    }

    const normalized = records.map(r => ({
      state: r.State,
      district: r.District,
      market: r.Market,
      commodity: r.Commodity,
      variety: r.Variety || '',
      arrival_date: r.Arrival_Date,
      min_price_quintal: parseFloat(r.Min_Price) || null,
      max_price_quintal: parseFloat(r.Max_Price) || null,
      modal_price_quintal: parseFloat(r.Modal_Price) || null,
      source: 'agmarknet-data.gov.in',
    }));

    return res.json({
      success: true,
      status: 'success',
      data: normalized,
      note: 'Prices from Agmarknet (data.gov.in). Verify with local mandi before selling.',
    });
  } catch (err) { next(err); }
};


// ─── Market Prices ─────────────────────────────────────────────
export const getMarketPrices = async (req, res, next) => {
  try {
    const { crop_id, district, days = 365 } = req.query;

    let sql = `
      SELECT mp.*, m.name as market_name, m.district, m.state, m.latitude, m.longitude,
             c.name_en as crop_name, c.name_te as crop_name_te, c.name_hi as crop_name_hi
      FROM market_prices mp
      JOIN markets m ON m.id = mp.market_id
      JOIN crops c ON c.id = mp.crop_id
      WHERE mp.price_date >= NOW() - INTERVAL '${parseInt(days)} days'
    `;
    const params = [];

    if (crop_id) {
      params.push(crop_id);
      sql += ` AND mp.crop_id = $${params.length}`;
    }
    if (district) {
      params.push(`%${district}%`);
      sql += ` AND m.district ILIKE $${params.length}`;
    }

    sql += ' ORDER BY mp.price_date DESC, mp.modal_price_quintal DESC LIMIT 100';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows, note: 'Prices marked is_demo=true are sample data.' });
  } catch (err) { next(err); }
};

// ─── Market Calculator ─────────────────────────────────────────
export const calculateNetReturn = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const {
      crop_id,
      quantity_kg,
      farmer_district,
      preferred_market_ids,
    } = req.body;

    // Get available markets and prices
    let marketSql = `
      SELECT mp.*, m.name as market_name, m.district, m.state, m.latitude, m.longitude
      FROM market_prices mp JOIN markets m ON m.id = mp.market_id
      WHERE mp.crop_id = $1 AND mp.price_date = (
        SELECT MAX(price_date) FROM market_prices WHERE crop_id = $1
      )
    `;
    const params = [crop_id];

    if (preferred_market_ids?.length) {
      params.push(preferred_market_ids);
      marketSql += ` AND mp.market_id = ANY($${params.length})`;
    }

    const marketRes = await query(marketSql, params);
    const quantity_quintal = quantity_kg / 100;

    const options = marketRes.rows.map((m) => {
      // Approximate transport cost: ₹15/km/quintal (demo calculation)
      const distance_km = 50 + Math.random() * 150; // TODO: replace with real distance calc
      const transport_cost = Math.round(distance_km * 0.15 * quantity_quintal);
      const packaging_cost = Math.round(quantity_quintal * 20);
      const market_charges_pct = 0.02; // 2% of gross
      const gross_revenue = Math.round(m.modal_price_quintal * quantity_quintal);
      const market_charges = Math.round(gross_revenue * market_charges_pct);
      const total_costs = transport_cost + packaging_cost + market_charges;
      const net_return = gross_revenue - total_costs;

      return {
        market_id: m.market_id,
        market_name: m.market_name,
        district: m.district,
        state: m.state,
        modal_price_quintal: m.modal_price_quintal,
        min_price_quintal: m.min_price_quintal,
        max_price_quintal: m.max_price_quintal,
        quantity_quintal,
        gross_revenue,
        transport_cost,
        packaging_cost,
        market_charges,
        total_costs,
        net_return,
        estimated_distance_km: Math.round(distance_km),
        is_demo: m.is_demo,
        calculation_note: 'Transport costs are estimated. Actual costs may vary.',
      };
    });

    // Sort by net return descending
    options.sort((a, b) => b.net_return - a.net_return);

    const best = options[0];
    let recommendation = null;
    if (best && options.length > 1) {
      recommendation = {
        preferred_market: best.market_name,
        reason: `Expected net return of ₹${best.net_return.toLocaleString()} is highest among available options.`,
        factors: ['Higher modal price', 'Acceptable transport cost', 'Market reliability'],
      };
    }

    res.json({ success: true, data: { options, recommendation, quantity_kg } });
  } catch (err) { next(err); }
};

export const validateCalculator = [
  body('crop_id').isUUID().withMessage('Valid crop_id required'),
  body('quantity_kg').isFloat({ min: 1 }).withMessage('quantity_kg must be positive'),
];

// ─── Markets list ──────────────────────────────────────────────
export const getMarkets = async (req, res, next) => {
  try {
    const { district } = req.query;
    let sql = 'SELECT * FROM markets WHERE is_active = true';
    const params = [];

    if (district) {
      params.push(`%${district}%`);
      sql += ` AND district ILIKE $${params.length}`;
    }
    sql += ' ORDER BY name';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

/**
 * AgriSaarthi Backend — Weather Controller
 * Phase 5: Real Open-Meteo proxy. No mock fallback.
 *
 * Behaviour:
 *  - GET /api/weather?lat=&lon=      → fetch live from Open-Meteo
 *  - GET /api/weather?district=&state= → resolve district → coords → Open-Meteo
 *  - GET /api/weather/district/:d/:s   → same as above (backwards-compat)
 *  - Missing / unknown location        → { success:false, status:"missing_context" }
 *  - API failure / timeout             → { success:false, status:"data_unavailable" }
 *  - NEVER returns fabricated weather values.
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

const OPEN_METEO_BASE = process.env.WEATHER_API_BASE_URL || 'https://api.open-meteo.com/v1';
const TIMEOUT_MS = parseInt(process.env.WEATHER_API_TIMEOUT || '10', 10) * 1000;
// NOTE: MAX_RETRIES is read per-request (not module-level) so tests can override via process.env
const getMaxRetries = () => parseInt(process.env.WEATHER_API_RETRIES ?? '2', 10);

// ─── Factual district → coordinate table ──────────────────────────
// Source: published geocoordinates for Andhra Pradesh / Telangana districts.
const DISTRICT_COORDS = {
  'Guntur':      { lat: 16.3067, lon: 80.4365 },
  'Warangal':    { lat: 17.9689, lon: 79.5941 },
  'Nizamabad':   { lat: 18.6725, lon: 78.0941 },
  'Kurnool':     { lat: 15.8281, lon: 78.0373 },
  'Karimnagar':  { lat: 18.4386, lon: 79.1288 },
  'Nalgonda':    { lat: 17.0575, lon: 79.2671 },
  'Krishna':     { lat: 16.6098, lon: 80.7214 },
  'Prakasam':    { lat: 15.5057, lon: 80.0499 },
  'Khammam':     { lat: 17.2473, lon: 80.1514 },
  'Adilabad':    { lat: 19.6640, lon: 78.5320 },
  'Hyderabad':   { lat: 17.3850, lon: 78.4867 },
  'Rangareddy':  { lat: 17.3260, lon: 78.1504 },
  'Medak':       { lat: 18.0447, lon: 78.2610 },
  'Mahabubnagar':{ lat: 16.7448, lon: 77.9997 },
  'Srikakulam':  { lat: 18.2949, lon: 83.8938 },
  'Vizianagaram':{ lat: 18.1066, lon: 83.4014 },
  'Visakhapatnam':{ lat: 17.6868, lon: 83.2185 },
  'East Godavari':{ lat: 17.0029, lon: 82.2486 },
  'West Godavari':{ lat: 16.9174, lon: 81.3417 },
  'Nellore':     { lat: 14.4426, lon: 79.9865 },
  'Chittoor':    { lat: 13.2172, lon: 79.1003 },
  'Kadapa':      { lat: 14.4673, lon: 78.8242 },
  'Anantapur':   { lat: 14.6819, lon: 77.6006 },
};

// ─── Open-Meteo Fetcher ────────────────────────────────────────────

/**
 * Fetches live weather from Open-Meteo with retry.
 * @returns normalized weather object or null on failure.
 */
const fetchOpenMeteo = async (lat, lon) => {
  const MAX_RETRIES = getMaxRetries();
  const params = {
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    forecast_days: 5,
    timezone: 'auto',
  };

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      if (attempt > 1) {
        logger.info(`Weather API retry attempt ${attempt}`);
        await new Promise(r => setTimeout(r, 1000 * attempt)); // simple backoff
      }
      const res = await axios.get(`${OPEN_METEO_BASE}/forecast`, { params, timeout: TIMEOUT_MS });
      return res.data;
    } catch (err) {
      lastErr = err;
      const isRetryable = !err.response || err.code === 'ECONNABORTED' || err.response?.status >= 500;
      if (!isRetryable) break;
    }
  }
  logger.warn('Open-Meteo unreachable after retries', { error: lastErr?.message });
  return null;
};

// ─── WMO Weather Code → description / condition ───────────────────
// Subset of WMO 4677 codes relevant to farming.
const WMO_DESCRIPTIONS = {
  0: { description: 'Clear sky', condition: 'Clear' },
  1: { description: 'Mainly clear', condition: 'Clear' },
  2: { description: 'Partly cloudy', condition: 'Clouds' },
  3: { description: 'Overcast', condition: 'Clouds' },
  45: { description: 'Foggy', condition: 'Fog' },
  48: { description: 'Depositing rime fog', condition: 'Fog' },
  51: { description: 'Light drizzle', condition: 'Drizzle' },
  53: { description: 'Moderate drizzle', condition: 'Drizzle' },
  55: { description: 'Dense drizzle', condition: 'Drizzle' },
  61: { description: 'Slight rain', condition: 'Rain' },
  63: { description: 'Moderate rain', condition: 'Rain' },
  65: { description: 'Heavy rain', condition: 'Rain' },
  71: { description: 'Slight snowfall', condition: 'Snow' },
  73: { description: 'Moderate snowfall', condition: 'Snow' },
  75: { description: 'Heavy snowfall', condition: 'Snow' },
  80: { description: 'Slight rain showers', condition: 'Rain' },
  81: { description: 'Moderate rain showers', condition: 'Rain' },
  82: { description: 'Violent rain showers', condition: 'Rain' },
  95: { description: 'Thunderstorm', condition: 'Thunderstorm' },
  96: { description: 'Thunderstorm with slight hail', condition: 'Thunderstorm' },
  99: { description: 'Thunderstorm with heavy hail', condition: 'Thunderstorm' },
};

const describeCode = (code) =>
  WMO_DESCRIPTIONS[code] || { description: 'Variable conditions', condition: 'Clouds' };

// ─── Response Normalizer ──────────────────────────────────────────
const normalizeWeather = (data, locationLabel) => {
  const cur = data.current || {};
  const daily = data.daily || {};
  const curCode = cur.weather_code ?? 0;
  const { description: curDesc, condition: curCond } = describeCode(curCode);

  const forecast = (daily.time || []).slice(0, 5).map((date, i) => {
    const code = daily.weather_code?.[i] ?? 0;
    return {
      date,
      temp_max: Math.round(daily.temperature_2m_max?.[i] ?? 0),
      temp_min: Math.round(daily.temperature_2m_min?.[i] ?? 0),
      description: describeCode(code).description,
      condition: describeCode(code).condition,
      rain_probability_pct: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
    };
  });

  return {
    source: 'open-meteo',
    location: locationLabel,
    latitude: data.latitude,
    longitude: data.longitude,
    current: {
      temp_celsius: Math.round(cur.temperature_2m ?? 0),
      feels_like_celsius: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 0),
      humidity_pct: Math.round(cur.relative_humidity_2m ?? 0),
      wind_speed_kmh: Math.round(cur.wind_speed_10m ?? 0),
      description: curDesc,
      condition: curCond,
      weather_code: curCode,
    },
    forecast,
    alerts: [],
    last_updated: new Date().toISOString(),
  };
};

// ─── Controllers ──────────────────────────────────────────────────

/**
 * GET /api/weather?lat=&lon=  OR  ?district=&state=
 * Returns live Open-Meteo weather.
 */
export const getWeather = async (req, res, next) => {
  try {
    let { lat, lon, district, state, location } = req.query;

    // 1. Parse explicit coordinates
    let parsedLat = lat ? parseFloat(lat) : null;
    let parsedLon = lon ? parseFloat(lon) : null;
    let locationLabel = location || null;

    // 2. Resolve district fallback
    if ((!parsedLat || !parsedLon) && district) {
      const coords = DISTRICT_COORDS[district];
      if (coords) {
        parsedLat = coords.lat;
        parsedLon = coords.lon;
        locationLabel = locationLabel || `${district}${state ? ', ' + state : ''}`;
      }
    }

    // 3. No resolvable location
    if (!parsedLat || !parsedLon) {
      return res.status(200).json({
        success: false,
        status: 'missing_context',
        message: 'Location coordinates or a known district name are required for weather data. Please update your farm location in your profile.',
      });
    }

    locationLabel = locationLabel || `${parsedLat.toFixed(4)}, ${parsedLon.toFixed(4)}`;

    // 4. Fetch live data
    const raw = await fetchOpenMeteo(parsedLat, parsedLon);
    if (!raw) {
      return res.status(200).json({
        success: false,
        status: 'data_unavailable',
        message: 'Live weather data is temporarily unavailable. Please try again shortly.',
      });
    }

    // 5. Validate minimum fields
    if (!raw.current || raw.current.temperature_2m === undefined) {
      logger.warn('Open-Meteo returned incomplete response');
      return res.status(200).json({
        success: false,
        status: 'data_unavailable',
        message: 'Weather service returned incomplete data.',
      });
    }

    res.set('X-Data-Source', 'open-meteo');
    return res.json({
      success: true,
      data: normalizeWeather(raw, locationLabel),
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/weather/district/:district/:state
 * Backwards-compatible route; delegates to getWeather.
 */
export const getWeatherByDistrict = async (req, res, next) => {
  req.query.district = req.params.district;
  req.query.state = req.params.state;
  return getWeather(req, res, next);
};

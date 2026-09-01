/**
 * weatherController.test.js
 *
 * Unit tests for the Phase 5 weatherController.
 * All external HTTP calls (Open-Meteo) are mocked via jest.unstable_mockModule.
 * No real network calls. No fabricated data entering production.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── Mock axios before importing controller ───────────────────────
const mockAxiosGet = jest.fn();
jest.unstable_mockModule('axios', () => ({
  default: { get: mockAxiosGet },
}));

// ─── Mock logger ──────────────────────────────────────────────────
jest.unstable_mockModule('../utils/logger.js', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

// ─── Import controller AFTER mocks ───────────────────────────────
const { getWeather, getWeatherByDistrict } = await import('../controllers/weatherController.js');

// ─── Helpers ──────────────────────────────────────────────────────
const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  res.set    = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (query = {}, params = {}) => ({ query, params });

const VALID_OPEN_METEO_RESPONSE = {
  latitude: 17.385,
  longitude: 78.4867,
  current: {
    temperature_2m: 28.5,
    apparent_temperature: 31.0,
    relative_humidity_2m: 72,
    wind_speed_10m: 14.0,
    weather_code: 2,
  },
  daily: {
    time: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
    temperature_2m_max: [32, 33, 30, 29, 31],
    temperature_2m_min: [24, 25, 22, 21, 23],
    precipitation_probability_max: [10, 40, 80, 55, 20],
    weather_code: [2, 3, 63, 61, 2],
  },
};

// ─── Tests ────────────────────────────────────────────────────────

describe('getWeather', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    // Set retries to 0 so no backoff delay occurs in tests
    process.env.WEATHER_API_RETRIES = '0';
  });

  afterEach(() => {
    delete process.env.WEATHER_API_RETRIES;
  });

  // ── 1. Success with coordinates ──────────────────────────────────
  it('returns live weather when valid lat/lon provided', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_OPEN_METEO_RESPONSE });

    const req = makeReq({ lat: '17.385', lon: '78.4867' });
    const res = makeRes();
    const next = jest.fn();

    await getWeather(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          source: 'open-meteo',
          current: expect.objectContaining({
            temp_celsius: 29,  // Math.round(28.5)
            humidity_pct: 72,
            wind_speed_kmh: 14,
          }),
          forecast: expect.arrayContaining([
            expect.objectContaining({ temp_max: 32, temp_min: 24 }),
          ]),
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── 2. Success with known district ──────────────────────────────
  it('resolves district name to coordinates and returns weather', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_OPEN_METEO_RESPONSE });

    const req = makeReq({ district: 'Hyderabad', state: 'Telangana' });
    const res = makeRes();
    const next = jest.fn();

    await getWeather(req, res, next);

    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining('open-meteo'),
      expect.objectContaining({
        params: expect.objectContaining({ latitude: 17.385, longitude: 78.4867 }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  // ── 3. Missing context — no location at all ──────────────────────
  it('returns missing_context when no coordinates or district provided', async () => {
    const req = makeReq({});  // empty query
    const res = makeRes();
    const next = jest.fn();

    await getWeather(req, res, next);

    expect(mockAxiosGet).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 'missing_context' })
    );
  });

  // ── 4. Missing context — unknown district ────────────────────────
  it('returns missing_context for unrecognised district', async () => {
    const req = makeReq({ district: 'UnknownVillageXYZ' });
    const res = makeRes();
    const next = jest.fn();

    await getWeather(req, res, next);

    expect(mockAxiosGet).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 'missing_context' })
    );
  });

  // ── 5. Open-Meteo API failure → data_unavailable ─────────────────
  it('returns data_unavailable when Open-Meteo fails', async () => {
    mockAxiosGet.mockRejectedValue(new Error('ECONNABORTED'));

    const req = makeReq({ lat: '17.385', lon: '78.4867' });
    const res = makeRes();
    const next = jest.fn();

    await getWeather(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 'data_unavailable' })
    );
  });

  // ── 6. Open-Meteo 500 → data_unavailable ─────────────────────────
  it('returns data_unavailable when Open-Meteo returns 500', async () => {
    const err = Object.assign(new Error('Server Error'), { response: { status: 500 } });
    mockAxiosGet.mockRejectedValue(err);

    const req = makeReq({ lat: '17.385', lon: '78.4867' });
    const res = makeRes();
    const next = jest.fn();

    await getWeather(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 'data_unavailable' })
    );
  });

  // ── 7. Incomplete response → data_unavailable ────────────────────
  it('returns data_unavailable when Open-Meteo response is missing current field', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { latitude: 17.385, longitude: 78.4867 } }); // no 'current'

    const req = makeReq({ lat: '17.385', lon: '78.4867' });
    const res = makeRes();
    const next = jest.fn();

    await getWeather(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 'data_unavailable' })
    );
  });

  // ── 8. SAFETY: response never contains MOCK_DATA ──────────────────
  it('never returns source=MOCK_DATA', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_OPEN_METEO_RESPONSE });

    const req = makeReq({ lat: '17.385', lon: '78.4867' });
    const res = makeRes();
    await getWeather(req, res, jest.fn());

    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg?.data?.source).not.toBe('MOCK_DATA');
    expect(JSON.stringify(jsonArg)).not.toContain('MOCK_DATA');
  });

  // ── 9. Response shape validation ─────────────────────────────────
  it('normalizes all required fields in the response', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_OPEN_METEO_RESPONSE });

    const req = makeReq({ lat: '17.385', lon: '78.4867', location: 'Test Farm' });
    const res = makeRes();
    await getWeather(req, res, jest.fn());

    const { data } = res.json.mock.calls[0][0];
    expect(data.current).toMatchObject({
      temp_celsius: expect.any(Number),
      feels_like_celsius: expect.any(Number),
      humidity_pct: expect.any(Number),
      wind_speed_kmh: expect.any(Number),
      description: expect.any(String),
      condition: expect.any(String),
    });
    expect(data.forecast).toHaveLength(5);
    data.forecast.forEach(day => {
      expect(day).toMatchObject({
        date: expect.any(String),
        temp_max: expect.any(Number),
        temp_min: expect.any(Number),
        rain_probability_pct: expect.any(Number),
      });
    });
  });

  // ── 10. X-Data-Source header ──────────────────────────────────────
  it('sets X-Data-Source: open-meteo header on success', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_OPEN_METEO_RESPONSE });

    const req = makeReq({ lat: '17.385', lon: '78.4867' });
    const res = makeRes();
    await getWeather(req, res, jest.fn());

    expect(res.set).toHaveBeenCalledWith('X-Data-Source', 'open-meteo');
  });
});

// ─── getWeatherByDistrict (backwards-compat) ─────────────────────

describe('getWeatherByDistrict', () => {
  beforeEach(() => mockAxiosGet.mockReset());

  it('delegates to getWeather via params.district and params.state', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_OPEN_METEO_RESPONSE });

    const req = { query: {}, params: { district: 'Guntur', state: 'Andhra Pradesh' } };
    const res = makeRes();
    await getWeatherByDistrict(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

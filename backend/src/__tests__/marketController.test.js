/**
 * marketController.test.js
 *
 * Unit tests for the Phase 5 marketController additions.
 * Tests: getLiveMarketPrices — key guard, success, data_unavailable paths.
 * The existing getMarketPrices (DB) and calculateNetReturn are tested via their
 * real DB interactions; this file focuses on the new live endpoint logic.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── Mock axios ───────────────────────────────────────────────────
const mockAxiosGet = jest.fn();
jest.unstable_mockModule('axios', () => ({
  default: { get: mockAxiosGet },
}));

// ─── Mock DB pool (not needed for live prices, but imported by controller) ─
jest.unstable_mockModule('../db/pool.js', () => ({
  query: jest.fn(),
}));

// ─── Mock logger ──────────────────────────────────────────────────
jest.unstable_mockModule('../utils/logger.js', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

// ─── Mock express-validator (used by existing controller code) ────
// Must return a full fluent chain: body(...).isUUID().withMessage()
const makeChain = () => {
  const chain = {};
  const methods = [
    'isUUID', 'isFloat', 'isInt', 'isString', 'isEmail', 'isLength',
    'notEmpty', 'optional', 'trim', 'escape', 'withMessage', 'custom',
    'isIn', 'isArray', 'isBoolean', 'isISO8601', 'toFloat', 'toInt',
  ];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  return chain;
};
jest.unstable_mockModule('express-validator', () => ({
  body: jest.fn(() => makeChain()),
  query: jest.fn(() => makeChain()),
  validationResult: jest.fn(() => ({ isEmpty: () => true, array: () => [] })),
}));


const { getLiveMarketPrices } = await import('../controllers/marketController.js');

// ─── Helpers ──────────────────────────────────────────────────────
const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (query = {}) => ({ query });

const VALID_AGMARKNET_RESPONSE = {
  records: [
    {
      State: 'Telangana',
      District: 'Warangal',
      Market: 'Warangal',
      Commodity: 'Cotton',
      Variety: 'Bt Cotton',
      Arrival_Date: '01/09/2026',
      Min_Price: '6500',
      Max_Price: '7200',
      Modal_Price: '6900',
    },
    {
      State: 'Telangana',
      District: 'Nalgonda',
      Market: 'Miryalaguda',
      Commodity: 'Rice',
      Variety: 'Sona Masuri',
      Arrival_Date: '01/09/2026',
      Min_Price: '1800',
      Max_Price: '2100',
      Modal_Price: '1950',
    },
  ],
  total: 2,
};

// ─── Tests ────────────────────────────────────────────────────────

describe('getLiveMarketPrices', () => {
  const ORIG_ENV = process.env.MARKET_API_KEY;

  beforeEach(() => {
    mockAxiosGet.mockReset();
    process.env.MARKET_API_KEY = 'test-key-123';
    // Set retries to 0 so no backoff sleep occurs in tests
    process.env.MARKET_API_RETRIES = '0';
  });

  afterEach(() => {
    process.env.MARKET_API_KEY = ORIG_ENV;
    delete process.env.MARKET_API_RETRIES;
  });

  // ── 1. Missing API key → data_unavailable immediately ────────────
  it('returns data_unavailable when MARKET_API_KEY is not set', async () => {
    process.env.MARKET_API_KEY = '';
    const req = makeReq({ commodity: 'Cotton' });
    const res = makeRes();
    const next = jest.fn();

    await getLiveMarketPrices(req, res, next);

    expect(mockAxiosGet).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 'data_unavailable' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── 2. Successful response → normalized records returned ─────────
  it('returns normalized records on successful API response', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_AGMARKNET_RESPONSE });

    const req = makeReq({ commodity: 'Cotton', state: 'Telangana' });
    const res = makeRes();
    const next = jest.fn();

    await getLiveMarketPrices(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        status: 'success',
        data: expect.arrayContaining([
          expect.objectContaining({
            commodity: 'Cotton',
            market: 'Warangal',
            modal_price_quintal: 6900,
            source: 'agmarknet-data.gov.in',
          }),
        ]),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── 3. API returns 500 → data_unavailable ────────────────────────
  it('returns data_unavailable when Agmarknet returns 500', async () => {
    const err = Object.assign(new Error('Server Error'), { response: { status: 500 } });
    mockAxiosGet.mockRejectedValue(err);

    const req = makeReq({});
    const res = makeRes();

    await getLiveMarketPrices(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 'data_unavailable' })
    );
  });

  // ── 4. API returns 401 → data_unavailable (auth failure) ─────────
  it('returns data_unavailable with auth error on 401', async () => {
    const err = Object.assign(new Error('Unauthorized'), { response: { status: 401 } });
    mockAxiosGet.mockRejectedValue(err);

    const req = makeReq({});
    const res = makeRes();

    await getLiveMarketPrices(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 'data_unavailable' })
    );
  });

  // ── 5. API returns non-array records → data_unavailable ──────────
  it('returns data_unavailable when records is not an array', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { message: 'ok', records: null } });

    const req = makeReq({});
    const res = makeRes();

    await getLiveMarketPrices(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 'data_unavailable' })
    );
  });

  // ── 6. All records missing required fields → data_unavailable ─────
  it('returns data_unavailable when no records pass validation', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      data: { records: [{ State: 'Telangana' }], total: 1 }, // missing Modal_Price, etc.
    });

    const req = makeReq({});
    const res = makeRes();

    await getLiveMarketPrices(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, status: 'data_unavailable' })
    );
  });

  // ── 7. SAFETY: no fabricated prices ──────────────────────────────
  it('never returns prices not present in the API response', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_AGMARKNET_RESPONSE });

    const req = makeReq({});
    const res = makeRes();

    await getLiveMarketPrices(req, res, jest.fn());

    const jsonArg = res.json.mock.calls[0][0];
    const returnedPrices = jsonArg.data.map(r => r.modal_price_quintal);

    // All returned prices must originate from the mock API response
    const sourcePrices = VALID_AGMARKNET_RESPONSE.records.map(r => parseFloat(r.Modal_Price));
    returnedPrices.forEach(p => {
      expect(sourcePrices).toContain(p);
    });
  });

  // ── 8. Response includes correct source label ─────────────────────
  it('labels all records with source=agmarknet-data.gov.in', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_AGMARKNET_RESPONSE });

    const req = makeReq({});
    const res = makeRes();

    await getLiveMarketPrices(req, res, jest.fn());

    const jsonArg = res.json.mock.calls[0][0];
    jsonArg.data.forEach(r => {
      expect(r.source).toBe('agmarknet-data.gov.in');
    });
  });

  // ── 9. Note field is present in response ─────────────────────────
  it('includes a note field reminding users to verify prices', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_AGMARKNET_RESPONSE });

    const req = makeReq({});
    const res = makeRes();

    await getLiveMarketPrices(req, res, jest.fn());

    const jsonArg = res.json.mock.calls[0][0];
    expect(typeof jsonArg.note).toBe('string');
    expect(jsonArg.note.length).toBeGreaterThan(0);
  });

  // ── 10. Limit parameter is capped at 50 ───────────────────────────
  it('caps the limit at 50 regardless of requested value', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: VALID_AGMARKNET_RESPONSE });

    const req = makeReq({ limit: '999' });
    const res = makeRes();

    await getLiveMarketPrices(req, res, jest.fn());

    const callParams = mockAxiosGet.mock.calls[0][1].params;
    expect(callParams.limit).toBeLessThanOrEqual(50);
  });
});

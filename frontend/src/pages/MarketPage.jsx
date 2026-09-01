/**
 * MarketPage.jsx — Phase 5 update
 *
 * Changes:
 *  - Fixed prices?.prices?.length → prices?.length (backend returns array directly)
 *  - Added "Live Prices" tab sourced from /api/market/live (Agmarknet)
 *  - Shows data_unavailable state cleanly when MARKET_API_KEY not configured
 *  - Demo notice shown only for demo/DB data, not for live data
 *  - No fabricated prices. No mock values.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { marketApi, farmerApi } from '../services/api';
import { TrendingUp, Calculator, AlertCircle, WifiOff, RefreshCw, Zap } from 'lucide-react';

export default function MarketPage() {
  const { t } = useTranslation();
  const [selectedCropId, setSelectedCropId] = useState('');
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'demo'
  const [calcForm, setCalcForm] = useState({ crop_id: '', quantity_kg: '', target_market_id: '' });
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // ── Farmer profile (for context) ───────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ['farmerProfile'],
    queryFn: () => farmerApi.getProfile().then(r => r.data.data),
    retry: false,
  });

  const { data: allCrops } = useQuery({
    queryKey: ['allCrops'],
    queryFn: () => farmerApi.getAllCrops().then(r => r.data.data),
    retry: false,
  });

  const { data: markets } = useQuery({
    queryKey: ['markets'],
    queryFn: () => marketApi.getMarkets().then(r => r.data.data),
    retry: false,
  });

  // ── Demo DB prices (existing endpoint, unchanged) ───────────────
  const { data: demoPrices, isLoading: demoPricesLoading } = useQuery({
    queryKey: ['marketPrices', selectedCropId],
    queryFn: () => marketApi.getPrices({ crop_id: selectedCropId || undefined }).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: activeTab === 'demo',
  });

  // ── Live prices from Agmarknet ──────────────────────────────────
  const selectedCropName = allCrops?.find(c => c.id === selectedCropId)?.name_en;
  const { data: liveResp, isLoading: livePricesLoading, refetch: refetchLive } = useQuery({
    queryKey: ['marketLivePrices', selectedCropName, profile?.state],
    queryFn: () => marketApi.getLivePrices({
      commodity: selectedCropName || undefined,
      state: profile?.state || undefined,
      limit: 20,
    }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: activeTab === 'live',
  });

  // ── Calculator ──────────────────────────────────────────────────
  const handleCalculate = async (e) => {
    e.preventDefault();
    if (!calcForm.crop_id || !calcForm.quantity_kg) return;
    setCalcLoading(true);
    try {
      const res = await marketApi.calculate(calcForm);
      setCalcResult(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setCalcLoading(false);
    }
  };

  // ── Tab style helper ────────────────────────────────────────────
  const tabStyle = (tab) => ({
    padding: '0.5rem 1.25rem',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    background: activeTab === tab ? 'var(--color-green-700)' : 'transparent',
    color: activeTab === tab ? 'white' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: activeTab === tab ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  });

  // ── Live panel ──────────────────────────────────────────────────
  const renderLivePanel = () => {
    if (livePricesLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: '50px' }} />)}
        </div>
      );
    }

    // data_unavailable (no API key or network error)
    if (!liveResp?.success) {
      return (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <WifiOff size={32} style={{ color: 'var(--color-amber-500)', margin: '0 auto 0.75rem', display: 'block' }} />
          <h4 style={{ marginBottom: '0.5rem' }}>Live Prices Not Available</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '380px', margin: '0 auto 1rem' }}>
            {liveResp?.message || 'Live market data requires a data.gov.in API key. Contact your administrator to enable this feature.'}
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => refetchLive()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      );
    }

    const records = liveResp?.data || [];
    if (!records.length) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon"><TrendingUp size={28} /></div>
          <h3>No records found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Try selecting a specific crop or broadening the filter.
          </p>
        </div>
      );
    }

    return (
      <>
        <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-green-700)', fontSize: '0.8rem', fontWeight: 600 }}>
          <Zap size={13} /> Live from Agmarknet (data.gov.in)
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="price-table">
            <thead>
              <tr>
                <th>Commodity</th>
                <th>Market</th>
                <th>District, State</th>
                <th>Min (₹/q)</th>
                <th>Max (₹/q)</th>
                <th style={{ color: 'var(--color-green-700)' }}>Modal (₹/q)</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 20).map((p, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{p.commodity}{p.variety ? ` (${p.variety})` : ''}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.market}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.district}, {p.state}</td>
                  <td>₹{p.min_price_quintal?.toLocaleString() ?? '--'}</td>
                  <td>₹{p.max_price_quintal?.toLocaleString() ?? '--'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--color-green-700)' }}>
                    ₹{p.modal_price_quintal?.toLocaleString() ?? '--'}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.arrival_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          {liveResp?.note}
        </p>
      </>
    );
  };

  // ── Demo panel ──────────────────────────────────────────────────
  const renderDemoPanel = () => {
    if (demoPricesLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: '50px' }} />)}
        </div>
      );
    }

    // demoPrices is an array directly (fixed: was prices?.prices?.length before)
    if (!demoPrices?.length) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon"><TrendingUp size={28} /></div>
          <h3>{t('market.noData', 'No data available')}</h3>
        </div>
      );
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="price-table">
          <thead>
            <tr>
              <th>Crop</th>
              <th>Market</th>
              <th>Min (₹/q)</th>
              <th>Max (₹/q)</th>
              <th>Modal (₹/q)</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {demoPrices.slice(0, 20).map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.crop_name}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.market_name}</td>
                <td>₹{p.min_price_quintal?.toLocaleString()}</td>
                <td>₹{p.max_price_quintal?.toLocaleString()}</td>
                <td style={{ fontWeight: 600, color: 'var(--color-green-700)' }}>₹{p.modal_price_quintal?.toLocaleString()}</td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(p.price_date).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <h1>📊 {t('market.title', 'Market Prices')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Real-time commodity prices and net return calculator
        </p>
      </div>

      {/* Crop Filter */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>
            {t('market.selectCrop', 'Select Crop')}:
          </label>
          <select
            id="market-crop-filter"
            className="form-select"
            style={{ width: 'auto', minWidth: '180px' }}
            value={selectedCropId}
            onChange={(e) => setSelectedCropId(e.target.value)}
          >
            <option value="">All Crops</option>
            {allCrops?.map(c => (
              <option key={c.id} value={c.id}>{c.name_en}</option>
            ))}
          </select>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <button id="tab-live" style={tabStyle('live')} onClick={() => setActiveTab('live')}>
              <Zap size={13} /> Live Prices
            </button>
            <button id="tab-demo" style={tabStyle('demo')} onClick={() => setActiveTab('demo')}>
              Demo / Historical
            </button>
          </div>
        </div>
      </div>

      {/* Demo notice — only when demo tab is active */}
      {activeTab === 'demo' && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={15} />
          <span>
            <strong>Sample / Historical Data</strong> — These are demo prices seeded for development.
            Switch to <strong>Live Prices</strong> for Agmarknet data.
          </span>
        </div>
      )}

      <div className="dashboard-grid-2">
        {/* Price Panel */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem' }}>
            {activeTab === 'live' ? '⚡ Live Market Prices' : '💰 Demo Prices'}
          </h3>
          {activeTab === 'live' ? renderLivePanel() : renderDemoPanel()}
        </div>

        {/* Net Return Calculator (uses demo DB data — unchanged) */}
        <div>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>
              <Calculator size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              {t('market.calculate', 'Net Return Calculator')}
            </h3>

            <form onSubmit={handleCalculate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t('market.selectCrop', 'Crop')}</label>
                <select id="calc-crop" className="form-select" value={calcForm.crop_id}
                  onChange={(e) => setCalcForm({ ...calcForm, crop_id: e.target.value })} required>
                  <option value="">Select crop</option>
                  {allCrops?.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('market.quantity', 'Quantity')} (kg)</label>
                <input
                  id="calc-quantity"
                  type="number"
                  className="form-input"
                  value={calcForm.quantity_kg}
                  onChange={(e) => setCalcForm({ ...calcForm, quantity_kg: e.target.value })}
                  placeholder="e.g. 5000"
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Market (optional)</label>
                <select id="calc-market" className="form-select" value={calcForm.target_market_id}
                  onChange={(e) => setCalcForm({ ...calcForm, target_market_id: e.target.value })}>
                  <option value="">Best market auto-selected</option>
                  {markets?.map(m => <option key={m.id} value={m.id}>{m.name}, {m.district}</option>)}
                </select>
              </div>

              <button id="calc-submit" type="submit" className="btn btn-harvest" disabled={calcLoading}>
                {calcLoading
                  ? <><span className="loading-spinner" style={{ width: 16, height: 16 }} /> Calculating...</>
                  : 'Calculate Return'}
              </button>
            </form>
          </div>

          {/* Result */}
          {calcResult && (
            <div className="card" style={{ background: 'var(--color-green-700)', color: 'white' }}>
              <h4 style={{ color: 'white', marginBottom: '1rem' }}>📈 Estimated Returns</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {[
                  { label: t('market.grossRevenue', 'Gross Revenue'), value: calcResult.gross_revenue },
                  { label: t('market.transport', 'Transport Cost'), value: `-${calcResult.transport_cost_est ?? calcResult.options?.[0]?.transport_cost ?? 0}` },
                  { label: t('market.marketCharges', 'Market Charges'), value: `-${calcResult.market_charges_est ?? calcResult.options?.[0]?.market_charges ?? 0}` },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '0.5rem' }}>
                    <span style={{ opacity: 0.85, fontSize: '0.875rem' }}>{row.label}</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(row.value).toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span style={{ fontWeight: 700 }}>{t('market.netReturn', 'Net Return')}</span>
                  <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-harvest-300)' }}>
                    ₹{Number(calcResult.net_return_est ?? calcResult.options?.[0]?.net_return ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {(calcResult.recommendation || calcResult.options?.[0]) && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{t('market.bestOption', 'Best Option')}</div>
                  <div style={{ fontWeight: 600 }}>
                    {calcResult.recommendation?.preferred_market || calcResult.options?.[0]?.market_name}
                  </div>
                </div>
              )}

              <p style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.75rem' }}>
                Estimated calculation. Transport costs may vary. Verify prices before selling.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

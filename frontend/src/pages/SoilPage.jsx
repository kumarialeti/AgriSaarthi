import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { soilApi } from '../services/api';
import { FlaskConical, Upload, Plus, Info, CheckCircle } from 'lucide-react';

const SOIL_RANGES = {
  ph:               { low: 0, good_min: 6.0, good_max: 7.0, high: 14, unit: '', label: 'pH', good_label: 'Optimal (6.0–7.0)' },
  nitrogen_kg_ha:   { low: 130, good_min: 130, good_max: 250, high: 999, unit: 'kg/ha', label: 'Nitrogen (N)', good_label: 'Medium (130–250)' },
  phosphorus_kg_ha: { low: 10, good_min: 25, good_max: 50, high: 999, unit: 'kg/ha', label: 'Phosphorus (P)', good_label: 'Medium (25–50)' },
  potassium_kg_ha:  { low: 100, good_min: 100, good_max: 200, high: 999, unit: 'kg/ha', label: 'Potassium (K)', good_label: 'Medium (100–200)' },
  organic_carbon_pct: { low: 0.5, good_min: 0.5, good_max: 0.75, high: 10, unit: '%', label: 'Organic Carbon', good_label: 'Medium (0.5–0.75%)' },
  ec_ds_m:          { low: 0, good_min: 0, good_max: 1.0, high: 10, unit: 'dS/m', label: 'EC', good_label: 'Non-saline (<1.0)' },
};

const getStatus = (key, val) => {
  if (!val && val !== 0) return 'unknown';
  const r = SOIL_RANGES[key];
  if (!r) return 'unknown';
  if (val >= r.good_min && val <= r.good_max) return 'good';
  if (val < r.good_min) return 'low';
  return 'high';
};

const STATUS_STYLES = {
  good:    { color: 'var(--color-green-700)', bg: 'var(--color-green-50)', label: 'Good' },
  low:     { color: 'var(--color-harvest-600)', bg: 'var(--color-harvest-100)', label: 'Low' },
  high:    { color: 'var(--color-earth-600)', bg: 'var(--color-earth-100)', label: 'High' },
  unknown: { color: 'var(--color-gray-500)', bg: 'var(--color-gray-100)', label: '—' },
};

export default function SoilPage() {
  const { t } = useTranslation();
  const qClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ph: '', nitrogen_kg_ha: '', phosphorus_kg_ha: '', potassium_kg_ha: '', organic_carbon_pct: '', ec_ds_m: '', field_name: '', notes: '' });
  const [saved, setSaved] = useState(false);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['soilReports'],
    queryFn: () => soilApi.getReports().then(r => r.data.data),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (data) => soilApi.createManual(data),
    onSuccess: () => {
      qClient.invalidateQueries({ queryKey: ['soilReports'] });
      setShowForm(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setForm({ ph: '', nitrogen_kg_ha: '', phosphorus_kg_ha: '', potassium_kg_ha: '', organic_carbon_pct: '', ec_ds_m: '', field_name: '', notes: '' });
    },
  });

  const latest = reports?.[0];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>🪨 {t('soil.soilAnalysis')}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track your soil health and get AI-powered recommendations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {t('soil.addManual')}
        </button>
      </div>

      {saved && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle size={16} /> {t('soil.reportSaved')}
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--color-earth-300)' }}>
          <h3 style={{ marginBottom: '1.25rem' }}>{t('soil.addManual')}</h3>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t('soil.ph')}</label>
                <input type="number" className="form-input" value={form.ph} onChange={e => setForm({ ...form, ph: e.target.value })} step="0.1" min="0" max="14" placeholder="e.g. 6.5" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('soil.nitrogen')}</label>
                <input type="number" className="form-input" value={form.nitrogen_kg_ha} onChange={e => setForm({ ...form, nitrogen_kg_ha: e.target.value })} step="0.1" placeholder="e.g. 180" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('soil.phosphorus')}</label>
                <input type="number" className="form-input" value={form.phosphorus_kg_ha} onChange={e => setForm({ ...form, phosphorus_kg_ha: e.target.value })} step="0.1" placeholder="e.g. 30" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('soil.potassium')}</label>
                <input type="number" className="form-input" value={form.potassium_kg_ha} onChange={e => setForm({ ...form, potassium_kg_ha: e.target.value })} step="0.1" placeholder="e.g. 150" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('soil.organicCarbon')}</label>
                <input type="number" className="form-input" value={form.organic_carbon_pct} onChange={e => setForm({ ...form, organic_carbon_pct: e.target.value })} step="0.01" placeholder="e.g. 0.6" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('soil.ec')}</label>
                <input type="number" className="form-input" value={form.ec_ds_m} onChange={e => setForm({ ...form, ec_ds_m: e.target.value })} step="0.01" placeholder="e.g. 0.5" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Field Name (optional)</label>
              <input type="text" className="form-input" value={form.field_name} onChange={e => setForm({ ...form, field_name: e.target.value })} placeholder="e.g. North Field" />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
                {mutation.isPending ? <span className="loading-spinner" style={{ width: 16, height: 16 }}></span> : null}
                {t('app.save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>{t('app.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Latest Report Dashboard */}
      {latest && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3>Latest Soil Report</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {latest.field_name || 'Main Field'} · {new Date(latest.created_at).toLocaleDateString()}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem', marginBottom: '1.25rem' }}>
            {Object.keys(SOIL_RANGES).map(key => {
              const val = latest[key];
              const status = getStatus(key, val);
              const style = STATUS_STYLES[status];
              const range = SOIL_RANGES[key];

              return (
                <div key={key} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: style.bg, border: `1px solid ${style.color}30` }}>
                  <div style={{ fontSize: '0.75rem', color: style.color, fontWeight: 600, marginBottom: '0.25rem' }}>
                    {range.label}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: style.color, lineHeight: 1 }}>
                    {val != null ? `${val}${range.unit}` : '—'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {style.label} · {range.good_label}
                  </div>
                </div>
              );
            })}
          </div>

          {latest.ai_analysis && (
            <div style={{ background: 'var(--color-green-50)', borderRadius: 'var(--radius-md)', padding: '1rem', borderLeft: '4px solid var(--color-green-600)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--color-green-700)' }}>
                <FlaskConical size={16} /> {t('soil.aiAnalysis')}
              </div>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{latest.ai_analysis}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>{t('soil.analysisNote')}</p>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {!isLoading && reports?.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><FlaskConical size={28} /></div>
            <h3>{t('soil.noReports')}</h3>
            <p>{t('soil.noReportsSubtitle')}</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={16} /> Add Soil Data
            </button>
          </div>
        </div>
      )}

      {reports?.length > 1 && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Report History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {reports.slice(1).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                <span style={{ fontWeight: 500 }}>{r.field_name || 'Field'}</span>
                <span style={{ color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                <span>pH: {r.ph} · N: {r.nitrogen_kg_ha} · P: {r.phosphorus_kg_ha}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

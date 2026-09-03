import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi, farmerApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Upload, Camera, AlertTriangle, CheckCircle, Info, Leaf, Bug } from 'lucide-react';

const SEVERITY_CONFIG = {
  none:     { color: 'var(--color-green-600)', bg: 'var(--color-green-50)', icon: '✅', label: 'Healthy' },
  mild:     { color: 'var(--color-harvest-600)', bg: 'var(--color-harvest-100)', icon: '⚠️', label: 'Mild' },
  moderate: { color: 'var(--color-earth-600)', bg: 'var(--color-earth-100)', icon: '🔶', label: 'Moderate' },
  severe:   { color: 'var(--color-red-600)', bg: 'var(--color-red-100)', icon: '🚨', label: 'Severe' },
  unknown:  { color: 'var(--color-gray-600)', bg: 'var(--color-gray-100)', icon: '❓', label: 'Unknown' },
};

export default function CropHealthPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const qClient = useQueryClient();
  const fileRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: crops } = useQuery({
    queryKey: ['myCrops'],
    queryFn: () => farmerApi.getMyCrops().then(r => r.data.data),
    retry: false,
  });

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['healthReports'],
    queryFn: () => healthApi.getReports().then(r => r.data.data),
    retry: false,
  });

  const analyzeMutation = useMutation({
    mutationFn: async ({ file, cropId, language }) => {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('language', language);
      if (cropId) fd.append('farmer_crop_id', cropId);
      return healthApi.analyze(fd).then(r => r.data.data);
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis || data);
      qClient.invalidateQueries({ queryKey: ['healthReports'] });
    },
  });

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image (JPEG, PNG, WebP).');
      return;
    }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setAnalysis(null);
  };

  const handleAnalyze = () => {
    if (!selectedFile) return;
    analyzeMutation.mutate({
      file: selectedFile,
      language: user?.language || 'en',
    });
  };

  const sev = analysis?.severity || 'unknown';
  const sevConfig = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.unknown;

  return (
    <div>
      <div className="page-header">
        <h1>{t('nav.cropHealth')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Upload a crop image to get AI-powered pest/disease diagnosis</p>
      </div>

      <div className="dashboard-grid-2">
        {/* Upload Section */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem' }}>📸 Analyze Crop Image</h3>

          {/* Upload zone */}
          <div
            className={`upload-zone ${isDragging ? 'drag-active' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files[0]); }}
          >
            {preview ? (
              <img src={preview} alt="preview" style={{ maxHeight: '200px', margin: '0 auto', borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
            ) : (
              <>
                <Camera size={40} color="var(--accent-primary)" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Click to upload or drag & drop</p>
                <p className="text-sm text-muted">JPEG, PNG, WebP · Max 10MB</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />

          {preview && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <><span className="loading-spinner" style={{ width: 16, height: 16 }}></span> Analyzing...</>
                ) : (
                  <><Leaf size={16} /> Analyze Image</>
                )}
              </button>
              <button className="btn btn-secondary" onClick={() => { setPreview(null); setSelectedFile(null); setAnalysis(null); }}>
                Clear
              </button>
            </div>
          )}

          {analyzeMutation.isError && (
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              <AlertTriangle size={16} />
              <span>Analysis failed. Please try again or use a clearer image.</span>
            </div>
          )}
        </div>

        {/* Analysis Result */}
        {analysis && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 44, height: 44, background: sevConfig.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                {sevConfig.icon}
              </div>
              <div>
                <h3 style={{ color: sevConfig.color }}>{analysis.detected_issue || 'Analysis Result'}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <span className="badge" style={{ background: sevConfig.bg, color: sevConfig.color }}>
                    Severity: {sevConfig.label}
                  </span>
                  <span className="badge badge-gray">
                    Confidence: {analysis.confidence}
                  </span>
                </div>
              </div>
            </div>

            {analysis.message && !analysis.analysis_available && (
              <div className="alert alert-warning" style={{ fontSize: '0.9rem', marginBottom: '1rem', background: 'var(--color-harvest-100)', color: 'var(--color-harvest-800)', display: 'flex', gap: '0.5rem', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <AlertTriangle size={16} />
                <span>{analysis.message}</span>
              </div>
            )}

            {analysis.response && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem', fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {analysis.response}
              </div>
            )}

            {analysis.immediate_actions?.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h5 style={{ marginBottom: '0.5rem', color: 'var(--color-red-600)' }}>🚨 Immediate Actions</h5>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {analysis.immediate_actions.map((a, i) => <li key={i} style={{ fontSize: '0.875rem' }}>{a}</li>)}
                </ul>
              </div>
            )}

            {analysis.preventive_measures?.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h5 style={{ marginBottom: '0.5rem', color: 'var(--color-green-700)' }}>🛡️ Prevention</h5>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {analysis.preventive_measures.map((m, i) => <li key={i} style={{ fontSize: '0.875rem' }}>{m}</li>)}
                </ul>
              </div>
            )}

            {analysis.disclaimer && (
              <div className="alert alert-info" style={{ fontSize: '0.75rem' }}>
                <Info size={14} />
                <span>{analysis.disclaimer}</span>
              </div>
            )}
          </div>
        )}

        {/* Previous Reports */}
        {!analysis && (
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>Previous Analyses</h3>
            {reportsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '70px' }}></div>)}
              </div>
            ) : !reports?.length ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Bug size={28} /></div>
                <h3>No analyses yet</h3>
                <p>Upload a crop image to get your first AI diagnosis.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {reports.slice(0, 5).map((r) => {
                  const sc = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.unknown;
                  return (
                    <div key={r.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: `1px solid ${sc.bg}` }}>
                      <span style={{ fontSize: '1.25rem' }}>{sc.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.disease_detected || 'Analysis'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(r.created_at).toLocaleDateString()} · {sc.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="card" style={{ marginTop: '1.5rem', background: 'var(--color-green-50)', border: '1px solid var(--color-green-200)' }}>
        <h4 style={{ color: 'var(--color-green-700)', marginBottom: '0.75rem' }}>📷 Tips for Better Analysis</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {[
            { icon: '☀️', tip: 'Take photos in natural daylight' },
            { icon: '🔍', tip: 'Focus on the affected area clearly' },
            { icon: '📐', tip: 'Include both healthy and affected leaves' },
            { icon: '🚫', tip: 'Avoid blurry or dark photos' },
          ].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8rem' }}>
              <span>{t.icon}</span>
              <span style={{ color: 'var(--color-green-800)' }}>{t.tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

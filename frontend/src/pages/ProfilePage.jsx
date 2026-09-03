import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { farmerApi, buyerApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { User, MapPin, Phone, Save, CheckCircle } from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Maharashtra',
  'Uttar Pradesh', 'Punjab', 'Haryana', 'Rajasthan', 'Madhya Pradesh',
  'Gujarat', 'Odisha', 'West Bengal', 'Bihar', 'Assam',
];

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, updateLanguage } = useAuthStore();
  const qClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const isBuyer = user?.role === 'BUYER';

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.role],
    queryFn: () => (isBuyer ? buyerApi.getProfile() : farmerApi.getProfile()).then(r => r.data.data),
    retry: false,
  });

  const [form, setForm] = useState({
    full_name: '', phone: '', village: '', mandal: '', district: '',
    state: 'Andhra Pradesh', pincode: '', total_land_acres: '',
  });

  // Sync form with loaded profile
  useState(() => {
    if (profile) setForm({ ...profile });
  });

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const mutation = useMutation({
    mutationFn: (data) => isBuyer ? buyerApi.updateProfile(data) : farmerApi.updateProfile(data),
    onSuccess: () => {
      qClient.invalidateQueries({ queryKey: ['profile', user?.role] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}><div className="loading-spinner"></div></div>;

  return (
    <div style={{ maxWidth: '720px' }}>
      <div className="page-header">
        <h1>{t('profile.title')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Update your details for personalized AI recommendations</p>
      </div>

      {/* Language Preference */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>🌐 {t('profile.language')}</h3>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {[
            { code: 'en', label: 'English', flag: '🇬🇧' },
            { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
            { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
          ].map(l => (
            <button
              key={l.code}
              type="button"
              className="btn"
              onClick={() => { i18n.changeLanguage(l.code); updateLanguage(l.code); }}
              style={{
                flex: 1, flexDirection: 'column', gap: '0.25rem', padding: '0.875rem',
                border: `2px solid ${i18n.language === l.code ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                background: i18n.language === l.code ? 'var(--color-green-50)' : 'white',
                color: i18n.language === l.code ? 'var(--color-green-700)' : 'var(--text-secondary)',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{l.flag}</span>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{l.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Profile Form */}
      <div className="card">
        <h3 style={{ marginBottom: '1.5rem' }}>👤 Personal & Farm Details</h3>

        {saved && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            <CheckCircle size={16} />
            <span>{t('profile.profileSaved')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{isBuyer ? 'Full Name or Company Rep' : t('profile.fullName')}</label>
              <input type="text" className="form-input" value={form.full_name || ''} onChange={(e) => updateForm('full_name', e.target.value)} placeholder="Your full name" />
            </div>

            {isBuyer && (
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input type="text" className="form-input" value={form.company_name || ''} onChange={(e) => updateForm('company_name', e.target.value)} placeholder="Your Company Name" />
              </div>
            )}

            {isBuyer && (
              <div className="form-group">
                <label className="form-label">GST Number</label>
                <input type="text" className="form-input" value={form.gst_number || ''} onChange={(e) => updateForm('gst_number', e.target.value)} placeholder="GST Number" />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{t('profile.phone')}</label>
              <input type="tel" className="form-input" value={form.phone || ''} onChange={(e) => updateForm('phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>

            <div className="form-group">
              <label className="form-label">{t('profile.village')}</label>
              <input type="text" className="form-input" value={form.village || ''} onChange={(e) => updateForm('village', e.target.value)} placeholder="Village name" />
            </div>

            <div className="form-group">
              <label className="form-label">{t('profile.mandal')}</label>
              <input type="text" className="form-input" value={form.mandal || ''} onChange={(e) => updateForm('mandal', e.target.value)} placeholder="Mandal" />
            </div>

            <div className="form-group">
              <label className="form-label">{t('profile.district')} *</label>
              <input type="text" className="form-input" value={form.district || ''} onChange={(e) => updateForm('district', e.target.value)} placeholder="e.g. Guntur" required />
            </div>

            <div className="form-group">
              <label className="form-label">{t('profile.state')}</label>
              <select className="form-select" value={form.state || 'Andhra Pradesh'} onChange={(e) => updateForm('state', e.target.value)}>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('profile.pincode')}</label>
              <input type="text" className="form-input" value={form.pincode || ''} onChange={(e) => updateForm('pincode', e.target.value)} placeholder="522001" maxLength="6" />
            </div>

            {!isBuyer && (
              <div className="form-group">
                <label className="form-label">{t('profile.totalLand')}</label>
                <input type="number" className="form-input" value={form.total_land_acres || ''} onChange={(e) => updateForm('total_land_acres', e.target.value)} placeholder="0.0" min="0" step="0.1" />
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={mutation.isPending} style={{ alignSelf: 'flex-start', minWidth: '160px' }}>
            {mutation.isPending ? (
              <><span className="loading-spinner" style={{ width: 16, height: 16 }}></span> Saving...</>
            ) : (
              <><Save size={16} /> {t('profile.saveProfile')}</>
            )}
          </button>
        </form>
      </div>

      {/* Account Info */}
      <div className="card" style={{ marginTop: '1.5rem', background: 'var(--bg-secondary)' }}>
        <h4 style={{ marginBottom: '0.75rem' }}>Account Information</h4>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Email: </span><strong>{user?.email}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Role: </span><strong>{user?.role}</strong></div>
        </div>
      </div>
    </div>
  );
}

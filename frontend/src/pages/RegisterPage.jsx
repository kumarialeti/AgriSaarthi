import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { Leaf, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    role: 'FARMER', language: i18n.language || 'en',
  });
  const [validationError, setValidationError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    clearError();
    setValidationError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }

    i18n.changeLanguage(form.language);
    const result = await register({
      email: form.email,
      password: form.password,
      role: form.role,
      language: form.language,
    });
    if (result.success) navigate('/dashboard');
  };

  return (
    <div className="auth-page">
      <div className="auth-left" style={{ background: 'linear-gradient(135deg, var(--color-earth-700), var(--color-earth-500), var(--color-harvest-500))' }}>
        <div className="auth-brand" style={{ position: 'relative', zIndex: 1 }}>
          <div className="auth-logo"><Leaf size={32} /></div>
          <h1 className="auth-brand-name">{t('app.name')}</h1>
          <p className="auth-tagline">{t('app.tagline')}</p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: '2rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.125rem', lineHeight: 1.8 }}>
            Join thousands of farmers across Andhra Pradesh and Telangana who use AgriSaarthi for smarter farming decisions.
          </p>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-card">
          <div className="auth-lang-select">
            {['en', 'te', 'hi'].map((lang) => (
              <button
                key={lang}
                type="button"
                className={`lang-btn-auth ${form.language === lang ? 'active' : ''}`}
                onClick={() => { setForm({ ...form, language: lang }); i18n.changeLanguage(lang); }}
              >
                {lang === 'en' ? 'English' : lang === 'te' ? 'తెలుగు' : 'हिंदी'}
              </button>
            ))}
          </div>

          <h2 className="auth-form-title">{t('auth.register')}</h2>
          <p className="auth-form-subtitle">
            {t('auth.hasAccount')} <Link to="/login" className="auth-link">{t('auth.login')}</Link>
          </p>

          {(error || validationError) && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{error || validationError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Role selection */}
            <div className="form-group">
              <label className="form-label">{t('auth.iAm')}</label>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                {[
                  { value: 'FARMER', label: t('auth.roleFarmer'), icon: '🌾' },
                  { value: 'BUYER', label: t('auth.roleBuyer'), icon: '🏪' },
                  { value: 'AGRICULTURE_OFFICER', label: t('auth.roleOfficer'), icon: '👨‍💼' },
                ].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={`role-btn ${form.role === r.value ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, role: r.value })}
                  >
                    <span>{r.icon}</span>
                    <span style={{ fontSize: '0.75rem' }}>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('auth.email')}</label>
              <input type="email" name="email" className="form-input" value={form.email} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">{t('auth.password')}</label>
              <input type="password" name="password" className="form-input" value={form.password} onChange={handleChange} required placeholder="Min 8 characters, 1 uppercase, 1 number" />
            </div>

            <div className="form-group">
              <label className="form-label">{t('auth.confirmPassword')}</label>
              <input type="password" name="confirmPassword" className="form-input" value={form.confirmPassword} onChange={handleChange} required />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', marginTop: '0.5rem' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <span className="loading-spinner" style={{ width: '18px', height: '18px' }}></span>
                  {t('app.loading')}
                </span>
              ) : t('auth.registerBtn')}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .auth-page { min-height: 100vh; display: flex; }
        .auth-left {
          flex: 1; padding: 3rem;
          display: flex; flex-direction: column; justify-content: center; color: white;
          position: relative; overflow: hidden;
        }
        .auth-left::before { content: ''; position: absolute; top: -80px; right: -80px; width: 300px; height: 300px; background: rgba(255,255,255,0.06); border-radius: 50%; }
        .auth-right { width: 440px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 2rem; background: var(--bg-primary); overflow-y: auto; }
        .auth-form-card { width: 100%; max-width: 380px; padding: 1rem 0; }
        .auth-lang-select { display: flex; gap: 0.5rem; margin-bottom: 2rem; }
        .lang-btn-auth { padding: 0.375rem 0.875rem; border-radius: var(--radius-full); border: 1.5px solid var(--border-color); background: white; font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: all var(--transition); }
        .lang-btn-auth.active { border-color: var(--accent-primary); background: var(--color-green-50); color: var(--accent-primary); }
        .auth-brand { margin-bottom: 2rem; }
        .auth-logo { width: 64px; height: 64px; background: var(--color-harvest-400); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; }
        .auth-brand-name { font-size: 2rem; font-weight: 800; margin-bottom: 0.25rem; }
        .auth-tagline { color: rgba(255,255,255,0.75); }
        .auth-form-title { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; }
        .auth-form-subtitle { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem; }
        .auth-link { color: var(--accent-primary); font-weight: 500; }
        .role-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.625rem 0.5rem; border: 1.5px solid var(--border-color); border-radius: var(--radius-md); background: white; cursor: pointer; transition: all var(--transition); }
        .role-btn.active { border-color: var(--accent-primary); background: var(--color-green-50); }
        @media (max-width: 768px) { .auth-left { display: none; } .auth-right { width: 100%; } }
      `}</style>
    </div>
  );
}

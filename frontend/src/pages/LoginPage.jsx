import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { Leaf, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(form.email, form.password);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-logo">
            <Leaf size={32} />
          </div>
          <h1 className="auth-brand-name">{t('app.name')}</h1>
          <p className="auth-tagline">{t('app.tagline')}</p>
        </div>

        <div className="auth-features">
          <div className="auth-feature">
            <span className="auth-feature-icon">🌱</span>
            <div>
              <h4>AI Crop Guidance</h4>
              <p>Personalized advice for your crops</p>
            </div>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-icon">🌍</span>
            <div>
              <h4>3 Languages</h4>
              <p>Telugu, Hindi, English</p>
            </div>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-icon">📊</span>
            <div>
              <h4>Market Intelligence</h4>
              <p>Real-time market prices & buyer matching</p>
            </div>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-icon">🏛️</span>
            <div>
              <h4>Govt. Schemes</h4>
              <p>Discover schemes you're eligible for</p>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-card">
          {/* Language selector */}
          <div className="auth-lang-select">
            {['en', 'te', 'hi'].map((lang) => (
              <button
                key={lang}
                className={`lang-btn-auth ${i18n.language === lang ? 'active' : ''}`}
                onClick={() => i18n.changeLanguage(lang)}
              >
                {lang === 'en' ? 'English' : lang === 'te' ? 'తెలుగు' : 'हिंदी'}
              </button>
            ))}
          </div>

          <h2 className="auth-form-title">{t('auth.login')}</h2>
          <p className="auth-form-subtitle">
            {t('auth.noAccount')} <Link to="/register" className="auth-link">{t('auth.register')}</Link>
          </p>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t('auth.email')}</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); clearError(); }}
                placeholder="farmer@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('auth.password')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  value={form.password}
                  onChange={(e) => { setForm({ ...form, password: e.target.value }); clearError(); }}
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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
              ) : t('auth.loginBtn')}
            </button>
          </form>

          <div className="auth-demo">
            <p className="text-xs text-secondary">Demo accounts:</p>
            <div className="auth-demo-creds">
              <span>farmer@demo.agrisaarthi.in</span>
              <span>Demo@12345</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
        }
        .auth-left {
          flex: 1;
          background: linear-gradient(135deg, var(--color-green-800) 0%, var(--color-green-600) 60%, var(--color-green-500) 100%);
          padding: 3rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          color: white;
          position: relative;
          overflow: hidden;
        }
        .auth-left::before {
          content: '';
          position: absolute;
          top: -80px; right: -80px;
          width: 300px; height: 300px;
          background: rgba(255,255,255,0.06);
          border-radius: 50%;
        }
        .auth-left::after {
          content: '';
          position: absolute;
          bottom: -100px; left: -60px;
          width: 400px; height: 400px;
          background: rgba(255,255,255,0.04);
          border-radius: 50%;
        }
        .auth-brand { position: relative; z-index: 1; margin-bottom: 3rem; }
        .auth-logo {
          width: 64px; height: 64px;
          background: var(--color-harvest-400);
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1rem;
        }
        .auth-brand-name { font-size: 2rem; font-weight: 800; margin-bottom: 0.25rem; }
        .auth-tagline { color: rgba(255,255,255,0.75); font-size: 1rem; }
        .auth-features { display: flex; flex-direction: column; gap: 1.5rem; position: relative; z-index: 1; }
        .auth-feature { display: flex; gap: 1rem; align-items: flex-start; }
        .auth-feature-icon { font-size: 1.75rem; flex-shrink: 0; }
        .auth-feature h4 { font-weight: 600; margin-bottom: 0.125rem; }
        .auth-feature p { color: rgba(255,255,255,0.7); font-size: 0.875rem; }
        .auth-right {
          width: 440px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          padding: 2rem;
          background: var(--bg-primary);
        }
        .auth-form-card { width: 100%; max-width: 380px; }
        .auth-lang-select {
          display: flex; gap: 0.5rem;
          margin-bottom: 2rem;
        }
        .lang-btn-auth {
          padding: 0.375rem 0.875rem;
          border-radius: var(--radius-full);
          border: 1.5px solid var(--border-color);
          background: white;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition);
        }
        .lang-btn-auth.active {
          border-color: var(--accent-primary);
          background: var(--color-green-50);
          color: var(--accent-primary);
        }
        .auth-form-title { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; }
        .auth-form-subtitle { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem; }
        .auth-link { color: var(--accent-primary); font-weight: 500; }
        .auth-demo {
          margin-top: 1.5rem;
          padding: 0.875rem;
          background: var(--color-earth-50);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-earth-200);
        }
        .auth-demo-creds {
          display: flex; gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.25rem;
          font-size: 0.8rem;
          font-family: monospace;
          color: var(--color-earth-700);
        }
        @media (max-width: 768px) {
          .auth-left { display: none; }
          .auth-right { width: 100%; }
        }
      `}</style>
    </div>
  );
}

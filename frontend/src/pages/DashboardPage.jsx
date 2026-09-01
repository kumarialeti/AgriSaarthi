import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  Sprout, Droplets, Bug, Cloud, TrendingUp, Users, FileText, Bell, Star,
  Mic, MicOff, Camera, ArrowRight, ChevronRight, MapPin, RefreshCw
} from 'lucide-react';
import { farmerApi, chatApi, weatherApi } from '../services/api';
import ChatModal from '../components/ChatModal';

const SECTION_CARDS = [
  { key: 'crops', icon: '🌾', color: 'var(--color-green-600)', bg: 'var(--color-green-50)', link: '/crops' },
  { key: 'soil', icon: '🪨', color: 'var(--color-earth-600)', bg: 'var(--color-earth-50)', link: '/soil' },
  { key: 'health', icon: '🔬', color: 'var(--color-green-700)', bg: 'var(--color-green-50)', link: '/crop-health' },
  { key: 'weather', icon: '⛅', color: 'var(--color-blue-500)', bg: 'var(--color-blue-100)', link: '/weather' },
  { key: 'market', icon: '📊', color: 'var(--color-harvest-600)', bg: 'var(--color-harvest-100)', link: '/market' },
  { key: 'buyers', icon: '🤝', color: 'var(--color-earth-500)', bg: 'var(--color-earth-100)', link: '/buyers' },
  { key: 'schemes', icon: '🏛️', color: 'var(--color-gray-700)', bg: 'var(--color-gray-100)', link: '/schemes' },
  { key: 'recommendations', icon: '⭐', color: 'var(--color-harvest-500)', bg: 'var(--color-harvest-100)', link: '/recommendations' },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [chatOpen, setChatOpen] = useState(false);
  const [askInput, setAskInput] = useState('');

  // Greeting based on time
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.goodMorning');
    if (h < 17) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  };

  // Fetch farmer profile
  const { data: profileData } = useQuery({
    queryKey: ['farmerProfile'],
    queryFn: () => farmerApi.getProfile().then(r => r.data.data),
    enabled: user?.role === 'FARMER',
    retry: false,
  });

  // Fetch my crops
  const { data: cropsData } = useQuery({
    queryKey: ['myCrops'],
    queryFn: () => farmerApi.getMyCrops().then(r => r.data.data),
    enabled: user?.role === 'FARMER',
    retry: false,
  });

  // Fetch weather
  const { data: weatherData } = useQuery({
    queryKey: ['weather', profileData?.district],
    queryFn: () => weatherApi.getByDistrict(
      profileData?.district || 'Guntur',
      profileData?.state || 'Andhra Pradesh'
    ).then(r => r.data.data),
    enabled: true,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const handleAsk = (question) => {
    setAskInput(question || '');
    setChatOpen(true);
  };

  const activeCrops = cropsData?.filter(c => c.status === 'GROWING') || [];
  const location = profileData ? `${profileData.village ? profileData.village + ', ' : ''}${profileData.district || ''}` : '';

  return (
    <div>
      {/* ── Hero Section ──────────────────────────────────────────── */}
      <div className="hero-section">
        <div className="hero-content">
          <p className="hero-tagline">{getGreeting()}, {profileData?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Farmer'} 👋</p>
          <h1 className="hero-title">{t('dashboard.askHero')}</h1>
          <p className="hero-subtitle">{t('dashboard.askSubtitle')}</p>

          {/* Ask input */}
          <div className="hero-ask-bar">
            <input
              type="text"
              placeholder={t('dashboard.askPlaceholder')}
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk(askInput)}
              className="hero-ask-input"
            />
            <button className="btn btn-harvest hero-ask-btn" onClick={() => handleAsk(askInput)}>
              {t('chat.send')} <ArrowRight size={18} />
            </button>
          </div>

          {/* Quick examples */}
          <div className="hero-examples">
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>{t('dashboard.askExamples')}</span>
            {[t('dashboard.example1'), t('dashboard.example2'), t('dashboard.example3')].map((ex, i) => (
              <button key={i} className="hero-example-chip" onClick={() => handleAsk(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Weather mini widget */}
        {weatherData && (
          <div className="hero-weather">
            <div style={{ fontSize: '2rem' }}>⛅</div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{weatherData.current?.temp_celsius}°C</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{location || weatherData.location}</div>

            </div>
          </div>
        )}
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────── */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginBottom: '2rem' }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-green-50)', color: 'var(--color-green-600)' }}>
            <Sprout size={24} />
          </div>
          <div className="stat-info">
            <h3>{activeCrops.length}</h3>
            <p>{t('dashboard.sections.crops')}</p>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-earth-50)', color: 'var(--color-earth-600)' }}>
            <Droplets size={24} />
          </div>
          <div className="stat-info">
            <h3>{profileData?.total_land_acres || '—'}</h3>
            <p>Acres</p>
          </div>
        </div>

        {location && (
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'var(--color-blue-100)', color: 'var(--color-blue-500)' }}>
              <MapPin size={24} />
            </div>
            <div className="stat-info">
              <h3 style={{ fontSize: '1rem', lineHeight: 1.3 }}>{profileData?.district || 'Set location'}</h3>
              <p>{profileData?.state || ''}</p>
            </div>
          </div>
        )}

        <div className="card stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/schemes')}>
          <div className="stat-icon" style={{ background: 'var(--color-harvest-100)', color: 'var(--color-harvest-600)' }}>
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <h3>5+</h3>
            <p>Schemes Available</p>
          </div>
        </div>
      </div>

      {/* ── Active Crops ──────────────────────────────────────────── */}
      {activeCrops.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>{t('dashboard.sections.crops')}</h3>
            <Link to="/crops" className="btn btn-ghost btn-sm">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {activeCrops.map((crop) => (
              <div key={crop.id} className="crop-quick-card">
                <span className="crop-emoji">🌿</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{crop.name_en}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{crop.acreage} acres</div>
                </div>
                <span className="badge badge-green">{t(`crops.status${crop.status.charAt(0) + crop.status.slice(1).toLowerCase()}`)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── No Profile Prompt ─────────────────────────────────────── */}
      {!profileData && user?.role === 'FARMER' && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
          <span>🌱</span>
          <div>
            <strong>{t('profile.completeProfile')}</strong>
            <div style={{ marginTop: '0.5rem' }}>
              <Link to="/profile" className="btn btn-primary btn-sm">Complete Profile</Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Section Cards ─────────────────────────────────────────── */}
      <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Quick Access
      </h3>
      <div className="section-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        {SECTION_CARDS.map((s) => (
          <Link key={s.key} to={s.link} className="section-card" style={{ textDecoration: 'none' }}>
            <div className="section-card-icon" style={{ background: s.bg, color: s.color }}>
              <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t(`dashboard.sections.${s.key}`)}
            </span>
          </Link>
        ))}
      </div>

      {/* ── Ask AgriSaarthi CTA ───────────────────────────────────── */}
      <div className="card card-green" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h3 style={{ color: 'white' }}>Have a crop question?</h3>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>
            Ask in Telugu, Hindi, or English
          </p>
        </div>
        <button className="btn" style={{ background: 'var(--color-harvest-400)', color: 'white', flexShrink: 0 }} onClick={() => setChatOpen(true)}>
          <Mic size={18} /> Ask Now
        </button>
      </div>

      {/* Chat Modal */}
      {chatOpen && <ChatModal onClose={() => setChatOpen(false)} initialMessage={askInput} />}

      <style>{`
        .hero-ask-bar {
          display: flex; gap: 0.75rem;
          margin-bottom: 1rem;
          max-width: 600px;
        }
        .hero-ask-input {
          flex: 1;
          padding: 0.875rem 1.25rem;
          border-radius: var(--radius-xl);
          border: none;
          font-size: 0.95rem;
          background: rgba(255,255,255,0.95);
          color: var(--text-primary);
          outline: none;
        }
        .hero-ask-btn { border-radius: var(--radius-xl); }
        .hero-examples { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
        .hero-example-chip {
          padding: 0.375rem 0.875rem;
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: var(--radius-full);
          color: white;
          font-size: 0.775rem;
          cursor: pointer;
          transition: all var(--transition);
          text-align: left;
        }
        .hero-example-chip:hover { background: rgba(255,255,255,0.25); }
        .hero-weather {
          position: absolute; top: 1.5rem; right: 2rem;
          display: flex; align-items: center; gap: 0.75rem;
          background: rgba(255,255,255,0.15);
          border-radius: var(--radius-lg);
          padding: 0.75rem 1rem;
          color: white;
        }
        .crop-quick-card {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--color-green-50);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-green-200);
        }
        .crop-emoji { font-size: 1.25rem; }
        @media (max-width: 600px) {
          .hero-weather { display: none; }
          .hero-ask-bar { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

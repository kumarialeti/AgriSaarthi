import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { notifApi } from '../services/api';
import { Menu, Bell, Leaf, X } from 'lucide-react';
import i18n from '../i18n';

export default function Header({ onMenuToggle }) {
  const { t } = useTranslation();
  const { user, updateLanguage } = useAuthStore();
  const [showNotifs, setShowNotifs] = useState(false);

  const { data: notifCount } = useQuery({
    queryKey: ['notifCount'],
    queryFn: () => notifApi.getCount().then(r => r.data.data.count),
    refetchInterval: 30000,
    enabled: !!user,
  });

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    updateLanguage(lang);
  };

  return (
    <header className="app-header">
      {/* Mobile menu button */}
      <button
        className="btn btn-icon btn-ghost"
        style={{ color: 'white', display: 'none' }}
        id="menu-toggle"
        onClick={onMenuToggle}
      >
        <Menu size={22} />
      </button>

      {/* Logo */}
      <Link to="/dashboard" className="header-logo">
        <div className="header-logo-icon">
          <Leaf size={20} />
        </div>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{t('app.name')}</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 400, opacity: 0.8 }}>{t('app.tagline')}</span>
        </span>
      </Link>

      <div className="header-spacer" />

      {/* Language Selector */}
      <div className="lang-selector">
        {[
          { code: 'en', label: 'EN' },
          { code: 'te', label: 'తె' },
          { code: 'hi', label: 'हि' },
        ].map(({ code, label }) => (
          <button
            key={code}
            className={`lang-btn ${i18n.language === code ? 'active' : ''}`}
            onClick={() => handleLanguageChange(code)}
            title={code === 'en' ? 'English' : code === 'te' ? 'Telugu' : 'Hindi'}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notification Bell */}
      <div className="notif-badge">
        <Link to="/notifications" className="btn btn-icon btn-ghost" style={{ color: 'white' }}>
          <Bell size={20} />
        </Link>
        {notifCount > 0 && (
          <span className="notif-dot">{notifCount > 9 ? '9+' : notifCount}</span>
        )}
      </div>

      {/* User avatar */}
      <div className="header-user">
        <Link to="/profile">
          <div className="avatar">
            {(user?.email || '?').charAt(0).toUpperCase()}
          </div>
        </Link>
      </div>

      <style>{`
        @media (max-width: 768px) {
          #menu-toggle { display: flex !important; }
        }
      `}</style>
    </header>
  );
}

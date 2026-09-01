import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard, Sprout, FlaskConical, Bug, Cloud, TrendingUp,
  Users, FileText, Star, User, LogOut, Settings, ShieldCheck,
  MessageSquare
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard', roles: ['FARMER','BUYER','AGRICULTURE_OFFICER','ADMIN'] },
  { to: '/chat', icon: MessageSquare, key: 'chat', roles: ['FARMER','AGRICULTURE_OFFICER'] },
  { separator: true, label: 'Farm Management', roles: ['FARMER'] },
  { to: '/crops', icon: Sprout, key: 'myCrops', roles: ['FARMER'] },
  { to: '/soil', icon: FlaskConical, key: 'soilAnalysis', roles: ['FARMER'] },
  { to: '/crop-health', icon: Bug, key: 'cropHealth', roles: ['FARMER'] },
  { separator: true, label: 'Market & Buyers', roles: ['FARMER','BUYER'] },
  { to: '/weather', icon: Cloud, key: 'weather', roles: ['FARMER','AGRICULTURE_OFFICER'] },
  { to: '/market', icon: TrendingUp, key: 'marketPrices', roles: ['FARMER','BUYER'] },
  { to: '/buyers', icon: Users, key: 'findBuyers', roles: ['FARMER','BUYER'] },
  { separator: true, label: 'Support', roles: ['FARMER','AGRICULTURE_OFFICER'] },
  { to: '/schemes', icon: FileText, key: 'schemes', roles: ['FARMER','AGRICULTURE_OFFICER'] },
  { to: '/recommendations', icon: Star, key: 'recommendations', roles: ['FARMER'] },
  { separator: true, label: 'Admin', roles: ['ADMIN','AGRICULTURE_OFFICER'] },
  { to: '/admin', icon: ShieldCheck, key: 'admin', roles: ['ADMIN','AGRICULTURE_OFFICER'] },
];

export default function Sidebar({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.separator) return item.roles.some(r => r === user?.role);
    return item.roles.includes(user?.role);
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 89 }}
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* User info */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="avatar" style={{ width: 40, height: 40, fontSize: '1rem' }}>
              {(user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user?.email?.split('@')[0]}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>
                {user?.role?.toLowerCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav>
          {visibleItems.map((item, i) => {
            if (item.separator) {
              return (
                <div key={i} className="nav-section-label">{item.label}</div>
              );
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon className="nav-icon" />
                {t(`nav.${item.key}`)}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div style={{ marginTop: 'auto', padding: '1rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
            <User className="nav-icon" />
            {t('nav.profile')}
          </NavLink>
          <button className="nav-item" onClick={handleLogout} style={{ color: 'rgba(255,150,150,0.9)' }}>
            <LogOut className="nav-icon" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>
    </>
  );
}

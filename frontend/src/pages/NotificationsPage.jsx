import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifApi } from '../services/api';
import { Bell, Check, Info, AlertTriangle, Sprout } from 'lucide-react';

const TYPE_ICONS = {
  INFO: <Info size={18} color="var(--color-blue-500)" />,
  WARNING: <AlertTriangle size={18} color="var(--color-harvest-500)" />,
  ALERT: <AlertTriangle size={18} color="var(--color-red-500)" />,
  RECOMMENDATION: <Sprout size={18} color="var(--color-green-500)" />,
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const qClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notifApi.getAll().then(r => r.data.data),
  });

  const markRead = useMutation({
    mutationFn: (id) => notifApi.markRead(id),
    onSuccess: () => {
      qClient.invalidateQueries({ queryKey: ['notifications'] });
      qClient.invalidateQueries({ queryKey: ['notifCount'] });
    }
  });

  const markAllRead = useMutation({
    mutationFn: () => notifApi.markAllRead(),
    onSuccess: () => {
      qClient.invalidateQueries({ queryKey: ['notifications'] });
      qClient.invalidateQueries({ queryKey: ['notifCount'] });
    }
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>🔔 {t('nav.notifications')}</h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => markAllRead.mutate()} disabled={!notifications?.some(n => !n.is_read)}>
          <Check size={16} /> Mark all as read
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '80px' }}></div>)}
        </div>
      ) : !notifications?.length ? (
        <div className="card text-center" style={{ padding: '3rem 1rem' }}>
          <Bell size={32} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ color: 'var(--text-secondary)' }}>No notifications yet</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notifications.map(n => (
            <div key={n.id} className={`card ${!n.is_read ? 'unread' : ''}`} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderLeft: !n.is_read ? '4px solid var(--accent-primary)' : '1px solid var(--border-color)', opacity: n.is_read ? 0.7 : 1 }}>
              <div style={{ marginTop: '0.25rem' }}>
                {TYPE_ICONS[n.type] || <Bell size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{n.title_en}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{n.message_en}</p>
              </div>
              {!n.is_read && (
                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => markRead.mutate(n.id)} title="Mark as read">
                  <Check size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

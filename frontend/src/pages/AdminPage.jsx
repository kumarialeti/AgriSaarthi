import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../services/api';
import { ShieldCheck, Users, Map, Sprout, AlertCircle } from 'lucide-react';

export default function AdminPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => adminApi.getStats().then(r => r.data.data),
  });

  const { data: trends } = useQuery({
    queryKey: ['adminTrends'],
    queryFn: () => adminApi.getMarketTrends().then(r => r.data.data),
  });

  return (
    <div>
      <div className="page-header">
        <h1><ShieldCheck size={28} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--color-blue-600)' }}/> Admin Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>System overview and regional statistics</p>
      </div>

      {statsLoading ? (
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton card" style={{ height: '100px', flex: 1 }}></div>)}
        </div>
      ) : stats ? (
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '2rem' }}>
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'var(--color-blue-100)', color: 'var(--color-blue-600)' }}><Users size={24} /></div>
            <div className="stat-info"><h3>{stats.total_users || 0}</h3><p>Total Users</p></div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'var(--color-green-100)', color: 'var(--color-green-600)' }}><Sprout size={24} /></div>
            <div className="stat-info"><h3>{stats.total_crops || 0}</h3><p>Active Crops</p></div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'var(--color-earth-100)', color: 'var(--color-earth-600)' }}><Map size={24} /></div>
            <div className="stat-info"><h3>{stats.total_land_acres || 0}</h3><p>Total Acres Mapped</p></div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'var(--color-red-100)', color: 'var(--color-red-600)' }}><AlertCircle size={24} /></div>
            <div className="stat-info"><h3>{stats.disease_alerts || 0}</h3><p>Disease Alerts</p></div>
          </div>
        </div>
      ) : null}

      <div className="dashboard-grid-2">
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Regional Market Trends</h3>
          {trends ? (
             <table className="price-table">
               <thead><tr><th>Region</th><th>Crop</th><th>Avg Price</th></tr></thead>
               <tbody>
                 {trends.map((t, i) => (
                   <tr key={i}><td>{t.region}</td><td>{t.crop}</td><td>₹{t.avg_price}/q</td></tr>
                 ))}
               </tbody>
             </table>
          ) : <p className="text-muted">No trend data available.</p>}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>System Alerts</h3>
          <div className="alert alert-info">
             <AlertCircle size={16} />
             <span>All services operational. API endpoints responding normally.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

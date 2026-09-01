import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { recommendApi } from '../services/api';
import { Star, Leaf, TrendingUp } from 'lucide-react';

export default function RecommendationsPage() {
  const { t } = useTranslation();
  const { data: recs, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => recommendApi.getAll().then(r => r.data.data),
  });

  return (
    <div>
      <div className="page-header">
        <h1>⭐ {t('nav.recommendations')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>AI-driven insights tailored for your farm</p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton card" style={{ height: '120px' }}></div>)}
        </div>
      ) : !recs?.length ? (
        <div className="card text-center" style={{ padding: '3rem 1rem' }}>
           <Star size={32} color="var(--color-harvest-400)" style={{ margin: '0 auto 1rem' }} />
           <h3 style={{ color: 'var(--text-secondary)' }}>No recommendations yet</h3>
           <p className="text-sm text-muted">Complete your profile and add crops to get personalized advice.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {recs.map(r => (
            <div key={r.id} className="card" style={{ borderTop: '4px solid var(--color-harvest-500)' }}>
               <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                 {r.type === 'CROP' ? <Leaf size={18} color="var(--color-green-600)"/> : <TrendingUp size={18} color="var(--color-blue-600)"/>}
                 {r.title_en}
               </h4>
               <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.description_en}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

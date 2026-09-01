import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { schemesApi } from '../services/api';
import { Search, ExternalLink, FileText, ChevronDown, ChevronUp } from 'lucide-react';

function SchemeCard({ scheme }) {
  const { i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const lang = i18n.language;

  const name = lang === 'te' ? scheme.name_te : lang === 'hi' ? scheme.name_hi : scheme.name_en;
  const benefits = lang === 'te' ? scheme.benefits_te : lang === 'hi' ? scheme.benefits_hi : scheme.benefits_en;
  const eligibility = lang === 'te' ? scheme.eligibility_te : lang === 'hi' ? scheme.eligibility_hi : scheme.eligibility_en;
  const documents = lang === 'te' ? scheme.documents_te : lang === 'hi' ? scheme.documents_hi : scheme.documents_en;

  return (
    <div className="card card-hover">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <h4 style={{ fontSize: '1rem' }}>{name || scheme.name_en}</h4>
            <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>{scheme.scheme_code}</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {(benefits || '').substring(0, 150)}{benefits?.length > 150 ? '...' : ''}
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setExpanded(!expanded)}
          style={{ flexShrink: 0 }}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.875rem', animation: 'fadeIn 0.2s ease' }}>
          {benefits && (
            <div>
              <h5 style={{ color: 'var(--color-green-700)', marginBottom: '0.375rem' }}>✅ Benefits</h5>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.7 }}>{benefits}</p>
            </div>
          )}

          {eligibility && (
            <div>
              <h5 style={{ color: 'var(--color-earth-600)', marginBottom: '0.375rem' }}>📋 Eligibility</h5>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.7 }}>{eligibility}</p>
            </div>
          )}

          {documents && (
            <div>
              <h5 style={{ color: 'var(--color-gray-700)', marginBottom: '0.375rem' }}>📎 Required Documents</h5>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.7 }}>{documents}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            {scheme.application_url && (
              <a href={scheme.application_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                Apply Online <ExternalLink size={12} />
              </a>
            )}
            {scheme.ministry_name && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                Source: {scheme.ministry_name}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchemesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data: schemes, isLoading } = useQuery({
    queryKey: ['schemes', debouncedSearch],
    queryFn: () => schemesApi.getSchemes({ search: debouncedSearch || undefined }).then(r => r.data.data),
    retry: false,
  });

  const handleSearch = (val) => {
    setSearch(val);
    const t = setTimeout(() => setDebouncedSearch(val), 400);
    return () => clearTimeout(t);
  };

  return (
    <div>
      <div className="page-header">
        <h1>🏛️ {t('schemes.title')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Discover central and state government schemes for farmers</p>
      </div>

      {/* Highlighted schemes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { code: 'PM-KISAN', icon: '💵', color: 'var(--color-green-700)', desc: '₹6,000/year direct income' },
          { code: 'PMFBY', icon: '🛡️', color: 'var(--color-blue-600)', desc: 'Crop insurance' },
          { code: 'KCC', icon: '💳', color: 'var(--color-harvest-600)', desc: 'Kisan Credit Card' },
          { code: 'eNAM', icon: '📱', color: 'var(--color-earth-600)', desc: 'Digital market access' },
        ].map(s => (
          <div key={s.code} style={{ padding: '1.25rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setSearch(s.code)}>
            <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
            <div>
              <div style={{ fontWeight: 700, color: s.color, fontSize: '0.875rem' }}>{s.code}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: '500px' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="form-input"
          placeholder={t('schemes.search')}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ paddingLeft: '2.75rem' }}
        />
      </div>

      {/* Schemes List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '100px' }}></div>)}
        </div>
      ) : !schemes?.length ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FileText size={28} /></div>
          <h3>{t('schemes.noSchemes')}</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {schemes.map(s => <SchemeCard key={s.id} scheme={s} />)}
        </div>
      )}
    </div>
  );
}

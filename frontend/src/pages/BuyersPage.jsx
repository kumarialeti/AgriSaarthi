import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { buyerApi } from '../services/api';
import { Users, Filter, MapPin, Truck, ExternalLink } from 'lucide-react';

export default function BuyersPage() {
  const { t } = useTranslation();
  
  const { data: requirements, isLoading } = useQuery({
    queryKey: ['buyerRequirements'],
    queryFn: () => buyerApi.getOpenRequirements().then(r => r.data.data),
    retry: false,
  });

  return (
    <div>
      <div className="page-header">
        <h1>🤝 {t('nav.findBuyers')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Connect with buyers looking for your crops</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'white', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <Filter size={16} color="var(--text-muted)" />
          <input type="text" placeholder="Filter by crop..." style={{ border: 'none', outline: 'none', width: '100%' }} />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '150px' }}></div>)}
        </div>
      ) : !requirements?.length ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={28} /></div>
            <h3>No open requirements</h3>
            <p>Check back later for new buyer requirements.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {requirements.map(req => (
            <div key={req.id} className="card card-hover" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', margin: 0 }}>{req.crop_name}</h3>
                  <span className="badge badge-harvest">{req.quantity_required_kg} kg</span>
                  <span className="badge badge-green">₹{req.offered_price_per_kg}/kg</span>
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}><Users size={14} /> {req.buyer_name || 'Buyer'}</span>
                  <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}><MapPin size={14} /> {req.delivery_location || 'Not specified'}</span>
                  <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}><Truck size={14} /> {req.transport_provided ? 'Transport Provided' : 'Self Transport'}</span>
                </div>
                {req.quality_parameters && (
                   <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                     <strong>Quality Req:</strong> {req.quality_parameters}
                   </p>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '140px' }}>
                <button className="btn btn-primary" style={{ width: '100%' }}>Contact Buyer</button>
                <div style={{ fontSize: '0.7rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Expires: {new Date(req.fulfillment_deadline).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buyerApi, farmerApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Users, Filter, MapPin, Truck, Plus, X, ListOrdered } from 'lucide-react';

export default function BuyersPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isBuyer = user?.role === 'BUYER';
  const qClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    crop_id: '',
    quantity_kg: '',
    desired_price_quintal: '',
    delivery_location: '',
    required_by: '',
    quality_specs: ''
  });
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch requirements based on role
  const { data: requirements, isLoading } = useQuery({
    queryKey: ['buyerRequirements', isBuyer ? 'my' : 'open'],
    queryFn: () => isBuyer 
      ? buyerApi.getMyRequirements().then(r => r.data.data)
      : buyerApi.getOpenRequirements().then(r => r.data.data),
    retry: false,
  });

  // Fetch all crops for the modal
  const { data: allCrops } = useQuery({
    queryKey: ['allCrops'],
    queryFn: () => farmerApi.getAllCrops().then(r => r.data.data),
    enabled: isBuyer,
    staleTime: 60 * 60 * 1000,
  });

  const createReqMutation = useMutation({
    mutationFn: (data) => buyerApi.createRequirement(data).then(r => r.data),
    onSuccess: () => {
      qClient.invalidateQueries({ queryKey: ['buyerRequirements'] });
      setShowModal(false);
      setFormData({
        crop_id: '',
        quantity_kg: '',
        desired_price_quintal: '',
        delivery_location: '',
        required_by: '',
        quality_specs: ''
      });
      setErrorMsg('');
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.error || 'Failed to post requirement.');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.crop_id || !formData.quantity_kg) {
      setErrorMsg('Crop and Quantity are required.');
      return;
    }
    createReqMutation.mutate(formData);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>🤝 {isBuyer ? 'My Requirements' : t('nav.findBuyers')}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isBuyer 
              ? 'Manage your crop procurement requirements' 
              : 'Connect with buyers looking for your crops'}
          </p>
        </div>
        {isBuyer && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Post Requirement
          </button>
        )}
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
            <div className="empty-state-icon"><ListOrdered size={28} /></div>
            <h3>{isBuyer ? 'No Requirements Posted' : 'No Open Requirements'}</h3>
            <p>{isBuyer ? 'Post your first crop requirement to find sellers.' : 'Check back later for new buyer requirements.'}</p>
            {isBuyer && (
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowModal(true)}>
                <Plus size={18} /> Post Requirement
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {requirements.map(req => (
            <div key={req.id} className="card card-hover" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', margin: 0 }}>{req.crop_name}</h3>
                  <span className="badge badge-harvest">{req.quantity_kg || req.quantity_required_kg} kg</span>
                  {req.desired_price_quintal && (
                    <span className="badge badge-green">₹{req.desired_price_quintal}/q</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                  {!isBuyer && <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}><Users size={14} /> {req.buyer_name || req.company_name || 'Buyer'}</span>}
                  <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}><MapPin size={14} /> {req.delivery_location || 'Not specified'}</span>
                  <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}><Truck size={14} /> {req.transport_provided ? 'Transport Provided' : 'Self Transport'}</span>
                </div>
                {req.quality_specs && (
                   <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                     <strong>Quality Req:</strong> {req.quality_specs}
                   </p>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '140px' }}>
                {!isBuyer ? (
                  <button className="btn btn-primary" style={{ width: '100%' }}>Contact Buyer</button>
                ) : (
                  <div className="badge" style={{ alignSelf: 'flex-start', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    {req.status || 'OPEN'}
                  </div>
                )}
                {req.required_by && (
                  <div style={{ fontSize: '0.7rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Deadline: {new Date(req.required_by).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Requirement Modal */}
      {showModal && isBuyer && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Post Crop Requirement</h2>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
              
              <div className="form-group">
                <label>Select Crop <span style={{ color: 'red' }}>*</span></label>
                <select 
                  className="input" 
                  value={formData.crop_id} 
                  onChange={e => setFormData({...formData, crop_id: e.target.value})}
                  required
                >
                  <option value="">-- Choose Crop --</option>
                  {allCrops?.map(c => (
                    <option key={c.id} value={c.id}>{c.name_en} ({c.name_te})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Quantity (kg) <span style={{ color: 'red' }}>*</span></label>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="e.g. 1000"
                    min="1"
                    value={formData.quantity_kg} 
                    onChange={e => setFormData({...formData, quantity_kg: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Target Price (₹/quintal)</label>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="Optional"
                    min="0"
                    value={formData.desired_price_quintal} 
                    onChange={e => setFormData({...formData, desired_price_quintal: e.target.value})}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Delivery Location</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="City, District"
                    value={formData.delivery_location} 
                    onChange={e => setFormData({...formData, delivery_location: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Deadline Date</label>
                  <input 
                    type="date" 
                    className="input" 
                    value={formData.required_by} 
                    onChange={e => setFormData({...formData, required_by: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Quality Requirements / Remarks</label>
                <textarea 
                  className="input" 
                  rows="3" 
                  placeholder="e.g. Moisture < 12%, specific variety..."
                  value={formData.quality_specs} 
                  onChange={e => setFormData({...formData, quality_specs: e.target.value})}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createReqMutation.isPending}>
                  {createReqMutation.isPending ? 'Posting...' : 'Post Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

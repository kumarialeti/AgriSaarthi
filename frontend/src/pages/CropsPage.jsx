import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { farmerApi } from '../services/api';
import { Plus, Trash2, Edit3, Sprout, X, Check } from 'lucide-react';

const STATUS_COLORS = {
  PLANNED:   { badge: 'badge-gray', label: 'Planned' },
  GROWING:   { badge: 'badge-green', label: 'Growing' },
  HARVESTED: { badge: 'badge-earth', label: 'Harvested' },
  FAILED:    { badge: 'badge-red', label: 'Failed' },
};

function CropForm({ crop, allCrops, onSave, onCancel, isLoading }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(crop || {
    crop_id: '', acreage: '', sowing_date: '', expected_harvest_date: '',
    irrigation_type: 'RAINFED', soil_type_at_field: '', status: 'PLANNED', notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        <div className="form-group">
          <label className="form-label">{t('crops.cropName')} *</label>
          <select className="form-select" value={form.crop_id} onChange={(e) => setForm({ ...form, crop_id: e.target.value })} required>
            <option value="">Select crop</option>
            {allCrops?.map(c => <option key={c.id} value={c.id}>{c.name_en} ({c.name_te})</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">{t('crops.acreage')} *</label>
          <input type="number" className="form-input" value={form.acreage} onChange={(e) => setForm({ ...form, acreage: e.target.value })} min="0.1" step="0.1" required />
        </div>

        <div className="form-group">
          <label className="form-label">{t('crops.sowingDate')}</label>
          <input type="date" className="form-input" value={form.sowing_date?.slice(0, 10) || ''} onChange={(e) => setForm({ ...form, sowing_date: e.target.value })} />
        </div>

        <div className="form-group">
          <label className="form-label">{t('crops.harvestDate')}</label>
          <input type="date" className="form-input" value={form.expected_harvest_date?.slice(0, 10) || ''} onChange={(e) => setForm({ ...form, expected_harvest_date: e.target.value })} />
        </div>

        <div className="form-group">
          <label className="form-label">{t('crops.irrigationType')}</label>
          <select className="form-select" value={form.irrigation_type} onChange={(e) => setForm({ ...form, irrigation_type: e.target.value })}>
            {['RAINFED','DRIP','FLOOD','SPRINKLER','CANAL','BOREWELL'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">{t('crops.status')}</label>
          <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {['PLANNED','GROWING','HARVESTED','FAILED'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t('crops.soilType')}</label>
        <input type="text" className="form-input" value={form.soil_type_at_field || ''} onChange={(e) => setForm({ ...form, soil_type_at_field: e.target.value })} placeholder="e.g. Black Cotton, Red Sandy Loam" />
      </div>

      <div className="form-group">
        <label className="form-label">{t('crops.notes')}</label>
        <textarea className="form-textarea" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          <X size={16} /> {t('app.cancel')}
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? <span className="loading-spinner" style={{ width: 16, height: 16 }}></span> : <Check size={16} />}
          {t('app.save')}
        </button>
      </div>
    </form>
  );
}

export default function CropsPage() {
  const { t } = useTranslation();
  const qClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingCrop, setEditingCrop] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: allCrops } = useQuery({
    queryKey: ['allCrops'],
    queryFn: () => farmerApi.getAllCrops().then(r => r.data.data),
  });

  const { data: myCrops, isLoading } = useQuery({
    queryKey: ['myCrops'],
    queryFn: () => farmerApi.getMyCrops().then(r => r.data.data),
    retry: false,
  });

  const getCropName = (cropId) => allCrops?.find(c => c.id === cropId)?.name_en || cropId;

  const addMutation = useMutation({
    mutationFn: (data) => farmerApi.createCrop(data),
    onSuccess: () => { qClient.invalidateQueries({ queryKey: ['myCrops'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => farmerApi.updateCrop(id, data),
    onSuccess: () => { qClient.invalidateQueries({ queryKey: ['myCrops'] }); setEditingCrop(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => farmerApi.deleteCrop(id),
    onSuccess: () => { qClient.invalidateQueries({ queryKey: ['myCrops'] }); setConfirmDelete(null); },
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>🌾 {t('crops.myCrops')}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your crops and track growth</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingCrop(null); }}>
          <Plus size={18} /> {t('crops.addCrop')}
        </button>
      </div>

      {/* Add Crop Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--color-green-300)' }}>
          <h3 style={{ marginBottom: '1.25rem' }}>{t('crops.addCrop')}</h3>
          <CropForm
            allCrops={allCrops}
            onSave={(data) => addMutation.mutate(data)}
            onCancel={() => setShowForm(false)}
            isLoading={addMutation.isPending}
          />
        </div>
      )}

      {/* Crops List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }}></div>)}
        </div>
      ) : !myCrops?.length ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><Sprout size={32} /></div>
            <h3>{t('crops.noCrops')}</h3>
            <p>{t('crops.noCropsSubtitle')}</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={16} /> {t('crops.addCrop')}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {myCrops.map((crop) => {
            const sc = STATUS_COLORS[crop.status] || STATUS_COLORS.PLANNED;

            if (editingCrop?.id === crop.id) {
              return (
                <div key={crop.id} className="card" style={{ border: '2px solid var(--color-green-300)' }}>
                  <h4 style={{ marginBottom: '1rem' }}>Edit: {crop.name_en}</h4>
                  <CropForm
                    crop={{ ...crop, crop_id: crop.crop_id }}
                    allCrops={allCrops}
                    onSave={(data) => updateMutation.mutate({ id: crop.id, data })}
                    onCancel={() => setEditingCrop(null)}
                    isLoading={updateMutation.isPending}
                  />
                </div>
              );
            }

            return (
              <div key={crop.id} className="card card-hover">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ width: 52, height: 52, background: 'var(--color-green-50)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                    🌿
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <h4>{crop.name_en}</h4>
                      <span className={`badge ${sc.badge}`}>{sc.label}</span>
                      {crop.name_te && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{crop.name_te}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <span>🌍 {crop.acreage} acres</span>
                      {crop.sowing_date && <span>📅 Sown: {new Date(crop.sowing_date).toLocaleDateString()}</span>}
                      {crop.expected_harvest_date && <span>🌾 Harvest: {new Date(crop.expected_harvest_date).toLocaleDateString()}</span>}
                      {crop.irrigation_type && <span>💧 {crop.irrigation_type}</span>}
                    </div>
                    {crop.notes && <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{crop.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingCrop(crop)} title="Edit">
                      <Edit3 size={15} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-red-500)' }} onClick={() => setConfirmDelete(crop.id)} title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div className="card" style={{ maxWidth: '380px', width: '90%' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>{t('crops.deleteCrop')}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{t('crops.deleteConfirm')}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>{t('app.cancel')}</button>
              <button className="btn btn-danger" onClick={() => deleteMutation.mutate(confirmDelete)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <span className="loading-spinner" style={{ width: 16, height: 16 }}></span> : <Trash2 size={16} />}
                {t('app.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

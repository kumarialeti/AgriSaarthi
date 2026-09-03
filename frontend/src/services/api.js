import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('agrisaarthi_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// Response interceptor: handle 401 (auto-logout)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('agrisaarthi_token');
      localStorage.removeItem('agrisaarthi_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/api/auth/register', data),
  login:    (data) => api.post('/api/auth/login', data),
  getMe:    ()     => api.get('/api/auth/me'),
  updateLanguage: (lang) => api.put('/api/auth/language', { language: lang }),
};

// ─── Farmer ───────────────────────────────────────────────────────
export const farmerApi = {
  getProfile:     () => api.get('/api/farmer/profile'),
  updateProfile:  (data) => api.put('/api/farmer/profile', data),
  getAllCrops:    () => api.get('/api/farmer/crops/all'),
  getMyCrops:    () => api.get('/api/farmer/crops'),
  createCrop:    (data) => api.post('/api/farmer/crops', data),
  updateCrop:    (id, data) => api.put(`/api/farmer/crops/${id}`, data),
  deleteCrop:    (id) => api.delete(`/api/farmer/crops/${id}`),
};

// ─── Soil ─────────────────────────────────────────────────────────
export const soilApi = {
  getReports:   () => api.get('/api/soil'),
  createManual: (data) => api.post('/api/soil/manual', data),
  uploadReport: (formData) => api.post('/api/soil/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateReport: (id, data) => api.put(`/api/soil/${id}`, data),
};

// ─── Crop Health ───────────────────────────────────────────────────
export const healthApi = {
  analyze:    (formData) => api.post('/api/crop-health/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
  }),
  getReports: (params) => api.get('/api/crop-health/reports', { params }),
};

// ─── Weather ──────────────────────────────────────────────────────
export const weatherApi = {
  // Fetch by explicit coordinates (preferred when farmer profile has lat/lon)
  getWeatherByCoords: (lat, lon) => api.get('/api/weather', { params: { lat, lon } }),
  // Fetch by district+state name (fallback when only district is known)
  getByDistrict:      (district, state) => api.get(`/api/weather/district/${encodeURIComponent(district)}/${encodeURIComponent(state)}`),
  // Legacy: pass arbitrary query params
  getWeather:         (params) => api.get('/api/weather', { params }),
};

// ─── Market ───────────────────────────────────────────────────────
export const marketApi = {
  getPrices:      (params) => api.get('/api/market/prices', { params }),
  getMarkets:     (params) => api.get('/api/market/markets', { params }),
  calculate:      (data)   => api.post('/api/market/calculate', data),
  // NEW: live prices from Agmarknet/data.gov.in
  getLivePrices:  (params) => api.get('/api/market/live', { params }),
};

// ─── Buyers ───────────────────────────────────────────────────────
export const buyerApi = {
  getProfile:            () => api.get('/api/buyers/profile'),
  updateProfile:         (data) => api.put('/api/buyers/profile', data),
  getOpenRequirements:   () => api.get('/api/buyers/open-requirements'),
  getFarmerMatches:      () => api.get('/api/buyers/matches'),
  findCooperative:       (reqId) => api.get(`/api/buyers/cooperative/${reqId}`),
  createRequirement:     (data) => api.post('/api/buyers/requirements', data),
  getMyRequirements:     () => api.get('/api/buyers/requirements'),
};

// ─── Chat ─────────────────────────────────────────────────────────
export const chatApi = {
  startSession:    (data) => api.post('/api/chat/sessions', data),
  getSessions:     () => api.get('/api/chat/sessions'),
  getMessages:     (sessionId) => api.get(`/api/chat/sessions/${sessionId}/messages`),
  sendMessage:     (sessionId, data) => api.post(`/api/chat/sessions/${sessionId}/messages`, data),
};

// ─── Schemes ──────────────────────────────────────────────────────
export const schemesApi = {
  getSchemes:  (params) => api.get('/api/schemes', { params }),
  getScheme:   (id)     => api.get(`/api/schemes/${id}`),
};

// ─── Notifications ────────────────────────────────────────────────
export const notifApi = {
  getAll:      () => api.get('/api/notifications'),
  getCount:    () => api.get('/api/notifications/count'),
  markRead:    (id) => api.put(`/api/notifications/${id}/read`),
  markAllRead: () => api.put('/api/notifications/mark-all-read'),
};

// ─── Recommendations ───────────────────────────────────────────────
export const recommendApi = {
  getAll: () => api.get('/api/recommendations'),
};

// ─── Admin ────────────────────────────────────────────────────────
export const adminApi = {
  getStats:       () => api.get('/api/admin/stats'),
  getFarmers:     (params) => api.get('/api/admin/farmers', { params }),
  getMarketTrends: () => api.get('/api/admin/market-trends'),
};

import { create } from 'zustand';
import { authApi } from '../services/api';

const getStoredUser = () => {
  try {
    const u = localStorage.getItem('agrisaarthi_user');
    return u ? JSON.parse(u) : null;
  } catch { return null; }
};

export const useAuthStore = create((set, get) => ({
  user: getStoredUser(),
  token: localStorage.getItem('agrisaarthi_token'),
  isAuthenticated: !!localStorage.getItem('agrisaarthi_token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.login({ email, password });
      const { user, token } = res.data.data;
      localStorage.setItem('agrisaarthi_token', token);
      localStorage.setItem('agrisaarthi_user', JSON.stringify(user));
      localStorage.setItem('agrisaarthi_language', user.language || 'en');
      set({ user, token, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err) {
      const error = err.response?.data?.error || 'Login failed. Please try again.';
      set({ error, isLoading: false });
      return { success: false, error };
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.register(data);
      const { user, token } = res.data.data;
      localStorage.setItem('agrisaarthi_token', token);
      localStorage.setItem('agrisaarthi_user', JSON.stringify(user));
      localStorage.setItem('agrisaarthi_language', data.language || 'en');
      set({ user, token, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err) {
      const error = err.response?.data?.error || 'Registration failed.';
      set({ error, isLoading: false });
      return { success: false, error };
    }
  },

  logout: () => {
    localStorage.removeItem('agrisaarthi_token');
    localStorage.removeItem('agrisaarthi_user');
    set({ user: null, token: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  updateLanguage: async (lang) => {
    try {
      await authApi.updateLanguage(lang);
      const user = { ...get().user, language: lang };
      localStorage.setItem('agrisaarthi_user', JSON.stringify(user));
      localStorage.setItem('agrisaarthi_language', lang);
      set({ user });
    } catch (err) {
      console.error('Failed to update language:', err);
    }
  },

  clearError: () => set({ error: null }),
}));

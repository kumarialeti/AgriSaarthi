import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n';
import './App.css';
import AppLayout from './layouts/AppLayout';
import { useAuthStore } from './store/authStore';

// Lazy-loaded pages
const LoginPage     = lazy(() => import('./pages/LoginPage'));
const RegisterPage  = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CropsPage     = lazy(() => import('./pages/CropsPage'));
const SoilPage      = lazy(() => import('./pages/SoilPage'));
const CropHealthPage = lazy(() => import('./pages/CropHealthPage'));
const WeatherPage   = lazy(() => import('./pages/WeatherPage'));
const MarketPage    = lazy(() => import('./pages/MarketPage'));
const BuyersPage    = lazy(() => import('./pages/BuyersPage'));
const SchemesPage   = lazy(() => import('./pages/SchemesPage'));
const ChatPage      = lazy(() => import('./pages/ChatPage'));
const ProfilePage   = lazy(() => import('./pages/ProfilePage'));
const FieldsPage    = lazy(() => import('./pages/FieldsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const AdminPage     = lazy(() => import('./pages/AdminPage'));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
    },
  },
});

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
      <div className="loading-spinner"></div>
    </div>
  );
}

function ProtectedRoute({ element, roles }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return element;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected app routes */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/fields" element={<FieldsPage />} />
              <Route path="/crops" element={<CropsPage />} />
              <Route path="/soil" element={<SoilPage />} />
              <Route path="/crop-health" element={<CropHealthPage />} />
              <Route path="/weather" element={<WeatherPage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/buyers" element={<BuyersPage />} />
              <Route path="/schemes" element={<SchemesPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/recommendations" element={<RecommendationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute
                    element={<AdminPage />}
                    roles={['ADMIN', 'AGRICULTURE_OFFICER']}
                  />
                }
              />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

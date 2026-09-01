/**
 * WeatherPage.jsx — Phase 5 rewrite
 *
 * Priority logic:
 *  1. Farmer profile has location_lat + location_lng → use coords (most accurate)
 *  2. Farmer profile has district only              → use district/state lookup
 *  3. No location at all                            → show "please update profile" (no assumed location)
 *
 * Handles backend statuses:
 *  - success           → display live Open-Meteo data
 *  - data_unavailable  → show service-unavailable notice
 *  - missing_context   → show "update your location" prompt
 *
 * Field names match weatherController normalizeWeather() output:
 *  current.temp_celsius, current.feels_like_celsius, current.humidity_pct,
 *  current.wind_speed_kmh, current.description, current.condition
 *  forecast[].date, .temp_max, .temp_min, .description, .condition, .rain_probability_pct
 */

import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { weatherApi, farmerApi } from '../services/api';
import {
  Cloud, Droplets, Wind, Thermometer, AlertCircle, MapPin,
  RefreshCw, WifiOff, Leaf,
} from 'lucide-react';

// WMO condition → emoji
const CONDITION_EMOJI = {
  Clear: '☀️', Clouds: '⛅', Rain: '🌧️', Drizzle: '🌦️',
  Thunderstorm: '⛈️', Snow: '❄️', Fog: '🌫️', Mist: '🌫️',
};

const conditionEmoji = (condition) => CONDITION_EMOJI[condition] || '🌤️';

// ─── Sub-components ───────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div>
      <div className="page-header">
        <h1>⛅ Weather</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: '160px', borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    </div>
  );
}

function MissingLocationBanner({ onGoToProfile }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Location Required for Weather</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 1.5rem' }}>
        To show live weather for your farm, AgriSaarthi needs your location.
        Please add your <strong>district</strong> or <strong>GPS coordinates</strong> in your profile.
      </p>
      <a href="/profile" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        <MapPin size={16} /> Update Farm Location
      </a>
    </div>
  );
}

function DataUnavailableBanner({ message, onRetry }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', borderColor: 'var(--color-amber-300)' }}>
      <WifiOff size={36} style={{ color: 'var(--color-amber-500)', margin: '0 auto 1rem' }} />
      <h3 style={{ marginBottom: '0.5rem' }}>Weather Temporarily Unavailable</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
        {message || 'Live weather data cannot be fetched right now. Please try again shortly.'}
      </p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={14} /> Try Again
        </button>
      )}
    </div>
  );
}

function CurrentWeatherCard({ current, location, lastUpdated, source }) {
  const emoji = conditionEmoji(current.condition);
  const stats = [
    { icon: <Droplets size={15} />, label: 'Humidity', value: `${current.humidity_pct ?? '--'}%` },
    { icon: <Wind size={15} />, label: 'Wind', value: `${current.wind_speed_kmh ?? '--'} km/h` },
    { icon: <Thermometer size={15} />, label: 'Feels Like', value: `${current.feels_like_celsius ?? '--'}°C` },
  ];

  return (
    <div className="card" style={{
      background: 'linear-gradient(135deg, #1a6b3a 0%, #2d9b5a 60%, #4fc87a 100%)',
      color: 'white',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.85, fontSize: '0.82rem', marginBottom: '0.5rem' }}>
            <MapPin size={13} /> {location}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '3.5rem', lineHeight: 1 }}>{emoji}</span>
            <div>
              <div style={{ fontSize: '3rem', fontWeight: 300, lineHeight: 1 }}>
                {current.temp_celsius}°C
              </div>
              <div style={{ opacity: 0.85, fontSize: '0.875rem', textTransform: 'capitalize' }}>
                {current.description}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              minWidth: '90px',
            }}>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', opacity: 0.8, fontSize: '0.72rem', marginBottom: '0.25rem' }}>
                {s.icon} {s.label}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1rem', opacity: 0.6, fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between' }}>
        <span>Source: {source === 'open-meteo' ? 'Open-Meteo (Live)' : source}</span>
        <span>Updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '--'}</span>
      </div>
    </div>
  );
}

function ForecastCard({ forecast }) {
  if (!forecast?.length) return null;
  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '1.25rem' }}>📅 5-Day Forecast</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(forecast.length, 5)}, 1fr)`,
        gap: '0.75rem',
      }}>
        {forecast.slice(0, 5).map((day, i) => (
          <div key={i} style={{
            textAlign: 'center',
            padding: '0.75rem 0.5rem',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              {i === 0 ? 'Today' : new Date(day.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' })}
            </div>
            <div style={{ fontSize: '1.6rem', margin: '0.25rem 0' }}>
              {conditionEmoji(day.condition)}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{day.temp_max}°</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{day.temp_min}°</div>
            {day.rain_probability_pct > 30 && (
              <div style={{ color: '#2563eb', fontSize: '0.68rem', marginTop: '0.25rem' }}>
                🌧️ {day.rain_probability_pct}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgriAdvisory({ current, forecast }) {
  if (!current) return null;
  const advisories = [];

  if (current.temp_celsius > 38)
    advisories.push({ icon: '🌡️', title: 'Heat Stress Alert', text: `Temperature above 38°C. Irrigate in early morning/evening. Consider mulching to retain soil moisture. Avoid spraying during peak heat (11am–3pm).` });

  if (current.humidity_pct > 80)
    advisories.push({ icon: '💧', title: 'High Humidity', text: 'Risk of fungal diseases. Monitor crops for early blight, late blight, and powdery mildew. Ensure good air circulation between rows.' });

  if (forecast?.some(d => d.rain_probability_pct > 70))
    advisories.push({ icon: '🌧️', title: 'Rain Expected', text: 'High rainfall probability in next few days. Avoid spraying pesticides or fertilizers. Ensure drainage channels are clear. Postpone harvesting if possible.' });

  if (current.wind_speed_kmh > 30)
    advisories.push({ icon: '🌬️', title: 'High Wind Alert', text: `Wind speed ${current.wind_speed_kmh} km/h. Do not spray. Stake tall crops. Check for lodging in rice and maize. Secure nets and shade covers.` });

  if (advisories.length === 0)
    advisories.push({ icon: '✅', title: 'Favorable Conditions', text: 'Good conditions for field operations today. Suitable for spraying, transplanting, and morning field inspections.' });

  return (
    <div className="card" style={{ background: 'var(--color-green-50)', border: '1px solid var(--color-green-200)' }}>
      <h3 style={{ color: 'var(--color-green-700)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Leaf size={16} /> Agricultural Weather Advisory
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {advisories.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>{a.icon}</span>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>
              <strong>{a.title}:</strong> {a.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function WeatherPage() {
  const { t } = useTranslation();

  // 1. Fetch farmer profile for location
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['farmerProfile'],
    queryFn: () => farmerApi.getProfile().then(r => r.data.data),
    retry: false,
  });

  // 2. Determine query strategy
  const hasCoords = profile?.location_lat && profile?.location_lng;
  const hasDistrict = profile?.district;
  const hasLocation = hasCoords || hasDistrict;
  const profileReady = !profileLoading;

  // 3a. Coord-based query (highest priority)
  const coordQuery = useQuery({
    queryKey: ['weather-coords', profile?.location_lat, profile?.location_lng],
    queryFn: () => weatherApi.getWeatherByCoords(profile.location_lat, profile.location_lng).then(r => r.data),
    enabled: profileReady && !!hasCoords,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  // 3b. District-based query (fallback)
  const districtQuery = useQuery({
    queryKey: ['weather-district', profile?.district, profile?.state],
    queryFn: () => weatherApi.getByDistrict(profile.district, profile.state || 'India').then(r => r.data),
    enabled: profileReady && !hasCoords && !!hasDistrict,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  // 4. Resolve active query
  const activeQuery = hasCoords ? coordQuery : districtQuery;
  const { data: weatherResp, isLoading: weatherLoading, refetch } = activeQuery;

  // ── Render states ──────────────────────────────────────────────
  if (profileLoading || (hasLocation && weatherLoading)) {
    return <SkeletonLoader />;
  }

  // No location in profile
  if (profileReady && !hasLocation) {
    return (
      <div>
        <div className="page-header">
          <h1>⛅ {t('weather.title', 'Weather')}</h1>
        </div>
        <MissingLocationBanner />
      </div>
    );
  }

  // Explicit backend statuses
  if (weatherResp?.status === 'missing_context') {
    return (
      <div>
        <div className="page-header"><h1>⛅ {t('weather.title', 'Weather')}</h1></div>
        <MissingLocationBanner />
      </div>
    );
  }

  if (weatherResp?.status === 'data_unavailable' || activeQuery.isError) {
    return (
      <div>
        <div className="page-header"><h1>⛅ {t('weather.title', 'Weather')}</h1></div>
        <DataUnavailableBanner
          message={weatherResp?.message}
          onRetry={refetch}
        />
      </div>
    );
  }

  const weather = weatherResp?.data;
  const cur = weather?.current;
  const forecast = weather?.forecast || [];
  const locationLabel = weather?.location || profile?.district || 'Your Location';

  return (
    <div>
      <div className="page-header">
        <h1>⛅ {t('weather.title', 'Weather')}</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{locationLabel}</p>
      </div>

      {/* Current */}
      {cur && (
        <CurrentWeatherCard
          current={cur}
          location={locationLabel}
          lastUpdated={weather?.last_updated}
          source={weather?.source}
        />
      )}

      {/* Forecast */}
      <ForecastCard forecast={forecast} />

      {/* Agricultural advisory */}
      <AgriAdvisory current={cur} forecast={forecast} />
    </div>
  );
}

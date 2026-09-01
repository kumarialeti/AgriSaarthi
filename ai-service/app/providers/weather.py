"""
AgriSaarthi AI Service — Weather Provider
Uses Open-Meteo (https://open-meteo.com/) — free, no API key required.

Design:
- Accepts latitude/longitude; returns data_unavailable if missing.
- Validates all required response fields.
- Enforces configurable timeout and limited retry with exponential backoff.
- Never falls back to RAG or LLM for weather data.
- Logs errors without exposing sensitive information.
"""
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import settings

logger = logging.getLogger(__name__)

# ─── Result Types ─────────────────────────────────────────────────

@dataclass
class WeatherResult:
    """Structured output from the WeatherProvider."""
    status: str  # "success" | "data_unavailable" | "missing_context"
    current_temperature_c: Optional[float] = None
    current_weather_code: Optional[int] = None
    current_wind_speed_kmh: Optional[float] = None
    precipitation_probability_max: Optional[float] = None   # next 24h
    hourly_rain_mm: Optional[List[float]] = None            # next 24h
    forecast_days: Optional[int] = None
    provider: str = "open-meteo"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    error: Optional[str] = None

    def to_evidence_string(self) -> str:
        """Returns a farmer-friendly evidence summary string."""
        if self.status != "success":
            return ""
        rain_info = ""
        if self.precipitation_probability_max is not None:
            rain_info = f", Rain probability (next 24h): {self.precipitation_probability_max:.0f}%"
        return (
            f"Current temperature: {self.current_temperature_c}°C"
            f", Wind speed: {self.current_wind_speed_kmh} km/h"
            f"{rain_info}."
        )


# ─── Required API Response Fields ──────────────────────────────────

_REQUIRED_CURRENT = {"temperature_2m", "wind_speed_10m", "weather_code"}
_REQUIRED_TOP = {"current", "latitude", "longitude"}

def _validate_response(data: Dict[str, Any]) -> bool:
    """Validates that the Open-Meteo response contains all required fields."""
    if not isinstance(data, dict):
        return False
    if not _REQUIRED_TOP.issubset(data.keys()):
        logger.warning("Weather API response missing top-level fields: %s", _REQUIRED_TOP - data.keys())
        return False
    current = data.get("current", {})
    if not isinstance(current, dict):
        return False
    missing = _REQUIRED_CURRENT - current.keys()
    if missing:
        logger.warning("Weather API response missing current fields: %s", missing)
        return False
    return True


# ─── Provider Class ────────────────────────────────────────────────

class WeatherProvider:
    """
    Fetches live weather from Open-Meteo.
    All failures produce WeatherResult(status='data_unavailable').
    Missing coordinates produce WeatherResult(status='missing_context').
    """

    BASE_URL = settings.weather_api_base_url
    TIMEOUT = settings.weather_api_timeout
    MAX_ATTEMPTS = settings.weather_api_retries + 1  # initial try + retries

    def get_weather(
        self,
        latitude: Optional[float],
        longitude: Optional[float],
    ) -> WeatherResult:
        """
        Fetches current weather and 24h forecast for the given coordinates.

        Args:
            latitude: WGS84 latitude (e.g. 17.3850 for Hyderabad)
            longitude: WGS84 longitude (e.g. 78.4867 for Hyderabad)

        Returns:
            WeatherResult with status 'success', 'data_unavailable', or 'missing_context'
        """
        # Guard: coordinates required
        if latitude is None or longitude is None:
            logger.info("Weather request missing coordinates — returning missing_context.")
            return WeatherResult(
                status="missing_context",
                error="Latitude and longitude are required for weather data.",
            )

        try:
            return self._fetch_with_retry(latitude, longitude)
        except Exception as e:
            logger.error("Weather provider unexpected error (no sensitive info): %s", type(e).__name__)
            return WeatherResult(
                status="data_unavailable",
                error="Weather service temporarily unavailable.",
            )

    def _fetch_with_retry(self, latitude: float, longitude: float) -> WeatherResult:
        """Internal: performs the HTTP request with tenacity retry."""
        attempt = [0]  # mutable counter for logging

        @retry(
            stop=stop_after_attempt(self.MAX_ATTEMPTS),
            wait=wait_exponential(multiplier=1, min=1, max=8),
            retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
            reraise=True,
        )
        def _do_request() -> WeatherResult:
            attempt[0] += 1
            if attempt[0] > 1:
                logger.info("Weather API retry attempt %d/%d", attempt[0], self.MAX_ATTEMPTS)

            params = {
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,wind_speed_10m,weather_code",
                "hourly": "precipitation,precipitation_probability",
                "forecast_days": 1,
                "timezone": "auto",
            }

            with httpx.Client(timeout=self.TIMEOUT) as client:
                response = client.get(self.BASE_URL + "/forecast", params=params)

            if response.status_code != 200:
                logger.warning("Weather API returned HTTP %d.", response.status_code)
                return WeatherResult(
                    status="data_unavailable",
                    error=f"Weather API returned HTTP {response.status_code}.",
                )

            data = response.json()

            if not _validate_response(data):
                return WeatherResult(
                    status="data_unavailable",
                    error="Weather API returned incomplete or unexpected data.",
                )

            current = data["current"]
            hourly = data.get("hourly", {})
            precip_prob = hourly.get("precipitation_probability", [])
            hourly_rain = hourly.get("precipitation", [])

            # Max precipitation probability for next 24h
            max_precip_prob = max(precip_prob) if precip_prob else None

            return WeatherResult(
                status="success",
                latitude=data["latitude"],
                longitude=data["longitude"],
                current_temperature_c=current.get("temperature_2m"),
                current_weather_code=current.get("weather_code"),
                current_wind_speed_kmh=current.get("wind_speed_10m"),
                precipitation_probability_max=max_precip_prob,
                hourly_rain_mm=hourly_rain[:24] if hourly_rain else [],
                forecast_days=1,
                provider="open-meteo",
            )

        try:
            return _do_request()
        except (httpx.TimeoutException, httpx.NetworkError) as e:
            logger.warning("Weather API unreachable after retries: %s", type(e).__name__)
            return WeatherResult(
                status="data_unavailable",
                error="Weather service timed out or is unreachable.",
            )


# Module-level singleton
weather_provider = WeatherProvider()

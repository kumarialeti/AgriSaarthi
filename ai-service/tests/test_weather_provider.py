"""
Tests for WeatherProvider (Open-Meteo integration).
All HTTP calls are mocked with respx — no real network requests.
"""
import pytest
import httpx
import respx
from unittest.mock import patch

from app.providers.weather import WeatherProvider, WeatherResult, _validate_response


# ─── Fixtures ─────────────────────────────────────────────────────

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

VALID_RESPONSE = {
    "latitude": 17.385,
    "longitude": 78.4867,
    "current": {
        "temperature_2m": 32.5,
        "wind_speed_10m": 14.2,
        "weather_code": 2,
    },
    "hourly": {
        "precipitation": [0.0, 0.1, 0.0, 0.5] * 6,
        "precipitation_probability": [10, 20, 15, 60] * 6,
    },
}

MISSING_FIELDS_RESPONSE = {
    "latitude": 17.385,
    "longitude": 78.4867,
    # Missing 'current' entirely
}

INCOMPLETE_CURRENT_RESPONSE = {
    "latitude": 17.385,
    "longitude": 78.4867,
    "current": {
        "temperature_2m": 32.5,
        # Missing wind_speed_10m and weather_code
    },
}


# ─── Schema Validation Unit Tests ─────────────────────────────────

def test_schema_validation_passes_complete_response():
    """Valid response with all required fields should pass validation."""
    assert _validate_response(VALID_RESPONSE) is True


def test_schema_validation_fails_missing_current():
    """Response without 'current' key should fail validation."""
    assert _validate_response(MISSING_FIELDS_RESPONSE) is False


def test_schema_validation_fails_incomplete_current():
    """Response with incomplete 'current' object should fail validation."""
    assert _validate_response(INCOMPLETE_CURRENT_RESPONSE) is False


def test_schema_validation_fails_non_dict():
    """Non-dict input should fail validation."""
    assert _validate_response("not a dict") is False
    assert _validate_response(None) is False
    assert _validate_response([]) is False


# ─── Test 1: Successful API Response ──────────────────────────────

@respx.mock
def test_weather_success():
    """Provider returns WeatherResult(status='success') for a valid API response."""
    respx.get(OPEN_METEO_URL).mock(return_value=httpx.Response(200, json=VALID_RESPONSE))
    
    provider = WeatherProvider()
    result = provider.get_weather(latitude=17.385, longitude=78.4867)
    
    assert result.status == "success"
    assert result.current_temperature_c == 32.5
    assert result.current_wind_speed_kmh == 14.2
    assert result.precipitation_probability_max == 60.0
    assert result.latitude == 17.385
    assert result.longitude == 78.4867
    assert result.provider == "open-meteo"
    assert result.error is None


# ─── Test 2: API Timeout ──────────────────────────────────────────

@respx.mock
def test_weather_timeout():
    """Provider returns data_unavailable on timeout; retries are exhausted."""
    respx.get(OPEN_METEO_URL).mock(side_effect=httpx.TimeoutException("timed out"))

    # Override retry settings to speed up tests
    provider = WeatherProvider()
    provider.MAX_ATTEMPTS = 1  # No retries
    result = provider.get_weather(latitude=17.385, longitude=78.4867)
    
    assert result.status == "data_unavailable"
    assert result.error is not None


# ─── Test 3: API 500 / 503 Error ──────────────────────────────────

@respx.mock
def test_weather_server_error_500():
    """Provider returns data_unavailable on HTTP 500."""
    respx.get(OPEN_METEO_URL).mock(return_value=httpx.Response(500))

    provider = WeatherProvider()
    result = provider.get_weather(latitude=17.385, longitude=78.4867)
    
    assert result.status == "data_unavailable"
    assert "500" in result.error


@respx.mock
def test_weather_server_error_503():
    """Provider returns data_unavailable on HTTP 503."""
    respx.get(OPEN_METEO_URL).mock(return_value=httpx.Response(503))

    provider = WeatherProvider()
    result = provider.get_weather(latitude=17.385, longitude=78.4867)
    
    assert result.status == "data_unavailable"
    assert "503" in result.error


# ─── Test 4: Invalid / Incomplete API Response ────────────────────

@respx.mock
def test_weather_invalid_response_missing_current():
    """Provider returns data_unavailable if 'current' is missing from response."""
    respx.get(OPEN_METEO_URL).mock(
        return_value=httpx.Response(200, json=MISSING_FIELDS_RESPONSE)
    )

    provider = WeatherProvider()
    result = provider.get_weather(latitude=17.385, longitude=78.4867)
    
    assert result.status == "data_unavailable"
    assert "incomplete" in result.error.lower() or "unexpected" in result.error.lower()


@respx.mock
def test_weather_invalid_response_incomplete_current():
    """Provider returns data_unavailable if current fields are incomplete."""
    respx.get(OPEN_METEO_URL).mock(
        return_value=httpx.Response(200, json=INCOMPLETE_CURRENT_RESPONSE)
    )

    provider = WeatherProvider()
    result = provider.get_weather(latitude=17.385, longitude=78.4867)
    
    assert result.status == "data_unavailable"


# ─── Test 5: Missing Coordinates ──────────────────────────────────

def test_weather_missing_both_coordinates():
    """Provider returns missing_context when both lat and lon are None."""
    provider = WeatherProvider()
    result = provider.get_weather(latitude=None, longitude=None)
    
    assert result.status == "missing_context"
    assert result.error is not None
    assert result.current_temperature_c is None


def test_weather_missing_lat_only():
    """Provider returns missing_context when latitude is None."""
    provider = WeatherProvider()
    result = provider.get_weather(latitude=None, longitude=78.4867)
    
    assert result.status == "missing_context"


def test_weather_missing_lon_only():
    """Provider returns missing_context when longitude is None."""
    provider = WeatherProvider()
    result = provider.get_weather(latitude=17.385, longitude=None)
    
    assert result.status == "missing_context"


# ─── Test 6: Retry Behavior ───────────────────────────────────────

@respx.mock
def test_weather_retry_succeeds_on_second_attempt():
    """Provider retries on network error and succeeds on second attempt."""
    call_count = [0]

    def side_effect(request):
        call_count[0] += 1
        if call_count[0] == 1:
            raise httpx.NetworkError("transient failure")
        return httpx.Response(200, json=VALID_RESPONSE)

    respx.get(OPEN_METEO_URL).mock(side_effect=side_effect)

    provider = WeatherProvider()
    provider.MAX_ATTEMPTS = 2
    result = provider.get_weather(latitude=17.385, longitude=78.4867)

    assert call_count[0] == 2
    assert result.status == "success"


# ─── Test 7: Verify No RAG Fallback ──────────────────────────────

@respx.mock
def test_weather_no_rag_fallback_on_failure():
    """
    Critical safety test: on API failure, provider returns data_unavailable.
    DocumentRetriever must NOT be called for weather data.
    """
    respx.get(OPEN_METEO_URL).mock(return_value=httpx.Response(503))

    with patch("app.rag.retriever.DocumentRetriever.search") as mock_rag:
        provider = WeatherProvider()
        result = provider.get_weather(latitude=17.385, longitude=78.4867)

        # RAG must not be called for live weather
        mock_rag.assert_not_called()
        assert result.status == "data_unavailable"


# ─── Evidence String Tests ────────────────────────────────────────

def test_evidence_string_success():
    """Successful WeatherResult produces a non-empty evidence string."""
    result = WeatherResult(
        status="success",
        current_temperature_c=32.5,
        current_wind_speed_kmh=14.2,
        precipitation_probability_max=60.0,
        provider="open-meteo",
    )
    evidence = result.to_evidence_string()
    assert "32.5" in evidence
    assert "14.2" in evidence
    assert "60" in evidence


def test_evidence_string_empty_on_failure():
    """Failed WeatherResult produces an empty evidence string."""
    result = WeatherResult(status="data_unavailable", error="API error")
    assert result.to_evidence_string() == ""

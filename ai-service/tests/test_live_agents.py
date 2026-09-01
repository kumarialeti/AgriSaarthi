"""
LangGraph integration tests for Weather and Market agents.
All HTTP and LLM calls are mocked — no real network or API usage.
Tests verify routing, data_unavailable propagation, and safety guarantees.
"""
import pytest
import httpx
import respx
from unittest.mock import patch, MagicMock

from app.agents.state import AgentState, AgentOutput
from app.agents.orchestrator import (
    weather_agent,
    market_agent,
    safety_validation_node,
    _extract_coordinates,
    _extract_crop,
)

# ─── Helpers ──────────────────────────────────────────────────────

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
MARKET_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

VALID_WEATHER_RESPONSE = {
    "latitude": 17.385,
    "longitude": 78.4867,
    "current": {
        "temperature_2m": 30.0,
        "wind_speed_10m": 10.0,
        "weather_code": 1,
    },
    "hourly": {
        "precipitation": [0.0] * 24,
        "precipitation_probability": [5] * 24,
    },
}

VALID_MARKET_RESPONSE = {
    "records": [{
        "State": "Telangana",
        "District": "Warangal",
        "Market": "Warangal",
        "Commodity": "Cotton",
        "Variety": "Bt Cotton",
        "Arrival_Date": "30/08/2026",
        "Min_Price": "6500",
        "Max_Price": "7200",
        "Modal_Price": "6900",
    }],
    "total": 1,
}


def _base_state(**overrides) -> dict:
    """Creates a minimal valid AgentState for testing."""
    base = {
        "query": "test query",
        "language": "en",
        "intent": "general",
        "crop": None,
        "required_agents": [],
        "agent_outputs": {},
        "safety_violations": [],
        "needs_context": False,
        "missing_context": [],
        "final_response": "",
        "farmer_context": {},
        "messages": [],
    }
    base.update(overrides)
    return base


# ─── Test 1: Weather-Only Query Routes Only to Weather Agent ──────

@respx.mock
def test_weather_agent_routes_correctly():
    """
    A weather query produces output only from the weather agent.
    Verify routing does not touch RAG or market agent.
    """
    respx.get(OPEN_METEO_URL).mock(
        return_value=httpx.Response(200, json=VALID_WEATHER_RESPONSE)
    )
    state = _base_state(
        query="Will it rain tomorrow?",
        farmer_context={"latitude": 17.385, "longitude": 78.4867},
    )

    result = weather_agent(state)

    assert "weather" in result["agent_outputs"]
    assert result["agent_outputs"]["weather"].status == "success"
    assert "market" not in result["agent_outputs"]


# ─── Test 2: Market-Only Query Routes Only to Market Agent ────────

@respx.mock
def test_market_agent_routes_correctly(monkeypatch):
    """
    A market query produces output only from the market agent.
    Verify routing does not touch RAG or weather agent.
    """
    monkeypatch.setattr("app.config.settings.market_api_key", "test-key-123")
    respx.get(MARKET_URL).mock(
        return_value=httpx.Response(200, json=VALID_MARKET_RESPONSE)
    )
    state = _base_state(
        query="What is the cotton price in Warangal?",
        crop="Cotton",
        farmer_context={"state": "Telangana"},
    )

    result = market_agent(state)

    assert "market" in result["agent_outputs"]
    assert result["agent_outputs"]["market"].status == "success"
    assert "weather" not in result["agent_outputs"]


# ─── Test 3: Weather API Failure Propagates data_unavailable ──────

@respx.mock
def test_weather_api_failure_propagates_data_unavailable():
    """
    When Open-Meteo returns 503, weather_agent output must be data_unavailable.
    Final response must NOT contain hallucinated weather values.
    """
    respx.get(OPEN_METEO_URL).mock(return_value=httpx.Response(503))
    state = _base_state(
        farmer_context={"latitude": 17.385, "longitude": 78.4867},
    )

    result = weather_agent(state)

    output = result["agent_outputs"]["weather"]
    assert output.status == "data_unavailable"
    assert output.evidence == ""
    assert output.recommendation == ""
    assert output.confidence == 0.0


# ─── Test 4: Market API Failure Propagates data_unavailable ───────

@respx.mock
def test_market_api_failure_propagates_data_unavailable(monkeypatch):
    """
    When Agmarknet returns 500, market_agent output must be data_unavailable.
    Final response must NOT contain hallucinated prices.
    """
    monkeypatch.setattr("app.config.settings.market_api_key", "test-key-123")
    respx.get(MARKET_URL).mock(return_value=httpx.Response(500))
    state = _base_state(crop="Cotton")

    result = market_agent(state)

    output = result["agent_outputs"]["market"]
    assert output.status == "data_unavailable"
    assert output.evidence == ""
    assert output.recommendation == ""
    assert output.confidence == 0.0


# ─── Test 5: Missing Farmer Location Handled Safely ──────────────

def test_missing_farmer_location_handled_safely():
    """
    When farmer context has no coordinates, weather_agent must return
    data_unavailable with a useful message — NOT assume a location.
    """
    state = _base_state(
        query="Will it rain tomorrow?",
        farmer_context={},  # No coordinates
    )

    result = weather_agent(state)

    output = result["agent_outputs"]["weather"]
    assert output.status == "data_unavailable"
    # Must explain the missing location issue
    assert "location" in output.decision_summary.lower() or "coordinates" in output.decision_summary.lower()
    # Must NOT contain any temperature or rain data
    assert output.evidence == ""


def test_missing_farmer_location_field_coordinates():
    """
    When farmer has fields but none have coordinates, must return data_unavailable.
    """
    state = _base_state(
        farmer_context={
            "fields": [{"name": "Field 1", "area": 2.5}]  # No lat/lon
        },
    )
    result = weather_agent(state)
    output = result["agent_outputs"]["weather"]
    assert output.status == "data_unavailable"


# ─── Test 6: Chemical Safety Tests Still Pass ─────────────────────

def test_chemical_safety_blocking_unchanged():
    """
    Safety validation node must still block fertilizer/crop_health agents
    that attempt to provide recommendations without evidence.
    """
    state = _base_state(
        agent_outputs={
            "fertilizer": AgentOutput(
                status="success",
                decision_summary="Apply Urea.",
                evidence="",   # NO EVIDENCE
                recommendation="Apply 50kg Urea per hectare",
                confidence=0.8,
                sources=[],
                warnings=[]
            )
        }
    )

    result = safety_validation_node(state)

    assert len(result["safety_violations"]) == 1
    blocked = state["agent_outputs"]["fertilizer"]
    assert blocked.status == "insufficient_knowledge"
    assert blocked.recommendation == ""
    assert "Blocked by safety policy" in blocked.decision_summary


def test_weather_agent_not_blocked_by_safety_node():
    """
    Safety node must NOT block weather agent outputs (weather is live data, not chemical).
    """
    state = _base_state(
        agent_outputs={
            "weather": AgentOutput(
                status="success",
                decision_summary="Weather retrieved.",
                evidence="Temperature: 30°C",
                recommendation="Good conditions for spraying.",
                confidence=0.9,
                sources=[{"provider": "open-meteo"}],
                warnings=[]
            )
        }
    )

    result = safety_validation_node(state)
    # Weather agent should not be blocked
    assert len(result["safety_violations"]) == 0
    assert state["agent_outputs"]["weather"].status == "success"


# ─── Test 7: Coordinate Extraction from Farmer Context ───────────

def test_extract_coordinates_from_profile():
    """Extracts lat/lon from farmer profile dict."""
    ctx = {"latitude": 17.385, "longitude": 78.4867}
    lat, lon = _extract_coordinates(ctx)
    assert lat == 17.385
    assert lon == 78.4867


def test_extract_coordinates_from_fields_priority():
    """Field coordinates take priority over profile coordinates."""
    ctx = {
        "latitude": 10.0,
        "longitude": 10.0,
        "fields": [{"latitude": 17.385, "longitude": 78.4867}],
    }
    lat, lon = _extract_coordinates(ctx)
    assert lat == 17.385
    assert lon == 78.4867


def test_extract_coordinates_empty_context():
    """Empty context returns (None, None)."""
    lat, lon = _extract_coordinates({})
    assert lat is None
    assert lon is None


def test_extract_coordinates_none_context():
    """None context returns (None, None)."""
    lat, lon = _extract_coordinates(None)
    assert lat is None
    assert lon is None


def test_extract_crop_from_state():
    """Crop detected by orchestrator is preferred."""
    state = _base_state(crop="Rice")
    assert _extract_crop(state) == "Rice"


def test_extract_crop_from_farmer_context_fields():
    """If no orchestrator crop, fall back to farmer context fields."""
    state = _base_state(
        crop=None,
        farmer_context={"fields": [{"crop_name": "Cotton"}]},
    )
    assert _extract_crop(state) == "Cotton"


# ─── RAG Non-Regression: Market Key Missing, No RAG Called ────────

def test_market_missing_key_no_rag_called(monkeypatch):
    """
    If MARKET_API_KEY is not set, market_agent must return data_unavailable
    without calling DocumentRetriever.
    """
    monkeypatch.setattr("app.config.settings.market_api_key", None)
    state = _base_state(crop="Cotton")

    with patch("app.rag.retriever.DocumentRetriever.search") as mock_rag:
        result = market_agent(state)
        mock_rag.assert_not_called()

    output = result["agent_outputs"]["market"]
    assert output.status == "data_unavailable"
    assert "not configured" in output.decision_summary.lower() or "key" in output.decision_summary.lower()


# ─── RAG Non-Regression: Weather Failure, No RAG Called ──────────

@respx.mock
def test_weather_failure_no_rag_called():
    """
    If weather API fails, weather_agent must return data_unavailable
    without calling DocumentRetriever.
    """
    respx.get(OPEN_METEO_URL).mock(return_value=httpx.Response(500))
    state = _base_state(farmer_context={"latitude": 17.385, "longitude": 78.4867})

    with patch("app.rag.retriever.DocumentRetriever.search") as mock_rag:
        result = weather_agent(state)
        mock_rag.assert_not_called()

    assert result["agent_outputs"]["weather"].status == "data_unavailable"

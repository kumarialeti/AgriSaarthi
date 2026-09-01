"""
Tests for MarketProvider (data.gov.in Agmarknet integration).
All HTTP calls are mocked with respx — no real network requests.
"""
import pytest
import httpx
import respx
from unittest.mock import patch

from app.providers.market import MarketProvider, MarketResult, _validate_record, _parse_price


# ─── Fixtures ─────────────────────────────────────────────────────

MARKET_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

VALID_RECORD = {
    "State": "Telangana",
    "District": "Warangal",
    "Market": "Warangal",
    "Commodity": "Cotton",
    "Variety": "Bt Cotton",
    "Arrival_Date": "30/08/2026",
    "Min_Price": "6500",
    "Max_Price": "7200",
    "Modal_Price": "6900",
}

VALID_RESPONSE = {
    "records": [VALID_RECORD],
    "total": 1,
    "count": 1,
    "limit": 10,
    "offset": 0,
}

INCOMPLETE_RECORD = {
    "State": "Telangana",
    "District": "Warangal",
    # Missing Market, Commodity, Variety, Arrival_Date, Min_Price, Max_Price, Modal_Price
}

EMPTY_RECORDS_RESPONSE = {
    "records": [],
    "total": 0,
    "count": 0,
}


# ─── Helper Unit Tests ─────────────────────────────────────────────

def test_validate_record_passes_complete():
    """Complete record should pass validation."""
    assert _validate_record(VALID_RECORD) is True


def test_validate_record_fails_incomplete():
    """Incomplete record should fail validation."""
    assert _validate_record(INCOMPLETE_RECORD) is False


def test_parse_price_valid():
    """Valid numeric strings should parse correctly."""
    assert _parse_price("6900") == 6900.0
    assert _parse_price("6900.50") == 6900.50
    assert _parse_price(7000) == 7000.0


def test_parse_price_invalid():
    """Invalid values should return None without raising."""
    assert _parse_price(None) is None
    assert _parse_price("N/A") is None
    assert _parse_price("") is None


# ─── Test 1: Successful API Response ──────────────────────────────

@respx.mock
def test_market_success(monkeypatch):
    """Provider returns MarketResult(status='success') for valid API response."""
    monkeypatch.setattr("app.config.settings.market_api_key", "test-key-123")
    respx.get(MARKET_URL).mock(return_value=httpx.Response(200, json=VALID_RESPONSE))

    provider = MarketProvider()
    result = provider.get_prices(commodity="Cotton", state="Telangana")

    assert result.status == "success"
    assert len(result.records) == 1
    record = result.records[0]
    assert record.commodity == "Cotton"
    assert record.modal_price == 6900.0
    assert record.state == "Telangana"
    assert result.error is None


# ─── Test 2: API Timeout ──────────────────────────────────────────

@respx.mock
def test_market_timeout(monkeypatch):
    """Provider returns data_unavailable on timeout."""
    monkeypatch.setattr("app.config.settings.market_api_key", "test-key-123")
    respx.get(MARKET_URL).mock(side_effect=httpx.TimeoutException("timed out"))

    provider = MarketProvider()
    provider.MAX_ATTEMPTS = 1
    result = provider.get_prices(commodity="Cotton")

    assert result.status == "data_unavailable"
    assert result.error is not None


# ─── Test 3: API Failure (500, 503) ───────────────────────────────

@respx.mock
def test_market_server_error_500(monkeypatch):
    """Provider returns data_unavailable on HTTP 500."""
    monkeypatch.setattr("app.config.settings.market_api_key", "test-key-123")
    respx.get(MARKET_URL).mock(return_value=httpx.Response(500))

    provider = MarketProvider()
    result = provider.get_prices(commodity="Cotton")

    assert result.status == "data_unavailable"
    assert "500" in result.error


@respx.mock
def test_market_auth_failure_401(monkeypatch):
    """Provider returns data_unavailable on HTTP 401 (bad key)."""
    monkeypatch.setattr("app.config.settings.market_api_key", "bad-key")
    respx.get(MARKET_URL).mock(return_value=httpx.Response(401))

    provider = MarketProvider()
    result = provider.get_prices(commodity="Cotton")

    assert result.status == "data_unavailable"
    assert "authentication" in result.error.lower()


# ─── Test 4: Missing API Key ──────────────────────────────────────

def test_market_missing_api_key(monkeypatch):
    """Provider returns data_unavailable immediately when MARKET_API_KEY is not set."""
    monkeypatch.setattr("app.config.settings.market_api_key", None)

    provider = MarketProvider()
    result = provider.get_prices(commodity="Cotton")

    assert result.status == "data_unavailable"
    assert "not configured" in result.error.lower()


def test_market_empty_api_key(monkeypatch):
    """Provider returns data_unavailable when MARKET_API_KEY is empty string."""
    monkeypatch.setattr("app.config.settings.market_api_key", "")

    provider = MarketProvider()
    result = provider.get_prices(commodity="Cotton")

    assert result.status == "data_unavailable"


# ─── Test 5: Invalid / Incomplete Market Response ─────────────────

@respx.mock
def test_market_response_missing_records_key(monkeypatch):
    """Provider returns data_unavailable when 'records' key is missing."""
    monkeypatch.setattr("app.config.settings.market_api_key", "test-key-123")
    respx.get(MARKET_URL).mock(return_value=httpx.Response(200, json={"total": 0}))

    provider = MarketProvider()
    result = provider.get_prices(commodity="Cotton")

    assert result.status == "data_unavailable"
    assert "unexpected" in result.error.lower()


@respx.mock
def test_market_response_empty_records(monkeypatch):
    """Provider returns data_unavailable when records list is empty."""
    monkeypatch.setattr("app.config.settings.market_api_key", "test-key-123")
    respx.get(MARKET_URL).mock(return_value=httpx.Response(200, json=EMPTY_RECORDS_RESPONSE))

    provider = MarketProvider()
    result = provider.get_prices(commodity="Cotton")

    assert result.status == "data_unavailable"
    assert "no valid records" in result.error.lower()


@respx.mock
def test_market_response_all_incomplete_records(monkeypatch):
    """Provider returns data_unavailable when all records fail validation."""
    monkeypatch.setattr("app.config.settings.market_api_key", "test-key-123")
    bad_response = {"records": [INCOMPLETE_RECORD, INCOMPLETE_RECORD]}
    respx.get(MARKET_URL).mock(return_value=httpx.Response(200, json=bad_response))

    provider = MarketProvider()
    result = provider.get_prices(commodity="Cotton")

    assert result.status == "data_unavailable"


# ─── Test 6: Verify No RAG Fallback ──────────────────────────────

@respx.mock
def test_market_no_rag_fallback_on_failure(monkeypatch):
    """
    Critical safety test: on API failure, provider returns data_unavailable.
    DocumentRetriever must NOT be called for market prices.
    """
    monkeypatch.setattr("app.config.settings.market_api_key", "test-key-123")
    respx.get(MARKET_URL).mock(return_value=httpx.Response(500))

    with patch("app.rag.retriever.DocumentRetriever.search") as mock_rag:
        provider = MarketProvider()
        result = provider.get_prices(commodity="Cotton")

        mock_rag.assert_not_called()
        assert result.status == "data_unavailable"


# ─── Test 7: Verify No Fabricated Prices ─────────────────────────

@respx.mock
def test_market_no_fabricated_prices(monkeypatch):
    """
    Critical safety test: evidence must only contain prices from API response.
    Price values must come from validated records, not from LLM inference.
    """
    monkeypatch.setattr("app.config.settings.market_api_key", "test-key-123")
    respx.get(MARKET_URL).mock(return_value=httpx.Response(200, json=VALID_RESPONSE))

    provider = MarketProvider()
    result = provider.get_prices(commodity="Cotton")

    assert result.status == "success"
    # Verify price is exactly from API, not inferred
    assert result.records[0].modal_price == 6900.0
    assert result.records[0].min_price == 6500.0
    assert result.records[0].max_price == 7200.0

    evidence = result.to_evidence_string()
    assert "6900" in evidence
    # Evidence must NOT contain any prices not in the response
    assert "7000" not in evidence
    assert "8000" not in evidence


# ─── Evidence String Tests ────────────────────────────────────────

def test_evidence_string_success():
    """Successful MarketResult produces a non-empty evidence string."""
    from app.providers.market import MarketRecord
    record = MarketRecord(
        state="Telangana", district="Warangal", market="Warangal",
        commodity="Cotton", variety="Bt Cotton", arrival_date="30/08/2026",
        min_price=6500.0, max_price=7200.0, modal_price=6900.0,
    )
    result = MarketResult(status="success", records=[record])
    evidence = result.to_evidence_string()
    assert "Cotton" in evidence
    assert "6900" in evidence
    assert "Warangal" in evidence


def test_evidence_string_empty_on_failure():
    """Failed MarketResult produces an empty evidence string."""
    result = MarketResult(status="data_unavailable", error="key missing")
    assert result.to_evidence_string() == ""

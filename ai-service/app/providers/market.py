"""
AgriSaarthi AI Service — Market Provider
Uses data.gov.in Agmarknet API (Government of India).
API endpoint: /resource/9ef84268-d588-465a-a308-a864a43d0070

Design:
- Requires MARKET_API_KEY environment variable (data.gov.in registration).
- Returns data_unavailable if key is missing or the API fails.
- Validates returned price/market/date fields before use.
- Never fabricates prices, never uses RAG as fallback.
- Enforces configurable timeout and limited retry with exponential backoff.
- Logs errors without exposing credentials or sensitive data.
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
class MarketRecord:
    """A single commodity price record from the market API."""
    state: str
    district: str
    market: str
    commodity: str
    variety: str
    arrival_date: str
    min_price: Optional[float]
    max_price: Optional[float]
    modal_price: Optional[float]

@dataclass
class MarketResult:
    """Structured output from the MarketProvider."""
    status: str  # "success" | "data_unavailable" | "missing_context"
    records: List[MarketRecord] = field(default_factory=list)
    provider: str = "agmarknet-data.gov.in"
    error: Optional[str] = None

    def to_evidence_string(self) -> str:
        """Returns a farmer-friendly evidence summary string."""
        if self.status != "success" or not self.records:
            return ""
        lines = []
        for r in self.records[:5]:  # top 5 records
            price_info = f"Modal: ₹{r.modal_price}/qtl" if r.modal_price else "Price not available"
            lines.append(
                f"{r.commodity} at {r.market}, {r.district} ({r.arrival_date}): {price_info}"
            )
        return "\n".join(lines)


# ─── Required Response Fields ──────────────────────────────────────

_REQUIRED_RECORD_FIELDS = {
    "State", "District", "Market", "Commodity",
    "Variety", "Arrival_Date", "Min_Price", "Max_Price", "Modal_Price"
}

def _validate_record(record: Dict[str, Any]) -> bool:
    """Validates that a single market record has all required fields."""
    return _REQUIRED_RECORD_FIELDS.issubset(record.keys())

def _parse_price(value: Any) -> Optional[float]:
    """Safely parses a price value to float."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ─── Provider Class ────────────────────────────────────────────────

class MarketProvider:
    """
    Fetches live commodity prices from data.gov.in Agmarknet API.

    Returns data_unavailable if:
    - MARKET_API_KEY is not configured
    - The API times out or returns a non-200 response
    - The response fails validation

    Never falls back to RAG or LLM-generated prices.
    """

    BASE_URL = settings.market_api_base_url
    TIMEOUT = settings.market_api_timeout
    MAX_ATTEMPTS = settings.market_api_retries + 1

    def get_prices(
        self,
        commodity: Optional[str] = None,
        state: Optional[str] = None,
        market: Optional[str] = None,
        limit: int = 10,
    ) -> MarketResult:
        """
        Fetches current market prices for the given commodity/location.

        Args:
            commodity: Crop/commodity name (e.g. 'Cotton', 'Rice', 'Groundnut')
            state: State name (e.g. 'Telangana')
            market: Market/mandi name (e.g. 'Warangal')
            limit: Maximum number of records to return

        Returns:
            MarketResult with status 'success' or 'data_unavailable'
        """
        # Guard: API key required
        if not settings.market_api_key:
            logger.info("MARKET_API_KEY not configured — returning data_unavailable.")
            return MarketResult(
                status="data_unavailable",
                error="Market API key not configured. Set MARKET_API_KEY in environment.",
            )

        # At least one filter is required to avoid huge responses
        if not commodity and not state and not market:
            logger.info("Market request missing all filters — returning missing_context.")
            return MarketResult(
                status="data_unavailable",
                error="At least one filter (commodity, state, or market) is required.",
            )

        try:
            return self._fetch_with_retry(commodity, state, market, limit)
        except Exception as e:
            logger.error("Market provider unexpected error: %s", type(e).__name__)
            return MarketResult(
                status="data_unavailable",
                error="Market service temporarily unavailable.",
            )

    def _fetch_with_retry(
        self,
        commodity: Optional[str],
        state: Optional[str],
        market: Optional[str],
        limit: int,
    ) -> MarketResult:
        """Internal: performs the HTTP request with tenacity retry."""
        attempt = [0]

        @retry(
            stop=stop_after_attempt(self.MAX_ATTEMPTS),
            wait=wait_exponential(multiplier=1, min=1, max=8),
            retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
            reraise=True,
        )
        def _do_request() -> MarketResult:
            attempt[0] += 1
            if attempt[0] > 1:
                logger.info("Market API retry attempt %d/%d", attempt[0], self.MAX_ATTEMPTS)

            # Build query filters (Agmarknet API filter syntax)
            filters = []
            if commodity:
                filters.append(f'Commodity=="{commodity}"')
            if state:
                filters.append(f'State=="{state}"')
            if market:
                filters.append(f'Market=="{market}"')

            params: Dict[str, Any] = {
                "api-key": settings.market_api_key,
                "format": "json",
                "limit": limit,
                "offset": 0,
            }
            if filters:
                params["filters[0]"] = ";".join(filters)

            with httpx.Client(timeout=self.TIMEOUT) as client:
                response = client.get(self.BASE_URL, params=params)

            if response.status_code == 401:
                logger.warning("Market API authentication failed (401).")
                return MarketResult(
                    status="data_unavailable",
                    error="Market API authentication failed. Check MARKET_API_KEY.",
                )

            if response.status_code != 200:
                logger.warning("Market API returned HTTP %d.", response.status_code)
                return MarketResult(
                    status="data_unavailable",
                    error=f"Market API returned HTTP {response.status_code}.",
                )

            data = response.json()

            # Validate top-level structure
            if not isinstance(data, dict) or "records" not in data:
                logger.warning("Market API response missing 'records' field.")
                return MarketResult(
                    status="data_unavailable",
                    error="Market API returned unexpected response structure.",
                )

            raw_records = data["records"]
            if not isinstance(raw_records, list):
                return MarketResult(
                    status="data_unavailable",
                    error="Market API 'records' field is not a list.",
                )

            parsed: List[MarketRecord] = []
            for raw in raw_records:
                if not _validate_record(raw):
                    logger.warning("Market API record missing required fields, skipping.")
                    continue
                parsed.append(MarketRecord(
                    state=raw["State"],
                    district=raw["District"],
                    market=raw["Market"],
                    commodity=raw["Commodity"],
                    variety=raw["Variety"],
                    arrival_date=raw["Arrival_Date"],
                    min_price=_parse_price(raw.get("Min_Price")),
                    max_price=_parse_price(raw.get("Max_Price")),
                    modal_price=_parse_price(raw.get("Modal_Price")),
                ))

            if not parsed:
                return MarketResult(
                    status="data_unavailable",
                    error="Market API returned no valid records for the given filters.",
                )

            return MarketResult(
                status="success",
                records=parsed,
            )

        try:
            return _do_request()
        except (httpx.TimeoutException, httpx.NetworkError) as e:
            logger.warning("Market API unreachable after retries: %s", type(e).__name__)
            return MarketResult(
                status="data_unavailable",
                error="Market service timed out or is unreachable.",
            )


# Module-level singleton
market_provider = MarketProvider()

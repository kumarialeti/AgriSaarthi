"""
AgriSaarthi AI Service — Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    ai_service_port: int = 8001
    log_level: str = "info"

    # Gemini
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-1.5-flash"
    gemini_vision_model: str = "gemini-1.5-flash"

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8000
    chroma_collection_crops: str = "agrisaarthi_crops"
    chroma_collection_schemes: str = "agrisaarthi_schemes"
    chroma_collection_soil: str = "agrisaarthi_soil"

    # Embeddings
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

    # ── Weather (Open-Meteo — no API key required) ─────────────────
    weather_api_base_url: str = "https://api.open-meteo.com/v1"
    weather_api_timeout: float = 10.0       # seconds
    weather_api_retries: int = 2            # retries after initial attempt

    # Legacy field kept for backwards compatibility; no longer used by providers
    weather_use_mock: bool = False
    weather_api_key: Optional[str] = None   # Not required for Open-Meteo

    # ── Market (data.gov.in Agmarknet — API key required) ──────────
    market_api_base_url: str = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
    market_api_key: Optional[str] = None    # Register at data.gov.in to obtain
    market_api_timeout: float = 10.0        # seconds
    market_api_retries: int = 2             # retries after initial attempt

    # Database
    database_url: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

"""
AgriSaarthi AI Service — FastAPI Application Entry Point
"""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.config import settings
from app.routers.ai import router as ai_router

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("🌱 AgriSaarthi AI Service starting...")

    # Pre-load embedding model (optional, for faster first request)
    try:
        if settings.gemini_api_key:
            logger.info(f"✅ Gemini API key configured (model: {settings.gemini_model})")
        else:
            logger.warning("⚠️  GEMINI_API_KEY not set. AI responses will be unavailable.")

        # Initialize RAG pipeline lazily (connects on first use)
        logger.info(f"ChromaDB target: {settings.chroma_host}:{settings.chroma_port}")

    except Exception as e:
        logger.warning(f"Startup warning: {e}")

    logger.info("🚀 AgriSaarthi AI Service ready")
    yield

    logger.info("👋 AgriSaarthi AI Service shutting down")


# Create FastAPI app
app = FastAPI(
    title="AgriSaarthi AI Service",
    description="Multi-agent AI service for AgriSaarthi — From Soil to Sale.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restricted by Nginx in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "agrisaarthi-ai",
        "gemini_configured": bool(settings.gemini_api_key),
        "chroma_host": settings.chroma_host,
    }

# Mount AI routes
app.include_router(ai_router, prefix="/ai", tags=["AI"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.ai_service_port,
        reload=True,
        log_level=settings.log_level.lower(),
    )

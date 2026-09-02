"""
AgriSaarthi AI Service — FastAPI Routers
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import tempfile
import os

from app.agents.orchestrator import run_agent
from app.agents.vision import analyze_crop_image, extract_soil_report_text
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Request/Response Models ───────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    language: str = "en"
    session_id: Optional[str] = None
    farmer_context: Optional[Dict[str, Any]] = None
    history: Optional[List[Dict]] = None
    image_url: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    agent_trace: Optional[Dict] = None
    sources: List[Dict] = []
    confidence: float = 0.0


class SoilAnalysisRequest(BaseModel):
    soil_data: Dict[str, Any]
    language: str = "en"


class SoilExtractRequest(BaseModel):
    file_path: str
    mime_type: str


# ─── Chat Endpoint ─────────────────────────────────────────────────
@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint: routes query through LangGraph multi-agent system.
    """
    try:
        result = await run_agent(
            query=request.message,
            language=request.language,
            farmer_context=request.farmer_context or {},
            history=request.history or [],
            session_id=request.session_id,
        )
        return ChatResponse(**result)
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        fallbacks = {
            "en": "I'm experiencing technical difficulties. Please try again.",
            "te": "సాంకేతిక సమస్య వచ్చింది. దయచేసి మళ్ళీ ప్రయత్నించండి.",
            "hi": "तकनीकी समस्या आई है। कृपया पुनः प्रयास करें।",
        }
        lang = request.language if request.language in fallbacks else "en"
        return ChatResponse(response=fallbacks[lang], confidence=0.0)


# ─── Crop Image Analysis ───────────────────────────────────────────
@router.post("/analyze-crop")
async def analyze_crop(
    image: UploadFile = File(...),
    language: str = Form("en"),
    farmer_crop_id: Optional[str] = Form(None),
):
    """Analyze uploaded crop image for pest/disease."""
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Invalid image type. Use JPEG, PNG, or WebP.")

    # Save to temp file
    suffix = "." + (image.filename or "img.jpg").split(".")[-1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await image.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=413, detail="Image too large (max 10MB).")
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = await analyze_crop_image(
            image_path=tmp_path,
            language=language,
            farmer_crop_id=farmer_crop_id,
        )
        return result
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# ─── Analyze crop from file path (called by backend) ──────────────
@router.post("/analyze-crop-path")
async def analyze_crop_path(request: Dict):
    """Analyze a crop image by file path (internal use by Node.js backend)."""
    image_path = request.get("image_path")
    language = request.get("language", "en")
    farmer_crop_id = request.get("farmer_crop_id")

    if not image_path or not os.path.exists(image_path):
        raise HTTPException(status_code=400, detail="Image file not found.")

    result = await analyze_crop_image(
        image_path=image_path,
        language=language,
        farmer_crop_id=farmer_crop_id,
    )
    return result


# ─── Soil Analysis ─────────────────────────────────────────────────
@router.post("/soil-analysis")
async def soil_analysis(request: SoilAnalysisRequest):
    """Generate AI analysis for provided soil data."""
    soil_data = request.soil_data
    lang = request.language

    # Build query from soil data
    query = f"""Analyze my soil test results:
pH: {soil_data.get('ph', 'unknown')}
Nitrogen: {soil_data.get('nitrogen_kg_ha', 'unknown')} kg/ha
Phosphorus: {soil_data.get('phosphorus_kg_ha', 'unknown')} kg/ha
Potassium: {soil_data.get('potassium_kg_ha', 'unknown')} kg/ha
Organic Carbon: {soil_data.get('organic_carbon_pct', 'unknown')}%
EC: {soil_data.get('ec_ds_m', 'unknown')} dS/m

What do these values mean for my crop? What should I do?"""

    result = await run_agent(
        query=query,
        language=lang,
        farmer_context={"latest_soil": soil_data},
    )

    return {"analysis": result.get("response"), "sources": result.get("sources", [])}


# ─── Soil Report Extraction ────────────────────────────────────────
@router.post("/extract-soil-report")
async def extract_soil_report(request: SoilExtractRequest):
    """Extract soil parameter values from uploaded PDF/image (legacy file path)."""
    result = await extract_soil_report_text(
        file_path=request.file_path,
        mime_type=request.mime_type,
    )
    return result


@router.post("/extract-soil-file")
async def extract_soil_file(file: UploadFile = File(...)):
    """Extract soil parameter values from multipart uploaded PDF/image."""
    suffix = "." + (file.filename or "doc.pdf").split(".")[-1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        mime_type = file.content_type or "application/pdf"
        result = await extract_soil_report_text(
            file_path=tmp_path,
            mime_type=mime_type,
        )
        return result
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# ─── Voice Transcription ───────────────────────────────────────────
@router.post("/voice/transcribe")
async def transcribe_voice(
    audio: UploadFile = File(...),
    language: str = Form("en"),
):
    """
    Transcribe audio to text using Gemini.
    Falls back gracefully if API is unavailable.
    """
    if not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="Voice transcription not configured. Use text input.")

    try:
        content = await audio.read()
        if len(content) > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=413, detail="Audio file too large.")

        # For now, return a helpful message directing to browser speech API
        # Full Gemini audio transcription would require the audio file format support
        raise HTTPException(
            status_code=501,
            detail="Server-side transcription coming soon. Please use browser microphone button."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=503, detail="Transcription service unavailable.")

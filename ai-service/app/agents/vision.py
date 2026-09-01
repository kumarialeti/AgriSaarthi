"""
AgriSaarthi AI Service — Vision Analysis (Crop Image)
Uses Gemini Vision for crop disease/pest detection.
"""
import logging
import base64
from pathlib import Path
from typing import Optional, Dict, Any
from app.config import settings
from app.rag.pipeline import rag

logger = logging.getLogger(__name__)


def encode_image_base64(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


async def analyze_crop_image(
    image_path: str,
    language: str = "en",
    farmer_crop_id: Optional[str] = None,
    crop_context: Optional[Dict] = None,
) -> Dict[str, Any]:
    """
    Analyze a crop image for pest/disease issues using Gemini Vision.
    Returns structured analysis with confidence, severity, recommendations.
    """
    if not settings.gemini_api_key:
        return {
            "analysis_available": False,
            "error": "Vision AI not configured. Please add GEMINI_API_KEY.",
        }

    # Validate image exists
    if not Path(image_path).exists():
        return {"analysis_available": False, "error": "Image file not found."}

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_vision_model)

        # Upload image
        with open(image_path, "rb") as f:
            image_bytes = f.read()

        # Retrieve relevant crop health docs for RAG context
        query_for_rag = f"crop disease pest symptoms {crop_context.get('crop_name', '') if crop_context else ''}"
        docs = rag.retrieve(query_for_rag, settings.chroma_collection_crops, n_results=3)
        rag_context = "\n".join([d["content"] for d in docs[:2]]) if docs else ""

        lang_instructions = {
            "en": "Respond in English.",
            "te": "తెలుగులో సమాధానం ఇవ్వండి.",
            "hi": "हिंदी में उत्तर दें।",
        }

        prompt = f"""You are an expert agricultural plant pathologist. Analyze this crop image carefully.

{lang_instructions.get(language, lang_instructions['en'])}

Agricultural reference knowledge:
{rag_context}

Provide your analysis in this EXACT JSON format:
{{
  "detected_issue": "Name of the pest/disease or 'Healthy plant' or 'Cannot determine from image'",
  "confidence": "high|medium|low",
  "confidence_score": 0.0-1.0,
  "severity": "mild|moderate|severe|none",
  "symptoms": ["symptom 1", "symptom 2"],
  "likely_cause": "Brief explanation of cause",
  "immediate_actions": ["action 1", "action 2"],
  "preventive_measures": ["measure 1", "measure 2"],
  "when_to_seek_expert": "Condition when farmer should contact agriculture officer",
  "monitoring_advice": "What to watch for in next few days",
  "disclaimer": "This is an AI-based preliminary assessment. Please verify with local agriculture expert before taking chemical treatment decisions.",
  "response": "Full response text in {language}"
}}

IMPORTANT:
- Never claim 100% certainty
- If image is unclear or blurry, request a clearer photo
- Do NOT recommend specific pesticide quantities
- Always recommend expert verification for chemical treatments"""

        import PIL.Image
        import io

        img = PIL.Image.open(io.BytesIO(image_bytes))
        response = model.generate_content([prompt, img])

        # Parse JSON from response
        import json
        import re

        text = response.text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            try:
                result = json.loads(json_match.group())
                result["analysis_available"] = True
                return result
            except json.JSONDecodeError:
                pass

        # Fallback if JSON parsing fails
        return {
            "analysis_available": True,
            "detected_issue": "Analysis completed",
            "confidence": "low",
            "confidence_score": 0.4,
            "severity": "unknown",
            "response": text,
            "disclaimer": "This is an AI-based preliminary assessment. Please verify with local agriculture expert.",
        }

    except Exception as e:
        logger.error(f"Vision analysis error: {e}")
        return {
            "analysis_available": False,
            "error": f"Image analysis failed: {str(e)[:200]}",
        }


async def extract_soil_report_text(
    file_path: str,
    mime_type: str,
) -> Dict[str, Any]:
    """
    Extract soil parameter values from uploaded report using Gemini.
    """
    if not settings.gemini_api_key:
        return {"extracted": {}, "error": "AI extraction not configured."}

    try:
        if mime_type == "application/pdf":
            # Use pypdf for text extraction
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text = "\n".join([page.extract_text() for page in reader.pages])
        else:
            # Image-based soil report
            import google.generativeai as genai
            import PIL.Image
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(settings.gemini_vision_model)
            img = PIL.Image.open(file_path)

            extract_prompt = """Extract soil test parameters from this soil report image.
Return ONLY JSON in this format:
{"ph": null, "nitrogen_kg_ha": null, "phosphorus_kg_ha": null, "potassium_kg_ha": null, "organic_carbon_pct": null, "ec_ds_m": null}
Use null for any parameter not found. Convert units if needed (e.g., mg/kg to kg/ha using standard conversion)."""

            response = model.generate_content([extract_prompt, img])
            text = response.text

        import json, re
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            extracted = json.loads(json_match.group())
            return {"extracted": extracted}

        return {"extracted": {}, "note": "Could not parse soil values automatically. Please enter manually."}

    except Exception as e:
        logger.error(f"Soil extraction error: {e}")
        return {"extracted": {}, "error": str(e)[:200]}

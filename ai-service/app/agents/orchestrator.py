"""
AgriSaarthi AI — LangGraph Multi-Agent Orchestration
Manager Agent routes to specialized agents based on intent.

Phase 4: Real live-data providers for Weather (Open-Meteo) and Market (Agmarknet).
Mocks removed. All live-data failures produce explicit data_unavailable status.
"""
import logging
from typing import Dict, Any, List, Optional
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from app.config import settings
from app.rag.retriever import DocumentRetriever
from app.agents.state import AgentState, AgentOutput, RoutingDecision
from app.providers.weather import weather_provider
from app.providers.market import market_provider

logger = logging.getLogger(__name__)

# ─── LLM Factory ──────────────────────────────────────────────────
def get_llm(temperature: float = 0.1):
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY not configured")
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=temperature,
        convert_system_message_to_human=True,
    )

# ─── Language-Aware System Prompts ────────────────────────────────
FINAL_RESPONSE_PROMPTS = {
    "en": "You are AgriSaarthi AI, an expert agricultural assistant. Synthesize the following agent evidence into a clear, farmer-friendly response. Never expose internal reasoning or chain of thought. If insufficient data is provided, state clearly that you do not have enough information.",
    "te": "మీరు అగ్రిసారథి AI, నిపుణ వ్యవసాయ సహాయకుడు. కింది ఏజెంట్ ఆధారాలను స్పష్టమైన, రైతుకు అనుకూలమైన ప్రతిస్పందనగా సంశ్లేషణ చేయండి. అంతర్గత తార్కికతను ఎప్పుడూ బహిర్గతం చేయవద్దు. తగినంత సమాచారం లేకపోతే, స్పష్టంగా చెప్పండి.",
    "hi": "आप एग्रीसारथी एआई हैं, एक विशेषज्ञ कृषि सहायक। निम्नलिखित एजेंट साक्ष्यों को स्पष्ट, किसान-अनुकूल प्रतिक्रिया में संश्लेषित करें। कभी भी आंतरिक तर्क को उजागर न करें। यदि अपर्याप्त जानकारी है, तो स्पष्ट रूप से बताएं।"
}

# ─── Coordinate Extraction Helpers ────────────────────────────────

def _extract_coordinates(farmer_context: Dict[str, Any]) -> tuple[Optional[float], Optional[float]]:
    """
    Extracts latitude/longitude from farmer context.
    Priority: field coordinates → farmer profile coordinates.
    Returns (None, None) if no coordinates are available.
    """
    if not farmer_context:
        return None, None

    # 1. Check field-level coordinates (most specific)
    fields = farmer_context.get("fields", [])
    if fields and isinstance(fields, list):
        for f in fields:
            lat = f.get("latitude") or f.get("lat")
            lon = f.get("longitude") or f.get("lon") or f.get("lng")
            if lat is not None and lon is not None:
                try:
                    return float(lat), float(lon)
                except (TypeError, ValueError):
                    continue

    # 2. Fall back to farmer profile coordinates
    lat = farmer_context.get("latitude") or farmer_context.get("lat")
    lon = farmer_context.get("longitude") or farmer_context.get("lon") or farmer_context.get("lng")
    if lat is not None and lon is not None:
        try:
            return float(lat), float(lon)
        except (TypeError, ValueError):
            pass

    return None, None


def _extract_crop(state: AgentState) -> Optional[str]:
    """Extracts crop from state, preferring orchestrator-detected crop over farmer context."""
    crop = state.get("crop")
    if crop:
        return crop
    farmer_context = state.get("farmer_context", {})
    if farmer_context:
        # Try fields first
        fields = farmer_context.get("fields", [])
        if fields and isinstance(fields, list):
            for f in fields:
                if f.get("crop") or f.get("crop_name"):
                    return f.get("crop") or f.get("crop_name")
        # Farmer profile crops
        crops = farmer_context.get("crops", [])
        if crops and isinstance(crops, list) and len(crops) > 0:
            return crops[0].get("crop_name") or crops[0].get("name")
    return None


def _extract_state_name(farmer_context: Dict[str, Any]) -> Optional[str]:
    """Extracts the farmer's state from profile."""
    if not farmer_context:
        return None
    return farmer_context.get("state") or farmer_context.get("state_name")


# ─── Manager (Orchestrator) Node ──────────────────────────────────
def orchestrator_node(state: AgentState) -> AgentState:
    """Detects intent, crop, and language. Routes to required agents."""
    llm = get_llm(temperature=0.0).with_structured_output(RoutingDecision)
    
    prompt = f"""
    Analyze this agricultural query: "{state['query']}"
    
    Available Farmer Context:
    {state.get('farmer_context', {})}
    
    Determine:
    1. The primary intent.
    2. The crop mentioned (if any).
    3. The language (en, te, hi).
    4. Which of these specialized agents are REQUIRED to answer it:
       - crop_planning
       - soil_health
       - crop_health
       - fertilizer
       - irrigation
       - weather
       - market
       - government_schemes
    5. Whether the query requires specific context (e.g. soil pH, crop growth stage, field area) to provide an accurate answer, AND that context is MISSING from the 'Available Farmer Context'.
    
    Rules:
    - Only select agents that are directly relevant. Avoid over-selecting.
    - If asking about weather/rain, select 'weather'.
    - If asking about prices, select 'market'.
    - If asking about pests/diseases, select 'crop_health'.
    - If asking about fertilizer, select 'fertilizer'.
    - If a specific field detail (e.g. soil type, acreage, crop variety) is absolutely necessary to give a safe, accurate recommendation and it is not in the context, set needs_context=True and list the missing_context.
    """
    
    try:
        decision: RoutingDecision = llm.invoke([HumanMessage(content=prompt)])
        state["intent"] = decision.intent
        state["crop"] = decision.crop
        state["language"] = decision.language
        state["required_agents"] = decision.required_agents
        state["needs_context"] = decision.needs_context
        state["missing_context"] = decision.missing_context
    except Exception as e:
        logger.error(f"Orchestrator failed: {e}")
        state["intent"] = "general"
        state["language"] = "en"
        state["required_agents"] = []
        state["needs_context"] = False
        state["missing_context"] = []
        
    return state


# ─── Specialized Agent Factories ──────────────────────────────────
def build_rag_agent(agent_name: str, category_filter: str):
    """Creates a RAG-backed agent node."""
    def agent_node(state: AgentState) -> AgentState:
        llm = get_llm(temperature=0.1).with_structured_output(AgentOutput)
        query = state["query"]
        crop = state.get("crop")
        
        # 1. Retrieve Evidence
        search_res = DocumentRetriever.search(
            query=query, 
            collection_name=settings.chroma_collection_crops,
            crop=crop,
            category=category_filter
        )
        
        # 2. Check Insufficient Evidence
        if search_res["status"] == "insufficient_knowledge":
            return {"agent_outputs": {agent_name: AgentOutput(
                status="insufficient_knowledge",
                decision_summary=f"No verified information found in knowledge base for {category_filter}.",
                evidence="", recommendation="", confidence=0.0, sources=[], warnings=[]
            )}}
            
        context = "\n".join([c["content"] for c in search_res["results"]])
        sources = [c["metadata"] for c in search_res["results"]]
        
        # 3. LLM Processing
        prompt = f"""
        Role: Agricultural Expert ({agent_name})
        Query: {query}
        Context: {context}
        
        Create a structured response based ONLY on the Context provided. 
        DO NOT invent facts, dosages, or chemical names.
        If the Context lacks specific details (e.g. exact dosage), set status to insufficient_knowledge.
        """
        try:
            output: AgentOutput = llm.invoke([HumanMessage(content=prompt)])
            output.sources = sources
            return {"agent_outputs": {agent_name: output}}
        except Exception:
            return {"agent_outputs": {agent_name: AgentOutput(
                status="error", decision_summary="Agent processing failed.", evidence="", recommendation="", confidence=0.0
            )}}
    return agent_node

# Specialized RAG Agents
crop_planning_agent = build_rag_agent("crop_planning", "crop_guidelines")
soil_health_agent = build_rag_agent("soil_health", "soil")
crop_health_agent = build_rag_agent("crop_health", "pest_disease")
fertilizer_agent = build_rag_agent("fertilizer", "nutrient_management")
irrigation_agent = build_rag_agent("irrigation", "irrigation")
government_schemes_agent = build_rag_agent("government_schemes", "government_schemes")


# ─── Live Data Agents ─────────────────────────────────────────────

def weather_agent(state: AgentState) -> AgentState:
    """
    Fetches live weather data from Open-Meteo using farmer context coordinates.
    
    Routing:
    - Coordinates found → fetch from Open-Meteo
    - No coordinates → data_unavailable with missing_context message
    - API failure/timeout → data_unavailable
    - Invalid response → data_unavailable
    
    NEVER falls back to RAG for weather.
    NEVER generates hallucinated weather values.
    """
    farmer_context = state.get("farmer_context", {})
    lat, lon = _extract_coordinates(farmer_context)

    result = weather_provider.get_weather(latitude=lat, longitude=lon)

    if result.status == "missing_context":
        return {"agent_outputs": {"weather": AgentOutput(
            status="data_unavailable",
            decision_summary=(
                "Location coordinates are required for weather data but are not available in your profile. "
                "Please update your farm location in your profile settings."
            ),
            evidence="",
            recommendation="Update your farm profile with latitude/longitude to receive weather forecasts.",
            confidence=0.0,
            sources=[],
            warnings=["Location data missing from farmer profile."],
        )}}

    if result.status != "success":
        return {"agent_outputs": {"weather": AgentOutput(
            status="data_unavailable",
            decision_summary="Live weather data is currently unavailable. Please try again later.",
            evidence="",
            recommendation="",
            confidence=0.0,
            sources=[],
            warnings=[],
        )}}

    evidence = result.to_evidence_string()
    sources = [{"provider": result.provider, "latitude": result.latitude, "longitude": result.longitude}]

    # Build a recommendation based on rain probability
    recommendation = "Monitor weather forecast regularly for farm planning."
    if result.precipitation_probability_max is not None:
        if result.precipitation_probability_max >= 70:
            recommendation = "High rain probability. Avoid spraying pesticides or fertilizers today."
        elif result.precipitation_probability_max >= 40:
            recommendation = "Moderate rain chance. Delay field operations if possible."
        else:
            recommendation = "Low rain probability. Conditions are suitable for field operations."

    return {"agent_outputs": {"weather": AgentOutput(
        status="success",
        decision_summary=f"Live weather retrieved from Open-Meteo for coordinates ({result.latitude:.4f}, {result.longitude:.4f}).",
        evidence=evidence,
        recommendation=recommendation,
        confidence=0.9,
        sources=sources,
        warnings=[],
    )}}


def market_agent(state: AgentState) -> AgentState:
    """
    Fetches live commodity market prices from data.gov.in Agmarknet API.
    
    Routing:
    - API key present + commodity available → fetch from Agmarknet
    - API key missing → data_unavailable
    - API failure/timeout → data_unavailable
    - Invalid/empty response → data_unavailable
    
    NEVER falls back to RAG for market prices.
    NEVER generates hallucinated price values.
    """
    farmer_context = state.get("farmer_context", {})
    crop = _extract_crop(state)
    state_name = _extract_state_name(farmer_context)

    result = market_provider.get_prices(
        commodity=crop,
        state=state_name,
    )

    if result.status != "success":
        # Distinguish between missing key vs API failure
        is_key_missing = (
            result.error and "not configured" in result.error.lower()
        )
        summary = (
            "Market price service is not configured. Contact your administrator to set up the MARKET_API_KEY."
            if is_key_missing
            else "Live market data is currently unavailable. Please try again later."
        )
        return {"agent_outputs": {"market": AgentOutput(
            status="data_unavailable",
            decision_summary=summary,
            evidence="",
            recommendation="",
            confidence=0.0,
            sources=[],
            warnings=[],
        )}}

    evidence = result.to_evidence_string()
    sources = [{"provider": result.provider, "records_count": len(result.records)}]

    recommendation = "Compare prices across multiple markets before selling to maximize returns."
    if result.records:
        best = max(result.records, key=lambda r: r.modal_price or 0)
        if best.modal_price:
            recommendation = (
                f"Highest modal price found at {best.market}, {best.district}: "
                f"₹{best.modal_price}/qtl. Consider selling there if logistics permit."
            )

    return {"agent_outputs": {"market": AgentOutput(
        status="success",
        decision_summary=f"Live market prices retrieved from Agmarknet for {crop or 'requested commodity'}.",
        evidence=evidence,
        recommendation=recommendation,
        confidence=0.85,
        sources=sources,
        warnings=["Prices reflect last available data from Agmarknet. Verify with local mandi before selling."],
    )}}


# ─── Safety Node ──────────────────────────────────────────────────
def safety_validation_node(state: AgentState) -> AgentState:
    """Validates that chemical agents have evidence and intercepts hallucinations."""
    violations = []
    outputs = state.get("agent_outputs", {})
    
    for agent_name, output in outputs.items():
        if agent_name in ["fertilizer", "crop_health"] and output.status == "success":
            if not output.evidence and not output.sources:
                violations.append(f"{agent_name} attempted to provide a recommendation without evidence.")
                # Force override
                output.status = "insufficient_knowledge"
                output.recommendation = ""
                output.decision_summary = "Blocked by safety policy: No authoritative evidence provided."
    
    return {"safety_violations": violations}


# ─── Final Response Generator ─────────────────────────────────────
def final_response_generator(state: AgentState) -> AgentState:
    llm = get_llm(temperature=0.2)
    lang = state.get("language", "en")
    
    # Check if we need more context from the farmer
    if state.get("needs_context") and state.get("missing_context"):
        missing = ", ".join(state["missing_context"])
        prompt = f"""
        The farmer asked: "{state['query']}"
        However, you need the following missing details to provide an accurate answer: {missing}.
        
        Write a friendly follow-up question asking the farmer to provide these specific details.
        Do not answer the original question. Just ask for the missing information.
        Respond ONLY in this language code: {lang}.
        """
        res = llm.invoke([HumanMessage(content=prompt)])
        content = res.content
        if isinstance(content, list):
            content = " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        return {"final_response": str(content)}
        
    outputs = state.get("agent_outputs", {})
    
    if not outputs:
        # Fallback if no agents ran
        prompt = f"{FINAL_RESPONSE_PROMPTS.get(lang, FINAL_RESPONSE_PROMPTS['en'])}\n\nQuery: {state['query']}\nEvidence: None available."
        res = llm.invoke([HumanMessage(content=prompt)])
        content = res.content
        if isinstance(content, list):
            content = " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        return {"final_response": str(content)}
    
    # Synthesize outputs
    synthesis_context = ""
    for name, output in outputs.items():
        synthesis_context += f"\n--- {name.upper()} ---\n"
        synthesis_context += f"Status: {output.status}\n"
        synthesis_context += f"Decision Summary: {output.decision_summary}\n"
        synthesis_context += f"Evidence: {output.evidence}\n"
        synthesis_context += f"Recommendation: {output.recommendation}\n"
        if output.warnings:
            synthesis_context += f"Warnings: {', '.join(output.warnings)}\n"
            
    sys_prompt = FINAL_RESPONSE_PROMPTS.get(lang, FINAL_RESPONSE_PROMPTS["en"])
    prompt = f"{sys_prompt}\n\nUser Query: {state['query']}\n\nAgent Evidence:\n{synthesis_context}"
    
    res = llm.invoke([HumanMessage(content=prompt)])
    content = res.content
    if isinstance(content, list):
        content = " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
    return {"final_response": str(content)}


# ─── LangGraph Definition ─────────────────────────────────────────
def build_graph() -> StateGraph:
    workflow = StateGraph(AgentState)
    
    # Add Nodes
    workflow.add_node("orchestrator", orchestrator_node)
    
    # Specialized Agents
    workflow.add_node("crop_planning", crop_planning_agent)
    workflow.add_node("soil_health", soil_health_agent)
    workflow.add_node("crop_health", crop_health_agent)
    workflow.add_node("fertilizer", fertilizer_agent)
    workflow.add_node("irrigation", irrigation_agent)
    workflow.add_node("weather", weather_agent)
    workflow.add_node("market", market_agent)
    workflow.add_node("government_schemes", government_schemes_agent)
    
    workflow.add_node("safety_validation", safety_validation_node)
    workflow.add_node("final_response", final_response_generator)
    
    # Edges
    workflow.set_entry_point("orchestrator")
    
    # Conditional Routing from Orchestrator
    def route_agents(state: AgentState):
        if state.get("needs_context"):
            return ["final_response"]
            
        agents = state.get("required_agents", [])
        if not agents:
            return ["final_response"]
        valid_nodes = {"crop_planning", "soil_health", "crop_health", "fertilizer", "irrigation", "weather", "market", "government_schemes"}
        selected = [a for a in agents if a in valid_nodes]
        return selected if selected else ["final_response"]
        
    workflow.add_conditional_edges("orchestrator", route_agents)
    
    # Fan-in from all agents to safety node
    for agent in ["crop_planning", "soil_health", "crop_health", "fertilizer", "irrigation", "weather", "market", "government_schemes"]:
        workflow.add_edge(agent, "safety_validation")
        
    workflow.add_edge("safety_validation", "final_response")
    workflow.add_edge("final_response", END)
    
    return workflow.compile()

# Singleton graph
agent_graph = build_graph()

async def run_agent(query: str, language: str = "en", farmer_context: Dict = None, history: List = None, session_id: str = None) -> Dict:
    initial_state = {
        "messages": [],
        "query": query,
        "language": language,
        "farmer_context": farmer_context or {},
        "required_agents": [],
        "agent_outputs": {},
        "safety_violations": [],
        "needs_context": False,
        "missing_context": [],
        "final_response": ""
    }
    
    result = agent_graph.invoke(initial_state)
    
    # Extract sources and minimum confidence
    sources = []
    confidences = []
    for out in result.get("agent_outputs", {}).values():
        sources.extend(out.sources)
        confidences.append(out.confidence)
        
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    
    # Format the trace for debugging/UI if needed
    trace = {
        "intent": result.get("intent", "general"),
        "agents_used": list(result.get("agent_outputs", {}).keys()),
        "safety_violations": result.get("safety_violations", [])
    }
    
    return {
        "response": result.get("final_response", ""),
        "agent_trace": trace,
        "sources": sources,
        "confidence": avg_conf
    }

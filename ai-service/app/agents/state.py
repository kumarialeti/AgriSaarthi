from typing import TypedDict, Annotated, Sequence, Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from langchain_core.messages import BaseMessage
import operator

# --- Structured Output Schema for Specialized Agents ---

class AgentOutput(BaseModel):
    """Standardized output for all specialized agricultural agents."""
    status: Literal["success", "insufficient_knowledge", "data_unavailable", "error"] = Field(
        ..., description="The status of the agent's execution"
    )
    decision_summary: str = Field(
        ..., description="A concise, user-safe explanation of why this recommendation was made. No internal chain of thought."
    )
    evidence: str = Field(
        "", description="The raw facts extracted from RAG or Live Sources to support the decision."
    )
    recommendation: str = Field(
        "", description="The actionable advice for the farmer."
    )
    confidence: float = Field(
        0.0, description="Confidence score from 0.0 to 1.0"
    )
    sources: List[Dict[str, Any]] = Field(
        default_factory=list, description="List of source metadata dicts for citations."
    )
    warnings: List[str] = Field(
        default_factory=list, description="Critical safety warnings (e.g., pesticide hazards)."
    )

class RoutingDecision(BaseModel):
    """Output from the orchestrator deciding where to route the request."""
    intent: str = Field(description="The primary intent of the user (e.g., 'crop_health', 'general_agri', 'weather', 'chitchat', 'soil_test')")
    crop: Optional[str] = Field(None, description="The specific crop mentioned, if any (e.g., 'rice', 'cotton')")
    language: Literal["en", "te", "hi"] = Field(default="en", description="Detected language of the query")
    required_agents: List[str] = Field(default_factory=list, description="List of specialized agents needed to answer")
    needs_context: bool = Field(default=False, description="True if the query requires specific farmer context (e.g., soil type, crop stage) to answer accurately, but the context is missing.")
    missing_context: List[str] = Field(default_factory=list, description="List of missing context variables required to answer (e.g., ['soil pH', 'crop growth stage']).")

# --- Reducer Functions for Parallel Execution ---
def merge_agent_outputs(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    """Merges dictionaries of agent outputs."""
    merged = a.copy()
    merged.update(b)
    return merged

# --- State Definition ---
class AgentState(TypedDict):
    """The central state object for the LangGraph orchestration."""
    # Inputs
    messages: List[BaseMessage]
    query: str
    farmer_context: Dict[str, Any]
    
    # Manager Outputs
    intent: str
    crop: Optional[str]
    language: str
    required_agents: List[str]
    needs_context: bool
    missing_context: List[str]
    
    # Specialized Agent Outputs (Stored in a dictionary mapped by agent name)
    agent_outputs: Annotated[Dict[str, AgentOutput], merge_agent_outputs]
    
    # Safety Node Outputs
    safety_violations: List[str]
    
    # Final Generator Outputs
    final_response: str

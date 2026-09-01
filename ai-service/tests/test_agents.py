import pytest
from app.agents.state import AgentState, AgentOutput
from app.agents.orchestrator import (
    orchestrator_node,
    safety_validation_node,
    weather_agent,
    market_agent,
    final_response_generator
)
from langchain_core.messages import HumanMessage

def test_weather_only_routing():
    state = {
        "query": "Will it rain tomorrow in Warangal?",
        "language": "en",
        "intent": "",
        "crop": None,
        "required_agents": [],
        "agent_outputs": {},
        "safety_violations": [],
        "final_response": ""
    }
    
    def mock_invoke(*args, **kwargs):
        class MockResponse:
            def __init__(self):
                from app.agents.state import RoutingDecision
                self.content = RoutingDecision(
                    intent="weather",
                    crop=None,
                    language="en",
                    required_agents=["weather"]
                )
        return MockResponse().content
    
    # Patch the orchestrator's llm object just for this test
    import app.agents.orchestrator
    original_get_llm = app.agents.orchestrator.get_llm
    
    class MockLLM:
        def with_structured_output(self, schema):
            return self
        def invoke(self, *args, **kwargs):
            return mock_invoke()
            
    app.agents.orchestrator.get_llm = lambda *args, **kwargs: MockLLM()
    
    new_state = orchestrator_node(state)
    assert "weather" in new_state["required_agents"]
    
    app.agents.orchestrator.get_llm = original_get_llm
    
def test_chemical_safety_blocking():
    # If a chemical agent gives a recommendation WITHOUT evidence, it should be blocked.
    state = {
        "agent_outputs": {
            "fertilizer": AgentOutput(
                status="success",
                decision_summary="I think you should use Urea.",
                evidence="", # NO EVIDENCE!
                recommendation="Apply 50kg Urea per hectare",
                confidence=0.8,
                sources=[],
                warnings=[]
            )
        }
    }
    
    new_state = safety_validation_node(state)
    
    assert len(new_state["safety_violations"]) == 1
    # Check that the agent output was mutated in-place to block the recommendation
    blocked_output = state["agent_outputs"]["fertilizer"]
    assert blocked_output.status == "insufficient_knowledge"
    assert blocked_output.recommendation == ""
    assert "Blocked by safety policy" in blocked_output.decision_summary

def test_live_data_unavailable():
    # With the real provider, a query with no farmer location returns data_unavailable
    # because coordinates are missing (not via the old magic-string mechanism).
    state = {"query": "what is the weather today", "farmer_context": {}}
    out = weather_agent(state)
    assert out["agent_outputs"]["weather"].status == "data_unavailable"
    # Evidence must be empty — no hallucinated weather values
    assert out["agent_outputs"]["weather"].evidence == ""

def test_final_response_language():
    state = {
        "query": "నమస్కారం",
        "language": "te",
        "agent_outputs": {
            "weather": AgentOutput(
                status="success",
                decision_summary="Weather is clear",
                evidence="No rain.",
                recommendation="Safe to spray.",
                confidence=0.9
            )
        }
    }
    
    class MockLLM2:
        def invoke(self, *args, **kwargs):
            class MockResp:
                content = "తెలుగులో సమాధానం (Telugu Response)"
            return MockResp()
            
    import app.agents.orchestrator
    orig_llm = app.agents.orchestrator.get_llm
    app.agents.orchestrator.get_llm = lambda *args, **kwargs: MockLLM2()
    
    out = final_response_generator(state)
    assert "final_response" in out
    assert len(out["final_response"]) > 5
    
    app.agents.orchestrator.get_llm = orig_llm

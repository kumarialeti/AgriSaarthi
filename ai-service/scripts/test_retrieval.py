import json
import logging
from app.rag.retriever import DocumentRetriever
from app.rag.ingest import ingest_directory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_insufficient_evidence():
    """Verify that a nonsense query returns insufficient_knowledge."""
    logger.info("Testing irrelevant query...")
    result = DocumentRetriever.search("How do I build a spaceship to Mars?")
    
    assert result["status"] == "insufficient_knowledge"
    logger.info("✅ Insufficient evidence test passed.")

def run_evaluation():
    logger.info("Starting RAG retrieval evaluation...")
    
    # 1. Ingest test fixture
    fixture_dir = "tests/fixtures"
    logger.info(f"Ingesting {fixture_dir}...")
    ingest_directory(fixture_dir, collection_name="agrisaarthi_test_coll")
    
    # 2. Test multilingual retrieval
    logger.info("Testing multilingual retrieval on fixture...")
    
    # The fixture mentions "test-crop requires pH of exactly 7.99"
    # We query in Telugu/Hindi and see if it retrieves it.
    queries = [
        "What is the pH for test-crop?",
        "test-crop కి కావలసిన pH ఎంత?",
        "test-crop के लिए सही pH क्या है?"
    ]
    
    for q in queries:
        res = DocumentRetriever.search(q, collection_name="agrisaarthi_test_coll", top_k=2)
        if res["status"] == "success":
            logger.info(f"✅ Found context for query: '{q}' (Score: {res['results'][0]['relevance_score']})")
        else:
            logger.warning(f"❌ Failed to find context for query: '{q}'")
            
    # 3. Test empty/irrelevant
    res = DocumentRetriever.search("What is the recipe for chicken biryani?", collection_name="agrisaarthi_test_coll")
    if res["status"] == "insufficient_knowledge":
        logger.info("✅ Irrelevant query correctly blocked.")
    else:
        logger.error("❌ Irrelevant query returned false context!")
        
if __name__ == "__main__":
    run_evaluation()

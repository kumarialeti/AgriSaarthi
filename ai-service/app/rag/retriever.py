import logging
from typing import List, Dict, Any, Optional
from app.rag.pipeline import rag
from app.rag.metadata import ChunkMetadata

logger = logging.getLogger(__name__)

class DocumentRetriever:
    """Handles semantic search and metadata filtering with strict safety checks."""
    
    DEFAULT_TOP_K = 5
    RELEVANCE_THRESHOLD = 0.50 # Configurable threshold

    @classmethod
    def search(
        cls, 
        query: str, 
        collection_name: str = "agrisaarthi_crops",
        language: Optional[str] = None,
        crop: Optional[str] = None,
        category: Optional[str] = None,
        top_k: int = DEFAULT_TOP_K
    ) -> Dict[str, Any]:
        """
        Performs semantic retrieval.
        Returns explicit 'insufficient_knowledge' state if results are poor.
        """
        # 1. Build metadata filters (ChromaDB syntax)
        conditions = [{"version_status": "active"}]
        
        if crop:
            conditions.append({"crop": crop.lower()})
        if category:
            conditions.append({"category": category.lower()})
            
        if len(conditions) > 1:
            where_filter = {"$and": conditions}
        else:
            where_filter = conditions[0]

        # 2. Retrieve from RAG Pipeline
        logger.info(f"Retrieving '{query}' with filters: {where_filter}")
        results = rag.retrieve(query, collection_name=collection_name, n_results=top_k, where=where_filter)
        
        # 3. Deduplicate
        seen_chunks = set()
        deduped = []
        for res in results:
            content = res["content"]
            if content not in seen_chunks:
                seen_chunks.add(content)
                deduped.append(res)
                
        # 4. Relevance Threshold Check
        if not deduped:
            return cls._insufficient_response()
            
        highest_score = deduped[0].get("relevance_score", 0.0)
        if highest_score < cls.RELEVANCE_THRESHOLD:
            logger.warning(f"Insufficient relevance ({highest_score} < {cls.RELEVANCE_THRESHOLD})")
            return cls._insufficient_response()

        return {
            "status": "success",
            "results": deduped,
            "message": "Relevant evidence found."
        }

    @staticmethod
    def _insufficient_response() -> Dict[str, Any]:
        return {
            "status": "insufficient_knowledge",
            "results": [],
            "message": "No authoritative evidence found in the knowledge base."
        }

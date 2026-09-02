"""
AgriSaarthi AI Service — ChromaDB & RAG Pipeline
"""
import os
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from app.config import settings

logger = logging.getLogger(__name__)

# ─── Embedding Model ──────────────────────────────────────────────
_embedding_model: Optional[SentenceTransformer] = None

def get_embedding_model() -> Optional[SentenceTransformer]:
    global _embedding_model
    if _embedding_model is None:
        try:
            logger.info(f"Loading embedding model: {settings.embedding_model}")
            _embedding_model = SentenceTransformer(settings.embedding_model)
        except Exception as e:
            logger.warning(f"Embedding model unavailable ({e}). RAG will use fallback.")
            _embedding_model = None
    return _embedding_model


# ─── ChromaDB Client ─────────────────────────────────────────────
_chroma_client: Optional[chromadb.HttpClient] = None

def get_chroma_client() -> Optional[chromadb.HttpClient]:
    global _chroma_client
    if _chroma_client is None:
        try:
            client = chromadb.HttpClient(
                host=settings.chroma_host,
                port=settings.chroma_port,
            )
            # Fast heartbeat check to prevent hanging if host/port is unreachable
            client.heartbeat()
            _chroma_client = client
            logger.info(f"ChromaDB connected at {settings.chroma_host}:{settings.chroma_port}")
        except Exception as e:
            logger.warning(f"ChromaDB unavailable ({e}). RAG will use fallback without hanging.")
            _chroma_client = None
    return _chroma_client


# ─── RAG Retrieval ────────────────────────────────────────────────
class RAGPipeline:
    """
    Semantic retrieval pipeline using ChromaDB + HuggingFace embeddings.
    Gracefully handles ChromaDB unavailability.
    """

    def __init__(self):
        self.client = None
        self.model = None
        self._initialized = False

    def _init(self):
        if self._initialized:
            return
        try:
            self.client = get_chroma_client()
            self.model = get_embedding_model()
            self._initialized = True
        except Exception as e:
            logger.warning(f"RAG pipeline init failed: {e}")

    def _distance_to_relevance(self, distance: float) -> float:
        """
        Converts ChromaDB's unnormalized L2 distance to a bounded 0.0-1.0 relevance score.
        For paraphrase-multilingual-MiniLM-L12-v2, vector norms are ~5.3.
        cosine_sim ~ 1 - (L2^2 / 50.0)
        """
        score = 1.0 - (distance / 50.0)
        return round(max(0.0, min(1.0, score)), 4)

    def retrieve(
        self,
        query: str,
        collection_name: str,
        n_results: int = 5,
        where: Optional[Dict] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve semantically relevant documents.
        Returns list of {content, metadata, distance} dicts.
        Falls back to empty list if unavailable.
        """
        self._init()
        if not self.client or not self.model:
            logger.warning("RAG unavailable, returning empty results")
            return []

        try:
            collection = self.client.get_or_create_collection(collection_name)
            query_embedding = self.model.encode([query])[0].tolist()

            kwargs = {
                "query_embeddings": [query_embedding],
                "n_results": min(n_results, max(1, collection.count())),
                "include": ["documents", "metadatas", "distances"],
            }
            if where:
                kwargs["where"] = where

            results = collection.query(**kwargs)

            docs = []
            for i, doc in enumerate(results.get("documents", [[]])[0]):
                meta = (results.get("metadatas", [[]])[0] or [{}])[i] if i < len(results.get("metadatas", [[]])[0] or []) else {}
                distance = (results.get("distances", [[]])[0] or [])[i] if i < len(results.get("distances", [[]])[0] or []) else 1.0
                docs.append({
                    "content": doc,
                    "metadata": meta,
                    "relevance_score": self._distance_to_relevance(distance),
                })

            return docs

        except Exception as e:
            logger.error(f"RAG retrieval error: {e}")
            return []

    def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        metadatas: List[Dict],
        ids: List[str],
    ) -> bool:
        """Add documents to a collection."""
        self._init()
        if not self.client or not self.model:
            return False

        try:
            collection = self.client.get_or_create_collection(collection_name)
            embeddings = self.model.encode(documents).tolist()
            collection.upsert(
                documents=documents,
                metadatas=metadatas,
                ids=ids,
                embeddings=embeddings,
            )
            logger.info(f"Added {len(documents)} docs to {collection_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to add documents to ChromaDB: {e}")
            return False


# Singleton
rag = RAGPipeline()

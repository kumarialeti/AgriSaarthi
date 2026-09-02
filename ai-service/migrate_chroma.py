import os
import json
import chromadb
import logging
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from chromadb.utils.embedding_functions import EmbeddingFunction

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load local environment
load_dotenv(".env")
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env")

# Define an EmbeddingFunction adapter for Chroma to use LangChain's Google GenAI embeddings
class GoogleEmbeddingFunction(EmbeddingFunction):
    def __init__(self, api_key: str):
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-2",
            google_api_key=api_key
        )
        
    def __call__(self, input: chromadb.Documents) -> chromadb.Embeddings:
        return self.embeddings.embed_documents(input)

# Setup Chroma
data_dir = "chroma_production_data" if os.path.exists("chroma_production_data") else "chroma_data_local"
client = chromadb.PersistentClient(path=data_dir)

# Initialize embeddings
embedding_func = GoogleEmbeddingFunction(api_key)

# The collections to migrate
collections_map = {
    "agrisaarthi_crops": "agrisaarthi_crops_v2",
    "agrisaarthi_schemes": "agrisaarthi_schemes_v2",
    "agrisaarthi_soil": "agrisaarthi_soil_v2"
}

for old_name, new_name in collections_map.items():
    export_path = f"{old_name}_export.json"
    if not os.path.exists(export_path):
        logger.warning(f"Export file {export_path} not found. Skipping migration to {new_name}.")
        continue
        
    with open(export_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    ids = data.get("ids", [])
    documents = data.get("documents", [])
    metadatas = data.get("metadatas", [])
    
    if not ids:
        logger.warning(f"No documents found in {export_path}. Skipping.")
        continue
        
    # Get or create new V2 collection
    # Distance metric explicitly set to cosine to match Google's embeddings which use cosine similarity.
    logger.info(f"Creating new collection {new_name} (metric: cosine)")
    v2_col = client.get_or_create_collection(
        name=new_name,
        metadata={"hnsw:space": "cosine"},
        embedding_function=embedding_func
    )
    
    logger.info(f"Embedding and adding {len(documents)} documents to {new_name}...")
    
    # Add to Chroma (Chroma will automatically call our embedding_func because we passed it on creation)
    # Batch the upsert if necessary, though Chroma handles reasonable sizes natively
    v2_col.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )
    
    # Verify
    count = v2_col.count()
    logger.info(f"SUCCESS: {new_name} now contains {count} documents.")

print("MIGRATION COMPLETE")

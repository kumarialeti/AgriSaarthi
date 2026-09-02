import os
import json
import chromadb
from chromadb.config import Settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Use the production local directory if it exists, otherwise the normal one
data_dir = "chroma_production_data" if os.path.exists("chroma_production_data") else "chroma_data_local"
logger.info(f"Using ChromaDB data dir: {data_dir}")

client = chromadb.PersistentClient(path=data_dir)

collections = ["agrisaarthi_crops", "agrisaarthi_schemes", "agrisaarthi_soil"]

report = {}

for name in collections:
    try:
        col = client.get_collection(name)
        count = col.count()
        report[name] = {"count": count, "metadata": col.metadata}
        
        # Export data for later re-embedding
        if count > 0:
            data = col.get(include=["documents", "metadatas"])
            export_path = f"{name}_export.json"
            with open(export_path, "w", encoding="utf-8") as f:
                json.dump({
                    "ids": data["ids"],
                    "documents": data["documents"],
                    "metadatas": data["metadatas"]
                }, f, ensure_ascii=False, indent=2)
            logger.info(f"Exported {count} docs from {name} to {export_path}")
        else:
            logger.info(f"Collection {name} is empty.")
    except Exception as e:
        logger.warning(f"Collection {name} not found or error: {e}")
        report[name] = {"error": str(e)}

with open("chroma_audit_report.json", "w") as f:
    json.dump(report, f, indent=2)

print("AUDIT COMPLETE")
print(json.dumps(report, indent=2))

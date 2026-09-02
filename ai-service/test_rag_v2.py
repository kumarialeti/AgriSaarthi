import os
import json
from app.rag.pipeline import rag

# Ensure we are querying the right collection
queries = [
    "What diseases affect wheat?",
    "How to manage pests in chilli?",
    "What fertilizers should I use for maize?",
    "government agriculture schemes"
]

results = {}
for q in queries:
    docs = rag.retrieve(
        query=q,
        collection_name="agrisaarthi_crops_v2",
        n_results=2
    )
    results[q] = docs

print(json.dumps(results, indent=2))

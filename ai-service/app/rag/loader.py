import os
from typing import List, Dict, Any
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader

class DocumentLoader:
    """Loads documents from disk and extracts text and basic metadata (like page numbers)."""
    
    @classmethod
    def load(cls, filepath: str) -> List[Dict[str, Any]]:
        """
        Loads a file and returns a list of pages/sections.
        Each item is a dict with 'text' and 'metadata' (e.g., page number).
        """
        ext = os.path.splitext(filepath)[1].lower()
        extracted_data = []

        if ext == ".pdf":
            loader = PyPDFLoader(filepath)
            docs = loader.load()
            for doc in docs:
                extracted_data.append({
                    "text": doc.page_content,
                    "metadata": {"page_number": doc.metadata.get("page", 0) + 1} # 1-indexed
                })
                
        elif ext == ".txt":
            loader = TextLoader(filepath, encoding="utf-8")
            docs = loader.load()
            for doc in docs:
                extracted_data.append({
                    "text": doc.page_content,
                    "metadata": {"page_number": 1}
                })
                
        elif ext == ".docx":
            loader = Docx2txtLoader(filepath)
            docs = loader.load()
            for doc in docs:
                extracted_data.append({
                    "text": doc.page_content,
                    "metadata": {"page_number": 1}
                })
        else:
            raise ValueError(f"Unsupported file format for loader: {ext}")
            
        return extracted_data

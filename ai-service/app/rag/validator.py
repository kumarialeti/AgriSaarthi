import os
import hashlib
from typing import Tuple

class DocumentValidator:
    """Validates files before ingestion into the RAG system."""
    
    SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".docx"}
    MIN_CONTENT_LENGTH = 50

    @classmethod
    def validate_file(cls, filepath: str) -> Tuple[bool, str]:
        """
        Validates if a file is suitable for ingestion.
        Returns (is_valid, error_message).
        """
        if not os.path.exists(filepath):
            return False, f"File not found: {filepath}"
            
        if not os.path.isfile(filepath):
            return False, f"Not a file: {filepath}"
            
        ext = os.path.splitext(filepath)[1].lower()
        if ext not in cls.SUPPORTED_EXTENSIONS:
            return False, f"Unsupported file extension: {ext}. Must be one of {cls.SUPPORTED_EXTENSIONS}"
            
        size = os.path.getsize(filepath)
        if size == 0:
            return False, "File is empty (0 bytes)."
            
        return True, ""

    @classmethod
    def validate_content(cls, content: str) -> Tuple[bool, str]:
        """Validates the extracted text content."""
        if not content or len(content.strip()) < cls.MIN_CONTENT_LENGTH:
            return False, f"Content too short or empty (min {cls.MIN_CONTENT_LENGTH} chars)."
        return True, ""

    @classmethod
    def load_sidecar(cls, filepath: str) -> Tuple[bool, str, dict]:
        """
        Looks for a .json sidecar next to the file.
        Returns (is_valid, error_message, parsed_metadata_dict).
        """
        base, _ = os.path.splitext(filepath)
        sidecar_path = base + ".json"
        
        if not os.path.exists(sidecar_path):
            return False, f"Missing required sidecar metadata: {sidecar_path}", {}
            
        import json
        try:
            with open(sidecar_path, 'r', encoding='utf-8') as f:
                meta = json.load(f)
        except json.JSONDecodeError as e:
            return False, f"Malformed JSON in sidecar {sidecar_path}: {e}", {}
        except Exception as e:
            return False, f"Could not read sidecar {sidecar_path}: {e}", {}
            
        from app.rag.metadata import DocumentMetadata
        from pydantic import ValidationError
        
        # Test if it complies with the mandatory fields
        try:
            # We construct with dummy document_id just for testing schema validation here
            # In production ingest.py, we override it.
            test_meta = meta.copy()
            if "document_id" not in test_meta:
                test_meta["document_id"] = "dummy"
            
            DocumentMetadata(**test_meta)
        except ValidationError as e:
            # Extract just the first line of the pydantic error for readability
            err_msg = str(e).split('\n')[0]
            return False, f"Invalid metadata in {sidecar_path}: {err_msg}", {}
            
        return True, "", meta

    @classmethod
    def get_file_hash(cls, filepath: str) -> str:
        """Returns SHA-256 hash of the file to detect duplicates."""
        hasher = hashlib.sha256()
        with open(filepath, 'rb') as f:
            while chunk := f.read(8192):
                hasher.update(chunk)
        return hasher.hexdigest()

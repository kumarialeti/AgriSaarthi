import os
import json
import pytest
from unittest.mock import patch, MagicMock
from app.rag.ingest import ingest_directory, IngestionRecord
from app.rag.metadata import DocumentMetadata
from app.rag.validator import DocumentValidator

@pytest.fixture
def temp_ingest_dir(tmp_path):
    """Creates a temporary directory with valid and invalid documents."""
    docs_dir = tmp_path / "knowledge"
    docs_dir.mkdir()
    
    # 1. Valid Document with Sidecar
    valid_pdf = docs_dir / "valid_doc.txt"
    valid_pdf.write_text("This is valid content about rice cultivation. " * 50)
    valid_json = docs_dir / "valid_doc.json"
    valid_json.write_text(json.dumps({
        "title": "Rice Guide",
        "authority": "ICAR",
        "source": "Institute",
        "source_url": "http://example.com",
        "language": "en",
        "crop": "rice",
        "category": "crop_guidelines",
        "version_status": "active"
    }))
    
    # 2. Document with missing sidecar
    missing_json_pdf = docs_dir / "missing_sidecar.txt"
    missing_json_pdf.write_text("This should be rejected.")
    
    # 3. Document with malformed sidecar (missing mandatory field 'authority')
    malformed_pdf = docs_dir / "malformed.txt"
    malformed_pdf.write_text("This should be rejected due to schema error.")
    malformed_json = docs_dir / "malformed.json"
    malformed_json.write_text(json.dumps({
        "title": "Bad Meta",
        "source": "Institute",
        "source_url": "http://example.com",
        "language": "en",
        "crop": "rice",
        "category": "crop_guidelines",
        "version_status": "active"
    }))
    
    return str(docs_dir)


def test_dry_run_and_manifest(temp_ingest_dir, tmp_path):
    manifest_file = tmp_path / "manifest.json"
    
    # Run in dry_run mode
    with patch("app.rag.ingest.rag.add_documents") as mock_add:
        ingest_directory(temp_ingest_dir, "test_coll", dry_run=True, manifest_path=str(manifest_file))
        mock_add.assert_not_called() # Should NEVER write to Chroma in dry_run
        
    assert manifest_file.exists()
    
    with open(manifest_file, "r") as f:
        records = json.load(f)
        
    assert len(records) == 3
    
    # Find valid
    valid_rec = next(r for r in records if r["filename"] == "valid_doc.txt")
    assert valid_rec["status"] == "success"
    assert valid_rec["chunk_count"] > 0
    assert valid_rec["metadata"]["authority"] == "ICAR"
    
    # Find missing sidecar
    missing_rec = next(r for r in records if r["filename"] == "missing_sidecar.txt")
    assert missing_rec["status"] == "failed"
    assert "Missing required sidecar" in missing_rec["failure_reason"]
    
    # Find malformed
    malformed_rec = next(r for r in records if r["filename"] == "malformed.txt")
    assert malformed_rec["status"] == "failed"
    assert "authority" in malformed_rec["failure_reason"].lower() or "validation error" in malformed_rec["failure_reason"].lower()

def test_metadata_pydantic_schema():
    # Valid
    meta = DocumentMetadata(
        document_id="123", title="Test", authority="A", source="S", source_url="U",
        language="en", crop="rice", category="soil", version_status="active"
    )
    assert meta.language == "en"
    
    # Invalid missing authority
    with pytest.raises(ValueError):
        DocumentMetadata(
            document_id="123", title="Test", source="S", source_url="U",
            language="en", crop="rice", category="soil", version_status="active"
        )

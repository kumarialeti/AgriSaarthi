import pytest
import os
from app.rag.validator import DocumentValidator
from app.rag.cleaner import TextCleaner
from app.rag.chunker import DocumentChunker
from app.rag.metadata import DocumentMetadata, ChunkMetadata

def test_validator_detects_empty():
    is_valid, err = DocumentValidator.validate_content("too short")
    assert not is_valid
    assert "too short" in err.lower()

def test_validator_supported_extension():
    # We are just calling class methods, not touching real files for this unit test
    is_valid, err = DocumentValidator.validate_file("fake.pdf")
    assert not is_valid  # Fails because file doesn't exist
    assert "not found" in err.lower()

def test_cleaner():
    raw_text = "This   is \n\n\n a \u201cTest\u201d."
    cleaned = TextCleaner.clean(raw_text)
    assert cleaned == 'This is \n\n a "Test".'

def test_chunker():
    chunker = DocumentChunker(chunk_size=10, chunk_overlap=2)
    text = "Hello world this is a test"
    chunks = chunker.split_text(text)
    assert len(chunks) > 1

def test_metadata_schema():
    meta = DocumentMetadata(
        document_id="123",
        title="Test Doc",
        authority="ICAR",
        source="ICAR portal",
        source_url="http://icar",
        language="en",
        crop="rice",
        category="soil"
    )
    assert meta.document_id == "123"
    
    with pytest.raises(Exception):
        DocumentMetadata(title="Missing ID")
    assert meta.version_status == "active"
    
    chunk_meta = ChunkMetadata(
        **meta.model_dump(),
        chunk_id="123_1",
        page_number=1
    )
    
    chroma_dict = chunk_meta.to_chroma_dict()
    assert chroma_dict["document_id"] == "123"
    assert chroma_dict["page_number"] == 1
    assert chroma_dict["source_url"] == "http://icar"

def test_distance_to_relevance():
    from app.rag.pipeline import rag
    # Valid bounds checking for Cosine distance (0.0 to 2.0)
    assert rag._distance_to_relevance(0.0) == 1.0
    assert rag._distance_to_relevance(2.0) == 0.0
    assert rag._distance_to_relevance(3.0) == 0.0 # Bounded at 0.0
    assert rag._distance_to_relevance(-1.0) == 1.0 # Bounded at 1.0
    
    # Meaningful distances
    assert rag._distance_to_relevance(1.0) == 0.50
    assert rag._distance_to_relevance(0.40) == 0.80
    assert rag._distance_to_relevance(1.60) == 0.20

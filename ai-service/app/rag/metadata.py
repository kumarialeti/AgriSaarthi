from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

class DocumentMetadata(BaseModel):
    """Metadata schema for ingested documents. All fields here are mandatory except dates."""
    
    document_id: str = Field(..., description="Unique identifier for the document (usually hash)")
    title: str = Field(..., description="Title of the document")
    authority: str = Field(..., description="Publisher or authority (e.g., ICAR)")
    source: str = Field(..., description="Name of the source")
    source_url: str = Field(..., description="URL to the original source")
    language: Literal["en", "te", "hi"] = Field(..., description="Language of the document")
    crop: str = Field(..., description="Crop this document pertains to (or 'general')")
    category: str = Field(..., description="Knowledge category (e.g., soil, pest_disease)")
    version_status: Literal["active", "outdated", "superseded", "under_review"] = Field(
        "active", description="Status of this knowledge version"
    )
    published_date: Optional[str] = Field(None, description="Date of publication (YYYY-MM-DD)")
    last_updated_date: Optional[str] = Field(None, description="Date last updated (YYYY-MM-DD)")

class ChunkMetadata(DocumentMetadata):
    """Metadata schema for individual text chunks."""
    
    chunk_id: str = Field(..., description="Unique identifier for the chunk")
    page_number: Optional[int] = Field(None, description="Page number where this chunk is found")
    section: Optional[str] = Field(None, description="Section heading where this chunk is found")

    def to_chroma_dict(self) -> Dict[str, Any]:
        """Convert to a flat dictionary suitable for ChromaDB metadata."""
        meta = self.model_dump(exclude_none=True)
        for key, value in list(meta.items()):
            if not isinstance(value, (str, int, float, bool)):
                meta[key] = str(value)
        return meta

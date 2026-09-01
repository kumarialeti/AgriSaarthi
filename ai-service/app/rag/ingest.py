import argparse
import os
import json
import logging
import datetime
from typing import Dict, Any, List
from pydantic import BaseModel

from app.rag.validator import DocumentValidator
from app.rag.loader import DocumentLoader
from app.rag.cleaner import TextCleaner
from app.rag.chunker import DocumentChunker
from app.rag.metadata import DocumentMetadata, ChunkMetadata
from app.rag.pipeline import rag

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

class IngestionRecord(BaseModel):
    document_id: str
    filename: str
    status: str
    failure_reason: str = ""
    page_count: int = 0
    chunk_count: int = 0
    content_hash: str = ""
    ingestion_timestamp: str = ""
    metadata: Dict[str, Any] = {}

def ingest_directory(directory: str, collection_name: str, dry_run: bool = False, manifest_path: str = None):
    if not os.path.exists(directory):
        logger.error(f"Directory not found: {directory}")
        return

    chunker = DocumentChunker(chunk_size=1000, chunk_overlap=200)
    
    docs_to_add = []
    metadatas_to_add = []
    ids_to_add = []
    
    manifest_records = []

    for root, _, files in os.walk(directory):
        for file in files:
            # We only process supported files; sidecars are loaded automatically.
            ext = os.path.splitext(file)[1].lower()
            if ext not in DocumentValidator.SUPPORTED_EXTENSIONS:
                continue
                
            filepath = os.path.join(root, file)
            record = IngestionRecord(
                document_id="",
                filename=file,
                status="failed",
                ingestion_timestamp=datetime.datetime.utcnow().isoformat()
            )
            
            logger.info(f"Processing: {filepath}")
            
            # 1. Validation of the File
            is_valid, err = DocumentValidator.validate_file(filepath)
            if not is_valid:
                logger.error(f"Failed validation: {err}")
                record.failure_reason = err
                manifest_records.append(record)
                continue

            # 2. Validation of the Sidecar JSON
            has_sidecar, sidecar_err, sidecar_meta = DocumentValidator.load_sidecar(filepath)
            if not has_sidecar:
                logger.error(f"Sidecar failed: {sidecar_err}")
                record.failure_reason = sidecar_err
                manifest_records.append(record)
                continue
                
            # 3. Hash computation
            doc_id = DocumentValidator.get_file_hash(filepath)[:12]
            record.document_id = doc_id
            record.content_hash = doc_id
            
            sidecar_meta["document_id"] = doc_id
            
            try:
                base_meta = DocumentMetadata(**sidecar_meta)
            except Exception as e:
                err_str = f"Metadata schema invalid: {e}"
                logger.error(err_str)
                record.failure_reason = err_str
                manifest_records.append(record)
                continue
                
            record.metadata = base_meta.model_dump()
            
            # 4. Loading
            try:
                raw_pages = DocumentLoader.load(filepath)
            except Exception as e:
                err_str = f"Failed to load content: {e}"
                logger.error(err_str)
                record.failure_reason = err_str
                manifest_records.append(record)
                continue
                
            record.page_count = len(raw_pages)
            
            # Process Pages
            doc_chunks = []
            for page_idx, page_data in enumerate(raw_pages):
                raw_text = page_data["text"]
                page_num = page_data["metadata"].get("page_number")
                
                clean_text = TextCleaner.clean(raw_text)
                is_valid_content, _ = DocumentValidator.validate_content(clean_text)
                if not is_valid_content:
                    continue
                    
                chunks = chunker.split_text(clean_text)
                for chunk_idx, chunk_text in enumerate(chunks):
                    chunk_meta = ChunkMetadata(
                        **base_meta.model_dump(),
                        chunk_id=f"{doc_id}_p{page_num}_c{chunk_idx}",
                        page_number=page_num
                    )
                    doc_chunks.append({
                        "text": chunk_text,
                        "meta": chunk_meta.to_chroma_dict(),
                        "id": chunk_meta.chunk_id
                    })
                    
            if not doc_chunks:
                record.failure_reason = "No valid text content found to chunk."
                manifest_records.append(record)
                continue
                
            record.chunk_count = len(doc_chunks)
            
            # 5. Append to global ingestion lists
            for c in doc_chunks:
                docs_to_add.append(c["text"])
                metadatas_to_add.append(c["meta"])
                ids_to_add.append(c["id"])
                
            record.status = "success"
            manifest_records.append(record)
            logger.info(f"Successfully processed {file}: {record.page_count} pages, {record.chunk_count} chunks.")

    # 6. ChromaDB Upsert & Reporting
    if not dry_run:
        if docs_to_add:
            logger.info(f"Upserting {len(docs_to_add)} chunks into collection: '{collection_name}'...")
            success = rag.add_documents(collection_name, docs_to_add, metadatas_to_add, ids_to_add)
            if not success:
                logger.error("ChromaDB upsert failed.")
                for r in manifest_records:
                    if r.status == "success":
                        r.status = "failed"
                        r.failure_reason = "ChromaDB upsert failed"
            else:
                logger.info("Ingestion completed successfully.")
        else:
            logger.info("No valid documents found to ingest.")
    else:
        logger.info(f"DRY RUN COMPLETE. {len(docs_to_add)} chunks across {sum(1 for r in manifest_records if r.status == 'success')} documents WOULD be ingested into '{collection_name}'. ChromaDB was NOT modified.")
        for r in manifest_records:
            if r.status == "failed":
                logger.warning(f"DRY RUN REJECTED {r.filename}: {r.failure_reason}")

    # 7. Write Manifest
    if manifest_path:
        try:
            with open(manifest_path, 'w', encoding='utf-8') as f:
                json.dump([r.model_dump() for r in manifest_records], f, indent=2)
            logger.info(f"Manifest written to {manifest_path}")
        except Exception as e:
            logger.error(f"Failed to write manifest: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest verified agricultural documents into RAG.")
    parser.add_argument("--path", type=str, required=True, help="Directory containing PDFs and sidecar JSONs")
    parser.add_argument("--collection", type=str, required=True, help="Target ChromaDB collection (e.g. agrisaarthi_crops or test_coll)")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without modifying ChromaDB")
    parser.add_argument("--manifest", type=str, default=None, help="Path to write the output JSON manifest")
    
    args = parser.parse_args()
    
    if args.dry_run:
        logger.info("Starting DRY RUN mode...")
        
    ingest_directory(args.path, args.collection, dry_run=args.dry_run, manifest_path=args.manifest)

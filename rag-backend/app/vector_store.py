from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import chromadb


@dataclass(slots=True)
class VectorSearchResult:
    chunk_id: str
    document_id: str
    title: str
    text: str
    distance: float
    score: float


class ChromaVectorStore:
    def __init__(self, persist_dir: Path, collection_name: str = "travel_chunks") -> None:
        self.client = chromadb.PersistentClient(path=str(persist_dir))
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert(
        self,
        *,
        chunk_ids: list[str],
        document_ids: list[str],
        titles: list[str],
        documents: list[str],
        embeddings: list[list[float]],
    ) -> None:
        metadatas: list[dict[str, Any]] = []
        for chunk_id, document_id, title in zip(chunk_ids, document_ids, titles, strict=True):
            metadatas.append(
                {
                    "chunk_id": chunk_id,
                    "document_id": document_id,
                    "title": title,
                }
            )

        self.collection.upsert(
            ids=chunk_ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    def delete_document(self, document_id: str) -> None:
        self.collection.delete(where={"document_id": document_id})

    def query(self, *, query_embedding: list[float], top_k: int) -> list[VectorSearchResult]:
        raw = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["metadatas", "documents", "distances"],
        )

        metadatas = raw.get("metadatas", [[]])[0]
        documents = raw.get("documents", [[]])[0]
        distances = raw.get("distances", [[]])[0]
        ids = raw.get("ids", [[]])[0]

        results: list[VectorSearchResult] = []
        for chunk_id, metadata, document, distance in zip(
            ids, metadatas, documents, distances, strict=False
        ):
            score = 1.0 / (1.0 + float(distance))
            results.append(
                VectorSearchResult(
                    chunk_id=chunk_id,
                    document_id=str(metadata.get("document_id", "")),
                    title=str(metadata.get("title", "")),
                    text=document,
                    distance=float(distance),
                    score=score,
                )
            )
        return results


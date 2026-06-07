from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from threading import Lock

import numpy as np
from rank_bm25 import BM25Okapi

from app.repository import ChunkRecord, DocumentRepository
from app.vector_store import ChromaVectorStore

logger = logging.getLogger(__name__)

CJK_SEQ_PATTERN = re.compile(r"[\u4e00-\u9fff]+")
ASCII_TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_]+")


def bm25_tokenize(text: str) -> list[str]:
    """
    BM25 tokenization tuned for Chinese + ASCII:
    - ASCII words keep whole-token form.
    - CJK text uses bigram/trigram n-grams (single-char tokens are too noisy).
    """

    normalized = text.lower()
    tokens: list[str] = []

    tokens.extend(ASCII_TOKEN_PATTERN.findall(normalized))

    for seq in CJK_SEQ_PATTERN.findall(normalized):
        if len(seq) < 2:
            continue

        for n in (2, 3):
            if len(seq) < n:
                continue
            for idx in range(len(seq) - n + 1):
                tokens.append(seq[idx : idx + n])

    return tokens


@dataclass(slots=True)
class RetrievedChunk:
    chunk_id: str
    document_id: str
    title: str
    text: str
    vector_score: float = 0.0
    keyword_score: float = 0.0
    fused_score: float = 0.0
    rerank_score: float = 0.0


class CrossEncoderReranker:
    def __init__(self, model_name: str, enabled: bool = True) -> None:
        self.model_name = model_name
        self.enabled = enabled
        self._model = None
        self._load_failed = False
        self._lock = Lock()

    def _load_model(self) -> None:
        if not self.enabled or self._model is not None or self._load_failed:
            return
        with self._lock:
            if self._model is not None or self._load_failed:
                return
            try:
                from sentence_transformers import CrossEncoder

                self._model = CrossEncoder(self.model_name, local_files_only=True)
                logger.info("Loaded reranker model: %s", self.model_name)
            except Exception as exc:  # noqa: BLE001
                self._load_failed = True
                logger.warning(
                    "Cross-encoder reranker unavailable (using fused ranking only): %s",
                    exc,
                )

    async def rerank(self, query: str, candidates: list[RetrievedChunk], top_n: int) -> list[RetrievedChunk]:
        if not candidates:
            return []

        if not self.enabled:
            return sorted(candidates, key=lambda item: item.fused_score, reverse=True)[:top_n]

        self._load_model()
        if self._model is None:
            return sorted(candidates, key=lambda item: item.fused_score, reverse=True)[:top_n]

        pairs = [[query, chunk.text] for chunk in candidates]
        scores = await asyncio.to_thread(self._model.predict, pairs)

        reranked: list[RetrievedChunk] = []
        for chunk, score in zip(candidates, scores, strict=True):
            chunk.rerank_score = float(score)
            reranked.append(chunk)

        reranked.sort(key=lambda item: item.rerank_score, reverse=True)
        return reranked[:top_n]


class HybridRetriever:
    def __init__(
        self,
        *,
        repository: DocumentRepository,
        vector_store: ChromaVectorStore,
        rrf_k: int = 60,
    ) -> None:
        self.repository = repository
        self.vector_store = vector_store
        self.rrf_k = rrf_k

        self._bm25: BM25Okapi | None = None
        self._chunk_records: list[ChunkRecord] = []
        self._bm25_lock = Lock()

    def _refresh_bm25_index(self) -> None:
        with self._bm25_lock:
            chunks = self.repository.list_chunks()
            tokenized_corpus = [bm25_tokenize(chunk.text) for chunk in chunks]
            self._chunk_records = chunks
            self._bm25 = BM25Okapi(tokenized_corpus) if tokenized_corpus else None

    def keyword_search(self, query: str, top_k: int) -> list[RetrievedChunk]:
        self._refresh_bm25_index()
        if self._bm25 is None:
            return []

        tokenized_query = bm25_tokenize(query)
        if not tokenized_query:
            return []
        scores = self._bm25.get_scores(tokenized_query)
        if len(scores) == 0:
            return []

        top_indices = np.argsort(scores)[::-1][:top_k]
        results: list[RetrievedChunk] = []
        for idx in top_indices:
            score = float(scores[idx])
            if score <= 0:
                continue
            chunk = self._chunk_records[int(idx)]
            results.append(
                RetrievedChunk(
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    title=chunk.title,
                    text=chunk.text,
                    keyword_score=score,
                )
            )
        return results

    def vector_search(self, query_embedding: list[float], top_k: int) -> list[RetrievedChunk]:
        vector_results = self.vector_store.query(query_embedding=query_embedding, top_k=top_k)
        return [
            RetrievedChunk(
                chunk_id=result.chunk_id,
                document_id=result.document_id,
                title=result.title,
                text=result.text,
                vector_score=result.score,
            )
            for result in vector_results
        ]

    def fuse_with_rrf(
        self,
        *,
        vector_results: list[RetrievedChunk],
        keyword_results: list[RetrievedChunk],
        top_k: int,
    ) -> list[RetrievedChunk]:
        indexed: dict[str, RetrievedChunk] = {}

        for rank, chunk in enumerate(vector_results, start=1):
            indexed.setdefault(chunk.chunk_id, chunk)
            indexed[chunk.chunk_id].fused_score += 1.0 / (self.rrf_k + rank)
            indexed[chunk.chunk_id].vector_score = max(indexed[chunk.chunk_id].vector_score, chunk.vector_score)

        for rank, chunk in enumerate(keyword_results, start=1):
            if chunk.chunk_id not in indexed:
                indexed[chunk.chunk_id] = chunk
            indexed[chunk.chunk_id].fused_score += 1.0 / (self.rrf_k + rank)
            indexed[chunk.chunk_id].keyword_score = max(
                indexed[chunk.chunk_id].keyword_score,
                chunk.keyword_score,
            )

        fused = list(indexed.values())
        fused.sort(key=lambda item: item.fused_score, reverse=True)
        return fused[:top_k]

from __future__ import annotations

from typing import Any
from dataclasses import dataclass

from app.utils import detokenize_tokens, tokenize_text

try:
    from llama_index.core import Document
    from llama_index.core.node_parser import SentenceSplitter
except ImportError:  # pragma: no cover - dependency guard
    Document = None
    SentenceSplitter = None


@dataclass(slots=True)
class Chunk:
    chunk_id: str
    document_id: str
    chunk_index: int
    title: str
    text: str
    token_count: int


class HybridChunker:
    """
    LlamaIndex SentenceSplitter driven chunking.

    We keep the existing Chunk contract for repository/vector-store compatibility.
    """

    def __init__(self, chunk_size: int = 768, overlap: int = 80, min_chunk_tokens: int = 120) -> None:
        if SentenceSplitter is None or Document is None:
            raise RuntimeError(
                "LlamaIndex is required for chunking. Install "
                "'llama-index-core' and 'llama-index-readers-file'."
            )
        if overlap >= chunk_size:
            raise ValueError("Chunk overlap must be smaller than chunk size.")
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.min_chunk_tokens = min_chunk_tokens
        self._splitter = SentenceSplitter(chunk_size=chunk_size, chunk_overlap=overlap)

    def chunk_text(self, *, document_id: str, title: str, content: str) -> list[Chunk]:
        normalized = content.strip()
        if not normalized:
            return []

        document = Document(text=normalized)
        nodes = self._splitter.get_nodes_from_documents([document])
        chunks: list[Chunk] = []
        for node in nodes:
            text = self._extract_node_text(node)
            if not text:
                continue

            token_count = len(tokenize_text(text))
            if token_count < self.min_chunk_tokens and chunks:
                continue

            chunk_index = len(chunks)
            chunks.append(
                Chunk(
                    chunk_id=f"{document_id}_chunk_{chunk_index:04d}",
                    document_id=document_id,
                    chunk_index=chunk_index,
                    title=title,
                    text=text,
                    token_count=token_count,
                )
            )

        if not chunks:
            tokens = tokenize_text(normalized)
            if not tokens:
                return []
            fallback_text = detokenize_tokens(tokens[: self.chunk_size]).strip() or normalized
            chunks.append(
                Chunk(
                    chunk_id=f"{document_id}_chunk_0000",
                    document_id=document_id,
                    chunk_index=0,
                    title=title,
                    text=fallback_text,
                    token_count=len(tokenize_text(fallback_text)),
                )
            )

        return chunks

    @staticmethod
    def _extract_node_text(node: Any) -> str:
        text = getattr(node, "text", None)
        if isinstance(text, str) and text.strip():
            return text.strip()

        get_content = getattr(node, "get_content", None)
        if callable(get_content):
            content = get_content()
            if isinstance(content, str) and content.strip():
                return content.strip()

        return ""

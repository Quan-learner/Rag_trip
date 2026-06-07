from __future__ import annotations

import asyncio
from typing import Any, TypeVar

from langchain_core.embeddings import Embeddings

from app.llm_client import OllamaClient

T = TypeVar("T")


class OllamaLangChainEmbeddings(Embeddings):
    """
    LangChain Embeddings adapter backed by the existing OllamaClient.

    This lets the service use LangChain's embedding interface while preserving
    the current Ollama batch embedding behavior.
    """

    def __init__(self, ollama: OllamaClient) -> None:
        self._ollama = ollama

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._run_sync(self.aembed_documents(texts))

    def embed_query(self, text: str) -> list[float]:
        return self._run_sync(self.aembed_query(text))

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._ollama.embed_texts(texts)

    async def aembed_query(self, text: str) -> list[float]:
        vectors = await self._ollama.embed_texts([text])
        if not vectors:
            raise RuntimeError("Embedding response is empty.")
        return vectors[0]

    @staticmethod
    def _run_sync(coro: Any) -> T:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(coro)

        raise RuntimeError("Synchronous embed_* cannot be called inside a running event loop.")

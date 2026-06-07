from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx


class OllamaClient:
    def __init__(
        self,
        *,
        embedding_base_url: str,
        llm_base_url: str,
        llm_api_key: str | None,
        llm_model: str,
        embedding_model: str,
        timeout_seconds: int = 180,
    ) -> None:
        self.embedding_base_url = embedding_base_url.rstrip("/")
        self.llm_base_url = llm_base_url.rstrip("/")
        self.llm_api_key = (llm_api_key or "").strip()
        self.llm_model = llm_model
        self.embedding_model = embedding_model
        self.timeout = httpx.Timeout(timeout_seconds)

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        # Prefer batch endpoint when available.
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                batch_resp = await client.post(
                    f"{self.embedding_base_url}/api/embed",
                    json={"model": self.embedding_model, "input": texts},
                )
                batch_resp.raise_for_status()
                payload = batch_resp.json()
                embeddings = payload.get("embeddings")
                if isinstance(embeddings, list) and embeddings:
                    return embeddings
            except httpx.HTTPError:
                # Fall back to single embedding endpoint for compatibility.
                pass

        embeddings: list[list[float]] = []
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for text in texts:
                resp = await client.post(
                    f"{self.embedding_base_url}/api/embeddings",
                    json={"model": self.embedding_model, "prompt": text},
                )
                resp.raise_for_status()
                payload = resp.json()
                embedding = payload.get("embedding")
                if not embedding:
                    raise RuntimeError("Embedding response missing embedding vector.")
                embeddings.append(embedding)
        return embeddings

    async def chat(self, messages: list[dict[str, str]]) -> str:
        parts: list[str] = []
        async for delta in self.stream_chat(messages):
            parts.append(delta)
        return "".join(parts).strip()

    async def stream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        if not self.llm_api_key:
            raise RuntimeError("RAGPROJECT_API_KEY is required for LLM chat requests.")

        payload = {
            "model": self.llm_model,
            "messages": messages,
            "stream": True,
            "temperature": 0.2,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.llm_api_key}",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                f"{self.llm_base_url}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("data:"):
                        line = line[5:].strip()
                    if not line:
                        continue
                    if line == "[DONE]":
                        break

                    packet = json.loads(line)
                    error = packet.get("error")
                    if error:
                        raise RuntimeError(self._extract_error(error))

                    choices = packet.get("choices")
                    if not isinstance(choices, list) or not choices:
                        continue

                    choice = choices[0] or {}
                    delta = choice.get("delta") or {}
                    content = delta.get("content")
                    if isinstance(content, str) and content:
                        yield content

                    if choice.get("finish_reason") is not None:
                        break

    @staticmethod
    def _extract_error(error: Any) -> str:
        if isinstance(error, str):
            return error
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message:
                return message
            return json.dumps(error, ensure_ascii=False)
        return str(error)

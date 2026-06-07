from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Travel Planner RAG API", alias="APP_NAME")
    app_env: str = Field(default="dev", alias="APP_ENV")
    api_key: str | None = Field(default=None, alias="API_KEY")

    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    ollama_base_url: str = Field(default="http://127.0.0.1:11434", alias="OLLAMA_BASE_URL")
    llm_base_url: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        alias="LLM_BASE_URL",
    )
    llm_api_key: str | None = Field(default=None, alias="RAGPROJECT_API_KEY")
    llm_model: str = Field(default="deepseek-v4-flash", alias="LLM_MODEL")
    embedding_model: str = Field(default="nomic-embed-text:latest", alias="EMBEDDING_MODEL")
    reranker_model: str = Field(
        default="cross-encoder/ms-marco-MiniLM-L-6-v2", alias="RERANKER_MODEL"
    )
    enable_reranker: bool = Field(default=True, alias="ENABLE_RERANKER")

    data_dir: Path = Field(default=Path("./data"), alias="DATA_DIR")
    chroma_dir: Path = Field(default=Path("./data/chroma"), alias="CHROMA_DIR")
    sqlite_path: Path = Field(default=Path("./data/rag.db"), alias="SQLITE_PATH")
    uploads_dir: Path = Field(default=Path("./data/uploads"), alias="UPLOADS_DIR")

    chunk_size: int = Field(default=768, alias="CHUNK_SIZE")
    chunk_overlap: int = Field(default=80, alias="CHUNK_OVERLAP")
    min_chunk_tokens: int = Field(default=120, alias="MIN_CHUNK_TOKENS")

    retrieve_top_k: int = Field(default=10, alias="RETRIEVE_TOP_K")
    rerank_top_k: int = Field(default=3, alias="RERANK_TOP_K")
    rrf_k: int = Field(default=60, alias="RRF_K")
    max_context_chunks: int = Field(default=3, alias="MAX_CONTEXT_CHUNKS")
    max_history_messages: int = Field(default=12, alias="MAX_HISTORY_MESSAGES")
    max_upload_size_mb: int = Field(default=10, alias="MAX_UPLOAD_SIZE_MB")
    request_timeout_seconds: int = Field(default=180, alias="REQUEST_TIMEOUT_SECONDS")

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        alias="CORS_ORIGINS",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.chroma_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    return settings

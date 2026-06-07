from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class ChatHistoryMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=6000)


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=6000)
    history: list[ChatHistoryMessage] = Field(default_factory=list)
    top_k: int | None = Field(default=None, ge=1, le=50)
    rerank_top_k: int | None = Field(default=None, ge=1, le=20)
    return_sources: bool = True

    @field_validator("query")
    @classmethod
    def normalize_query(cls, value: str) -> str:
        return value.strip()


class SourceChunk(BaseModel):
    id: str
    document_id: str
    title: str
    snippet: str
    score: float | None = None


class ChatResponse(BaseModel):
    answer: str
    model: str
    retrieved_count: int
    sources: list[SourceChunk]


class DocumentSummary(BaseModel):
    id: str
    title: str
    source_filename: str | None = None
    tags: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str
    chunk_count: int


class DocumentDetail(DocumentSummary):
    content_preview: str


class DocumentUpdateRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: list[str] | None = None


class UploadResponse(BaseModel):
    document: DocumentSummary


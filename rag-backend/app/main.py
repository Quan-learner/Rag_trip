from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import Settings, get_settings
from app.models import (
    ChatRequest,
    ChatResponse,
    DocumentDetail,
    DocumentSummary,
    DocumentUpdateRequest,
    UploadResponse,
)
from app.rag_service import RAGService
from app.security import verify_api_key


@lru_cache(maxsize=1)
def get_rag_service() -> RAGService:
    settings = get_settings()
    return RAGService(settings)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/upload", response_model=UploadResponse, dependencies=[Depends(verify_api_key)])
    async def upload_document(
        file: Annotated[UploadFile, File(...)],
        title: Annotated[str | None, Form()] = None,
        tags: Annotated[str | None, Form()] = None,
        service: RAGService = Depends(get_rag_service),
        cfg: Settings = Depends(get_settings),
    ) -> UploadResponse:
        blob = await file.read()
        size_limit = cfg.max_upload_size_mb * 1024 * 1024
        if len(blob) > size_limit:
            raise HTTPException(
                status_code=400,
                detail=f"File is too large. Max size is {cfg.max_upload_size_mb} MB.",
            )
        tag_items = [item.strip() for item in (tags or "").split(",") if item.strip()]
        summary = await service.ingest_upload(
            filename=file.filename or "upload.txt",
            data=blob,
            title=title,
            tags=tag_items,
        )
        return UploadResponse(document=summary)

    @app.get("/documents", response_model=list[DocumentSummary])
    async def list_documents(service: RAGService = Depends(get_rag_service)) -> list[DocumentSummary]:
        return service.list_documents()

    @app.get("/documents/{document_id}", response_model=DocumentDetail)
    async def get_document(
        document_id: str, service: RAGService = Depends(get_rag_service)
    ) -> DocumentDetail:
        return service.get_document(document_id)

    @app.put("/documents/{document_id}", response_model=DocumentSummary, dependencies=[Depends(verify_api_key)])
    async def update_document(
        document_id: str,
        payload: DocumentUpdateRequest,
        service: RAGService = Depends(get_rag_service),
    ) -> DocumentSummary:
        return await service.update_document(
            document_id=document_id,
            title=payload.title,
            content=payload.content,
            tags=payload.tags,
        )

    @app.delete("/documents/{document_id}", dependencies=[Depends(verify_api_key)])
    async def delete_document(
        document_id: str, service: RAGService = Depends(get_rag_service)
    ) -> dict[str, str]:
        service.delete_document(document_id)
        return {"status": "deleted"}

    @app.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_api_key)])
    async def chat(payload: ChatRequest, service: RAGService = Depends(get_rag_service)) -> ChatResponse:
        return await service.chat(payload)

    @app.post("/chat/stream", dependencies=[Depends(verify_api_key)])
    async def chat_stream(
        payload: ChatRequest,
        service: RAGService = Depends(get_rag_service),
    ) -> StreamingResponse:
        async def generate() -> AsyncIterator[str]:
            async for event in service.stream_chat(payload):
                yield event

        return StreamingResponse(generate(), media_type="application/x-ndjson")

    return app


app = create_app()


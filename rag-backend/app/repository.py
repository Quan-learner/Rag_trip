from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.chunker import Chunk
from app.utils import utc_now_iso


@dataclass(slots=True)
class DocumentRecord:
    id: str
    title: str
    source_filename: str | None
    tags: list[str]
    created_at: str
    updated_at: str
    content: str
    chunk_count: int
    checksum: str


@dataclass(slots=True)
class ChunkRecord:
    chunk_id: str
    document_id: str
    chunk_index: int
    title: str
    text: str
    token_count: int


class DocumentRepository:
    def __init__(self, sqlite_path: Path) -> None:
        self.sqlite_path = sqlite_path
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.sqlite_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    source_filename TEXT,
                    tags TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    content TEXT NOT NULL,
                    checksum TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    text TEXT NOT NULL,
                    token_count INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
                CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON chunks(chunk_index);
                CREATE INDEX IF NOT EXISTS idx_documents_checksum ON documents(checksum);
                """
            )
            conn.commit()

    @staticmethod
    def _row_to_document(row: sqlite3.Row, chunk_count: int = 0) -> DocumentRecord:
        return DocumentRecord(
            id=row["id"],
            title=row["title"],
            source_filename=row["source_filename"],
            tags=json.loads(row["tags"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            content=row["content"],
            checksum=row["checksum"],
            chunk_count=chunk_count,
        )

    def upsert_document(
        self,
        *,
        document_id: str,
        title: str,
        source_filename: str | None,
        tags: list[str],
        content: str,
        checksum: str,
    ) -> None:
        now = utc_now_iso()
        tags_json = json.dumps(tags, ensure_ascii=False)
        with self._lock, self._connect() as conn:
            existing = conn.execute("SELECT id, created_at FROM documents WHERE id = ?", (document_id,)).fetchone()
            created_at = existing["created_at"] if existing else now
            conn.execute(
                """
                INSERT INTO documents (id, title, source_filename, tags, created_at, updated_at, content, checksum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    source_filename = excluded.source_filename,
                    tags = excluded.tags,
                    updated_at = excluded.updated_at,
                    content = excluded.content,
                    checksum = excluded.checksum
                """,
                (document_id, title, source_filename, tags_json, created_at, now, content, checksum),
            )
            conn.commit()

    def update_document_metadata(
        self,
        *,
        document_id: str,
        title: str | None = None,
        tags: list[str] | None = None,
    ) -> None:
        updates: list[str] = ["updated_at = ?"]
        values: list[Any] = [utc_now_iso()]

        if title is not None:
            updates.append("title = ?")
            values.append(title)
        if tags is not None:
            updates.append("tags = ?")
            values.append(json.dumps(tags, ensure_ascii=False))

        values.append(document_id)
        with self._lock, self._connect() as conn:
            conn.execute(f"UPDATE documents SET {', '.join(updates)} WHERE id = ?", tuple(values))
            conn.commit()

    def replace_chunks(self, document_id: str, chunks: list[Chunk]) -> None:
        now = utc_now_iso()
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
            conn.executemany(
                """
                INSERT INTO chunks (id, document_id, chunk_index, title, text, token_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        chunk.chunk_id,
                        chunk.document_id,
                        chunk.chunk_index,
                        chunk.title,
                        chunk.text,
                        chunk.token_count,
                        now,
                    )
                    for chunk in chunks
                ],
            )
            conn.commit()

    def delete_document(self, document_id: str) -> None:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM documents WHERE id = ?", (document_id,))
            conn.commit()

    def get_document(self, document_id: str) -> DocumentRecord | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
            if not row:
                return None
            chunk_count = conn.execute(
                "SELECT COUNT(*) AS count FROM chunks WHERE document_id = ?",
                (document_id,),
            ).fetchone()["count"]
            return self._row_to_document(row, chunk_count)

    def list_documents(self) -> list[DocumentRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT d.*, COUNT(c.id) AS chunk_count
                FROM documents d
                LEFT JOIN chunks c ON c.document_id = d.id
                GROUP BY d.id
                ORDER BY d.updated_at DESC
                """
            ).fetchall()
            return [self._row_to_document(row, row["chunk_count"]) for row in rows]

    def list_chunks(self, document_id: str | None = None) -> list[ChunkRecord]:
        sql = "SELECT id, document_id, chunk_index, title, text, token_count FROM chunks"
        params: tuple[Any, ...] = ()
        if document_id:
            sql += " WHERE document_id = ?"
            params = (document_id,)
        sql += " ORDER BY chunk_index ASC"

        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
            return [
                ChunkRecord(
                    chunk_id=row["id"],
                    document_id=row["document_id"],
                    chunk_index=row["chunk_index"],
                    title=row["title"],
                    text=row["text"],
                    token_count=row["token_count"],
                )
                for row in rows
            ]


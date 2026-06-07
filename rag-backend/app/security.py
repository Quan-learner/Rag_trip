from __future__ import annotations

import re
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings


PROMPT_INJECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"ignore\s+all\s+previous\s+instructions",
        r"reveal\s+system\s+prompt",
        r"act\s+as\s+system",
        r"<\s*script",
        r"drop\s+table",
        r"rm\s+-rf",
    ]
]

SENSITIVE_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"(?i)api[_-]?key\s*[:=]\s*[A-Za-z0-9_\-]{8,}"),
]


def verify_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
    settings: Settings = Depends(get_settings),
) -> None:
    if settings.api_key and x_api_key != settings.api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key.")


class SafetyGuard:
    def __init__(self, max_chars: int = 6000) -> None:
        self.max_chars = max_chars

    def validate_user_query(self, query: str) -> str:
        cleaned = query.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Query cannot be empty.")
        if len(cleaned) > self.max_chars:
            raise HTTPException(status_code=400, detail="Query is too long.")

        for pattern in PROMPT_INJECTION_PATTERNS:
            if pattern.search(cleaned):
                raise HTTPException(
                    status_code=400,
                    detail="Query contains unsafe instructions. Please rephrase.",
                )
        return cleaned

    def redact_sensitive(self, text: str) -> str:
        sanitized = text
        for pattern in SENSITIVE_PATTERNS:
            sanitized = pattern.sub("[REDACTED]", sanitized)
        return sanitized


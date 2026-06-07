from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime
from typing import Iterable

TOKEN_PATTERN = re.compile(r"[\u4e00-\u9fff]|[A-Za-z0-9_]+|[^\s]")
ASCII_WORD_PATTERN = re.compile(r"^[A-Za-z0-9_]+$")


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def tokenize_text(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text)


def detokenize_tokens(tokens: Iterable[str]) -> str:
    # Preserve readability for ASCII words while keeping CJK contiguous.
    pieces: list[str] = []
    previous_ascii_word = False
    for token in tokens:
        is_ascii_word = bool(ASCII_WORD_PATTERN.fullmatch(token))
        if pieces and is_ascii_word and previous_ascii_word:
            pieces.append(" ")
        pieces.append(token)
        previous_ascii_word = is_ascii_word
    return "".join(pieces).strip()


def clamp(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(value, max_value))

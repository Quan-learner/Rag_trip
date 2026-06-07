from __future__ import annotations

import json
from pathlib import Path
from tempfile import NamedTemporaryFile


def _load_with_llama_index(path: Path) -> str:
    try:
        from llama_index.core import SimpleDirectoryReader
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise ValueError(
            "LlamaIndex file readers are required. Install "
            "'llama-index-core' and 'llama-index-readers-file'."
        ) from exc

    documents = SimpleDirectoryReader(
        input_files=[str(path)],
        filename_as_id=False,
        raise_on_error=True,
    ).load_data()
    merged = "\n\n".join(doc.text.strip() for doc in documents if getattr(doc, "text", "").strip()).strip()
    return merged


class DocumentLoader:
    SUPPORTED_TEXT_EXTENSIONS = {".txt", ".md", ".markdown", ".csv", ".json"}
    SUPPORTED_BINARY_EXTENSIONS = {".pdf", ".docx"}

    def load_from_bytes(self, filename: str, data: bytes) -> str:
        extension = Path(filename).suffix.lower()

        if extension and extension not in self.SUPPORTED_TEXT_EXTENSIONS | self.SUPPORTED_BINARY_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {extension}")

        with NamedTemporaryFile(delete=False, suffix=extension or ".txt") as tmp_file:
            tmp_file.write(data)
            tmp_path = Path(tmp_file.name)

        try:
            content = _load_with_llama_index(tmp_path).strip()
            if content:
                return content
            if extension in self.SUPPORTED_TEXT_EXTENSIONS or not extension:
                return self._decode_text(data, extension).strip()
            raise ValueError("Document extraction returned empty content.")
        except Exception:  # noqa: BLE001
            if extension in self.SUPPORTED_TEXT_EXTENSIONS or not extension:
                decoded = self._decode_text(data, extension).strip()
                if decoded:
                    return decoded
            raise
        finally:
            tmp_path.unlink(missing_ok=True)

    def _decode_text(self, data: bytes, extension: str) -> str:
        for encoding in ("utf-8", "utf-8-sig", "gb18030", "latin-1"):
            try:
                decoded = data.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            decoded = data.decode("utf-8", errors="ignore")

        if extension == ".json":
            try:
                payload = json.loads(decoded)
                return json.dumps(payload, ensure_ascii=False, indent=2)
            except json.JSONDecodeError:
                return decoded
        return decoded

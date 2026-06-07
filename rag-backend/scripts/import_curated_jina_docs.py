from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path

import httpx


@dataclass(frozen=True)
class CuratedTravelDoc:
    slug: str
    title: str
    url: str
    tags: tuple[str, ...]


CURATED_DOCS: tuple[CuratedTravelDoc, ...] = (
    CuratedTravelDoc(
        slug="xian_4days",
        title="西安 4 天游记（精选）",
        url="https://www.mafengwo.cn/i/24827744.html?sys_ver=",
        tags=("travel", "jina", "curated", "xian"),
    ),
    CuratedTravelDoc(
        slug="budget_1500",
        title="1500 预算旅游攻略（精选）",
        url=(
            "https://www.xiaohongshu.com/explore/69e055bb0000000023014851"
            "?xsec_token=AB0sJeOvqVFlU5RGEs4FRGSm62J68tl6ndo2GshO3HaEA="
            "&xsec_source=pc_search&source=web_explore_feed"
        ),
        tags=("travel", "jina", "curated", "budget"),
    ),
    CuratedTravelDoc(
        slug="hangzhou_slow",
        title="杭州慢旅行路线（精选）",
        url=(
            "https://www.xiaohongshu.com/explore/69ba5c37000000001a027158"
            "?xsec_token=ABUXbA1aNBWlniv7XrWhfwIb_X7W_R7SnLSszU01rz1_k="
            "&xsec_source=pc_search&source=web_search_result_notes"
        ),
        tags=("travel", "jina", "curated", "hangzhou"),
    ),
)


def _jina_reader_url(source_url: str) -> str:
    return f"https://r.jina.ai/{source_url}"


def _require_api_key(api_key: str | None) -> str:
    if api_key:
        return api_key
    raise RuntimeError(
        "Missing API key. Please provide --api-key or set RAG_BACKEND_API_KEY."
    )


def _fetch_markdown(client: httpx.Client, source_url: str, timeout_seconds: int) -> str:
    response = client.get(
        _jina_reader_url(source_url),
        timeout=timeout_seconds,
        follow_redirects=True,
    )
    response.raise_for_status()
    content = response.text.strip()
    if not content:
        raise RuntimeError(f"Jina Reader returned empty content for URL: {source_url}")
    return content


def _delete_existing_docs(
    client: httpx.Client,
    backend_url: str,
    api_key: str,
    title: str,
) -> int:
    list_resp = client.get(f"{backend_url}/documents", timeout=20)
    list_resp.raise_for_status()
    docs = list_resp.json()

    deleted_count = 0
    for doc in docs:
        if doc.get("title") != title:
            continue
        doc_id = doc.get("id")
        if not doc_id:
            continue
        delete_resp = client.delete(
            f"{backend_url}/documents/{doc_id}",
            headers={"X-API-Key": api_key},
            timeout=20,
        )
        delete_resp.raise_for_status()
        deleted_count += 1
    return deleted_count


def _upload_markdown(
    client: httpx.Client,
    backend_url: str,
    api_key: str,
    doc: CuratedTravelDoc,
    markdown: str,
) -> dict:
    files = {
        "file": (f"{doc.slug}.md", markdown.encode("utf-8"), "text/markdown"),
    }
    data = {"title": doc.title, "tags": ",".join(doc.tags)}
    response = client.post(
        f"{backend_url}/upload",
        headers={"X-API-Key": api_key},
        data=data,
        files=files,
        timeout=120,
    )
    response.raise_for_status()
    return response.json()


def import_curated_docs(
    *,
    backend_url: str,
    api_key: str | None,
    save_dir: Path,
    timeout_seconds: int,
) -> int:
    normalized_backend = backend_url.rstrip("/")
    auth_key = _require_api_key(api_key)
    save_dir.mkdir(parents=True, exist_ok=True)

    imported = 0
    with httpx.Client() as client:
        for doc in CURATED_DOCS:
            print(f"\n[1/3+] Fetching via Jina: {doc.url}")
            try:
                markdown = _fetch_markdown(client, doc.url, timeout_seconds)
            except Exception as exc:  # noqa: BLE001
                print(f"  [ERROR] Failed to fetch {doc.slug}: {exc}")
                continue

            raw_path = save_dir / f"{doc.slug}.md"
            raw_path.write_text(markdown, encoding="utf-8")
            print(f"  [OK] Saved cleaned markdown: {raw_path}")

            try:
                deleted = _delete_existing_docs(
                    client=client,
                    backend_url=normalized_backend,
                    api_key=auth_key,
                    title=doc.title,
                )
                if deleted:
                    print(f"  [INFO] Removed {deleted} existing doc(s) with same title.")

                upload_payload = _upload_markdown(
                    client=client,
                    backend_url=normalized_backend,
                    api_key=auth_key,
                    doc=doc,
                    markdown=markdown,
                )
                summary = upload_payload.get("document", {})
                print(
                    "  [OK] Uploaded to RAG:"
                    f" id={summary.get('id')} title={summary.get('title')}"
                    f" chunks={summary.get('chunk_count')}"
                )
                imported += 1
            except Exception as exc:  # noqa: BLE001
                print(f"  [ERROR] Failed to upload {doc.slug} into RAG: {exc}")

    print(f"\nDone. Successfully imported {imported}/{len(CURATED_DOCS)} curated docs.")
    return 0 if imported == len(CURATED_DOCS) else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch curated travel pages via Jina Reader and import into RAG backend."
    )
    parser.add_argument(
        "--backend-url",
        default=os.getenv("RAG_BACKEND_BASE_URL", "http://127.0.0.1:8000"),
        help="RAG backend base URL (default: http://127.0.0.1:8000).",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("RAG_BACKEND_API_KEY"),
        help="API key for protected RAG endpoints.",
    )
    parser.add_argument(
        "--save-dir",
        default=str(Path("data") / "curated_jina_docs"),
        help="Directory to store cleaned markdown snapshots.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=45,
        help="Timeout for each Jina fetch request.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return import_curated_docs(
        backend_url=args.backend_url,
        api_key=args.api_key,
        save_dir=Path(args.save_dir),
        timeout_seconds=args.timeout_seconds,
    )


if __name__ == "__main__":
    raise SystemExit(main())

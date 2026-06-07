# Travel Planner RAG Backend (FastAPI)

基于本地模型的旅游计划顾问后端，包含完整 RAG 流程：

- LLM: `deepseek-r1:1.5b` (Ollama)
- Embedding: `nomic-embed-text:latest` (Ollama)
- Ingestion: `LlamaIndex`（文档解析 + SentenceSplitter 分块）
- Embedding Adapter: `LangChain Embeddings`（统一向量化接口）
- 向量库: `ChromaDB`（本地持久化）
- 检索链路: 向量检索 + BM25 -> RRF 融合 -> Cross-Encoder 重排（Top10 -> Top3）

## 1. 安装依赖

```bash
cd rag-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 2. 启动 Ollama 模型

```bash
ollama pull deepseek-r1:1.5b
ollama pull nomic-embed-text:latest
```

可选：Cross-Encoder 首次运行会自动下载 `cross-encoder/ms-marco-MiniLM-L-6-v2`。

## 3. 配置环境变量

```bash
copy .env.example .env
```

关键配置：

- `LLM_BASE_URL`：LLM 聊天接口地址（当前默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`）
- `LLM_MODEL`：聊天模型（当前默认 `deepseek-v4-flash`）
- `RAGPROJECT_API_KEY`：DashScope/OpenAI 兼容接口的 Bearer Token（建议通过系统环境变量注入）
- `OLLAMA_BASE_URL`：默认 `http://127.0.0.1:11434`
- `API_KEY`：设置后，`/chat`、`/chat/stream`、写操作接口要求 `X-API-Key`
- `CHUNK_SIZE`：默认 `768`
- `CHUNK_OVERLAP`：默认 `80`（满足 50-100）

## 4. 运行服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 5. API 概览

- `GET /health`：健康检查
- `POST /upload`：上传文档并入库（multipart）
- `GET /documents`：文档列表
- `GET /documents/{document_id}`：文档详情
- `PUT /documents/{document_id}`：更新文档（支持增量重建索引）
- `DELETE /documents/{document_id}`：删除文档
- `POST /chat`：非流式问答
- `POST /chat/stream`：流式问答（`application/x-ndjson`）

## 6. 流式事件格式 (`/chat/stream`)

每行一个 JSON：

- `{"type":"source","source":{...}}`
- `{"type":"token","delta":"..."}` 
- `{"type":"done","answer":"...","sources":[...]}` 
- `{"type":"error","message":"..."}` 

## 7. Jina Reader 精选旅游网页导入

已内置脚本：`scripts/import_curated_jina_docs.py`

作用：
- 通过 `https://r.jina.ai/<目标URL>` 抓取并清洗网页 Markdown
- 自动保存到 `data/curated_jina_docs/*.md`
- 自动导入当前 RAG（会按同标题先删旧再导入，避免重复）

执行示例：

```bash
cd rag-backend
.venv\Scripts\python.exe scripts\import_curated_jina_docs.py --api-key <你的API_KEY>
```

可选参数：
- `--backend-url`（默认 `http://127.0.0.1:8000`）
- `--save-dir`（默认 `data/curated_jina_docs`）
- `--timeout-seconds`（默认 `45`）

## 8. 目录说明

- `app/main.py`：FastAPI 路由入口
- `app/rag_service.py`：RAG 主流程
- `app/document_loader.py`：LlamaIndex 文档读取与解析
- `app/chunker.py`：基于 LlamaIndex SentenceSplitter 的分块
- `app/langchain_embeddings.py`：LangChain Embeddings 适配层（Ollama）
- `app/retriever.py`：混合检索、RRF、重排
- `app/repository.py`：SQLite 元数据与 chunk 管理
- `app/vector_store.py`：ChromaDB 封装
- `app/security.py`：API Key 校验 + 注入/敏感信息基础防护
- `scripts/import_curated_jina_docs.py`：Jina Reader 精选网页抓取并导入 RAG

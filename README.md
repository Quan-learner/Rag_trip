# 旅游计划顾问 RAG 系统

本项目实现了 `REQUIREMENTS.md` 的前后端分离方案：

- 前端：`assistant-ui`（Next.js 15+ 风格，TypeScript，Tailwind）
- 后端：`rag-backend`（FastAPI + ChromaDB + 本地 Ollama 模型）
- 检索：向量检索 + BM25 + RRF + Cross-Encoder 重排

## 项目结构

```text
E:\Agent_project
├─ assistant-ui      # Next.js + assistant-ui 前端
├─ rag-backend       # FastAPI RAG 后端
└─ REQUIREMENTS.md
```

## 一键启动顺序（推荐）

1. 启动 Ollama，并拉取模型

```bash
ollama pull deepseek-r1:1.5b
ollama pull nomic-embed-text:latest
```

2. 启动后端

```bash
cd rag-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3. 启动前端

```bash
cd assistant-ui
copy .env.example .env.local
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 接口文档（后端）

### 1) `POST /upload`

- 功能：上传文档并建立索引
- 请求：`multipart/form-data`
  - `file`: 文件（txt/md/pdf/json/csv）
  - `title`: 可选
  - `tags`: 可选（逗号分隔）

### 2) `GET /documents`

- 功能：获取文档列表

### 3) `GET /documents/{document_id}`

- 功能：获取文档详情（含预览）

### 4) `PUT /documents/{document_id}`

- 功能：更新文档标题/标签/内容（内容更新会增量重建索引）
- 请求 JSON：

```json
{
  "title": "东京 5 天游攻略",
  "content": "新的文档正文...",
  "tags": ["东京", "亲子"]
}
```

### 5) `DELETE /documents/{document_id}`

- 功能：删除文档与向量索引

### 6) `POST /chat`

- 功能：非流式问答
- 请求 JSON：

```json
{
  "query": "帮我规划 5 天京都自由行",
  "history": [
    { "role": "user", "content": "我预算 8000 元" },
    { "role": "assistant", "content": "好的，我先确认..." }
  ],
  "top_k": 10,
  "rerank_top_k": 3,
  "return_sources": true
}
```

### 7) `POST /chat/stream`

- 功能：流式问答，返回 `application/x-ndjson`
- 事件类型：
  - `source`：来源片段
  - `token`：增量文本
  - `done`：结束
  - `error`：异常

## 前后端联调说明

- 前端 `assistant-ui/app/api/chat/route.ts` 已作为适配层：
  - 接收 assistant-ui 的消息格式
  - 调用后端 `/chat/stream`
  - 将后端事件转回 assistant-ui 可消费的 UI message stream

因此前端不直接依赖 OpenAI/Claude/GLM SDK，后续模型切换主要在后端完成。


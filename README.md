# 旅游计划顾问 RAG 系统 (Travel Planner RAG System)

基于 Next.js 与 FastAPI 构建的全栈 RAG 旅游规划系统，融合向量检索与关键词检索，为您提供智能的出行规划体验。

## 目录

- [截图 / 演示](#截图--演示)
- [核心特性](#核心特性)
- [项目结构](#项目结构)
- [安装 (Installation)](#安装-installation)
- [使用方法 (Usage)](#使用方法-usage)
- [API / 功能说明](#api--功能说明)
- [贡献指南 (Contributing)](#贡献指南-contributing)
- [许可证 (License)](#许可证-license)

## 截图 / 演示

> *在此处替换为您项目的实际运行截图或 GIF 动图。*

## 核心特性

- **混合检索**：结合向量检索 (ChromaDB) 与 BM25 关键词检索。
- **智能重排**：采用 RRF 融合算法与 Cross-Encoder 进行结果重排，提升检索精准度。
- **本地化部署**：支持接入本地 Ollama 大模型与嵌入模型，保护数据隐私。
- **现代化前端**：使用 Next.js 15+ 与 Tailwind CSS 打造的沉浸式对话界面。

## 项目结构

```text
E:\Agent_project
├─ assistant-ui      # 前端：Next.js + assistant-ui (TypeScript, Tailwind)
├─ rag-backend       # 后端：FastAPI RAG 后端 (ChromaDB, Ollama)
└─ 国内5A景区文档      # 数据：各类景区旅游攻略 Markdown 文件
```

## 安装 (Installation)

### 1. 环境准备

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com/) (若需使用本地大模型)

### 2. 准备本地模型

启动 Ollama，并拉取所需模型：

```bash
ollama pull deepseek-r1:1.5b
ollama pull nomic-embed-text:latest
```

### 3. 配置与启动后端 (rag-backend)

```bash
cd rag-backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# 启动后端服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 配置与启动前端 (assistant-ui)

```bash
cd assistant-ui
cp .env.example .env.local
npm install
# 启动前端服务
npm run dev
```

## 使用方法 (Usage)

1. 确保后端的 FastAPI 运行在 `http://localhost:8000`，前端运行在 `http://localhost:3000`。
2. 打开浏览器访问 `http://localhost:3000`。
3. 您可以在系统中上传旅游攻略文档（如 `.md`, `.txt`, `.pdf`）。
4. 在对话界面输入您的旅行需求（例如：“帮我规划 5 天京都自由行，预算 8000 元”），系统将结合知识库给出规划。

## API / 功能说明

后端主要提供以下功能端点（详见 `/docs` 接口文档）：

- **文档管理**：
  - `POST /upload`：上传文档并构建索引。
  - `GET /documents` & `GET /documents/{id}`：获取文档列表及详情。
  - `PUT /documents/{id}`：更新文档信息并重建索引。
  - `DELETE /documents/{id}`：删除文档及其向量数据。
- **对话接口**：
  - `POST /chat/stream`：接收前端请求，流式返回检索片段及 LLM 回复。

## 贡献指南 (Contributing)

我们非常欢迎对本项目做出贡献！如果您想改进本项目：

1. Fork 本仓库。
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)。
3. 提交您的修改 (`git commit -m 'Add some AmazingFeature'`)。
4. 推送至分支 (`git push origin feature/AmazingFeature`)。
5. 开启一个 Pull Request。

## 许可证 (License)

本项目基于 [MIT License](LICENSE) 开源。欢迎自由使用与分享。

# 旅游计划顾问 RAG 系统 (Travel Planner RAG System)

欢迎使用 **旅游计划顾问 RAG 系统** —— 一个专为现代旅行者打造的智能出行规划平台。本项目基于 **Next.js** 与 **FastAPI** 构建全栈架构，深度融合了大语言模型 (LLM) 与检索增强生成 (RAG) 技术。无论是周边短途游还是跨国长线游，系统都能通过高效的混合检索与本地化大模型，从海量旅游攻略中精准提取信息，为您提供个性化、智能化、沉浸式的出行规划体验。

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

## 核心特性与技术栈

本系统在架构设计上追求高性能与高可扩展性，大量采用业界前沿的开源技术框架：

- 🚀 **现代化前端体验 (Frontend)**
  - 采用 **Next.js 15+** 作为前端核心框架，提供极速的 SSR/SSG 页面渲染与流畅的路由体验。
  - 结合 **Tailwind CSS** 实现灵活响应式的现代化界面设计。
  - 集成 **assistant-ui** 组件库，打造媲美 ChatGPT 的丝滑对话交互体验。

- 🧠 **强劲的 RAG 后端引擎 (Backend)**
  - 使用 **FastAPI** 构建高并发、易扩展的异步后端 API 服务。
  - **文档解析与智能分块 (Ingestion & Chunking)**：基于 **LlamaIndex** 构建文档加载与解析机制，底层引入 **SentenceSplitter** 算法按句意语义切块（默认 `CHUNK_SIZE=768`，`CHUNK_OVERLAP=80`，智能过滤低于 120 字符的无效噪点分块），保持语义段落切分边界的上下文完整性。
  - **混合检索系统**：深度结合 **ChromaDB** 向量数据库与 **BM25** 关键词算法，兼顾深层语义理解与专有名词的字面精准匹配。
  - **智能重排与精细融合**：应用 **RRF (Reciprocal Rank Fusion)** 倒数排名融合算法，并结合 **Cross-Encoder** 交叉编码器模型进行二次打分重排（从 Top 10 中筛选出最高质量的 Top 3 分块），极致提升文档片段的召回精准度。
  - **智能会话记忆管理 (Memory Management)**：
    - 采用轻量化 **SQLite** 进行文档元数据、分块索引和会话信息的本地持久化。
    - 设计了**滑动窗口上下文记忆管理方案**（通过环境变量 `MAX_HISTORY_MESSAGES` 进行多端控制，默认保留最近 12 轮对话），在对话请求时动态截取与拼接上下文，既避免了超长 Token 导致的注意力分散，又完美保障了多轮会话的连贯语境。

- 🔒 **纯本地化大模型支持 (Local LLM)**
  - 深度集成 **Ollama** 运行环境，支持无缝接入诸如 `deepseek-r1` 等最新开源大语言模型，并内建优化的 Prompt 机制。
  - 采用本地化文本嵌入模型（如 `nomic-embed-text`），保障用户的语料和规划数据完全离线处理，杜绝隐私泄漏风险。

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

---

## 💡 开发心得与展望 (Developer Reflections)

在这个项目的开发过程中，我深刻体会到了大模型与 RAG 技术结合在垂直领域（如旅游规划）的巨大潜力：

1. **混合检索的必要性**：起初系统在面对专有名词（如特定景点、地名）时，单一的向量检索容易出现“语义相关但实体不匹配”的问题。在引入 BM25 关键词检索，并结合 RRF 算法与 Cross-Encoder 进行重排后，召回结果的精准度有了质的飞跃。实践证明，**向量 + 关键词** 的双路召回是当前 RAG 落地极其有效的设计。
2. **本地化部署的价值**：通过全面接入 Ollama 本地模型（如 `deepseek-r1`）与本地文本嵌入模型，我们彻底摆脱了对云端 API 的依赖与高昂的 Token 成本。更重要的是，这从根本上保障了用户出游偏好与隐私数据的安全性，在数据敏感型应用中极具竞争力。
3. **前端交互体验不可妥协**：Next.js 与 assistant-ui 的结合，让系统具备了极佳的流式响应体验。这种类 ChatGPT 的丝滑交互在 LLM 推理等待期间极大地提升了用户的沉浸感与宽容度，证明了在 AI 应用中，优秀的 UI/UX 同样是核心生产力。
4. **未来的演进方向**：目前的 RAG 仍以静态文档知识库为主。未来的演进方向是引入更灵活的 Agent 机制，结合 Tool Calling 能力，让系统能够实时拉取天气、交通、酒店等动态数据，从“静态知识顾问”真正进化为“全能 AI 导游”。

技术的发展日新月异，希望本项目能在全栈 AI 应用的落地探索上为您带来一些启发与帮助！

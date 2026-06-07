# Trip Copilot Frontend (Next.js + assistant-ui)

旅游计划顾问前端，基于 Next.js + TypeScript + Tailwind + assistant-ui cloud 模板。

已实现：

- 暗黑模式优先 UI，支持明暗主题切换
- Markdown 渲染 + 代码块复制
- 流式输出（通过 `/api/chat` 适配 Python 后端）
- assistant-ui 对话线程与持久化能力（Assistant Cloud）

## 1. 环境变量

复制示例文件：

```bash
copy .env.example .env.local
```

关键项：

- `NEXT_PUBLIC_ASSISTANT_BASE_URL`：Assistant Cloud 地址（可选但推荐）
- `NEXT_PUBLIC_CHAT_API_ENDPOINT`：默认 `/api/chat`
- `RAG_BACKEND_BASE_URL`：Python 后端地址，默认 `http://127.0.0.1:8000`
- `RAG_BACKEND_API_KEY`：后端 API Key（如果后端启用了 `API_KEY`）

## 2. 安装与启动

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## 3. 构建检查

```bash
npm run lint
npm run build
```

## 4. 关键文件

- `app/assistant.tsx`：聊天运行时配置与头部布局
- `app/api/chat/route.ts`：前端到 Python RAG 后端的流式适配层
- `components/thread.tsx`：消息线程 UI（Markdown/复制/Streaming）
- `components/theme-toggle.tsx`：明暗主题切换
- `components/threadlist-sidebar.tsx`：侧边栏品牌与线程入口

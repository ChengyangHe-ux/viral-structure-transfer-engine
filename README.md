# 爆款结构迁移引擎

比赛 MVP：从样例短视频中抽象 Hook、节奏、字幕、画面包装、音乐卡点、卖点推进和结尾转化结构，再迁移到新的主题或商品 Brief，生成可编辑的多版本方案脚本。

## 快速开始

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

默认地址：`http://localhost:3000`

## AI 配置

`.env` 使用 OpenAI-compatible 配置，可接 OpenAI、火山方舟或其他兼容服务：

```bash
AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY=""
AI_MODEL_TEXT="gpt-4.1-mini"
AI_MODEL_VISION="gpt-4.1-mini"
ASR_PROVIDER="manual"
```

未配置 `AI_API_KEY` 时，系统会自动使用本地演示策略，保证样例拆解、迁移方案和导出链路可跑通。

## 当前能力

- 上传样例视频或填写样例链接/观察文本。
- 自动生成样例结构拆解。
- 输入新主题或商品 Brief 后生成 3 个可比较方案。
- 导出 Markdown 或 JSON。
- 数据通过 Prisma + SQLite 存储。

# 爆款结构迁移引擎

比赛 MVP：从样例短视频中抽象 Hook、节奏、字幕、画面包装、音乐卡点、卖点推进和结尾转化结构，再迁移到新的主题或商品 Brief，生成可编辑的多版本方案脚本。

新版本在“迁移 Brief → 生成迁移方案”之间加入本地 RAG 剪辑技巧库：系统会用 Brief、用户素材和样例节拍检索 Hook、B-roll、字幕卡点、转场、证据卡和 CTA 等剪辑方法，再把命中技巧写入脚本、时间线与制作备注。

## 快速开始

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

默认地址：`http://localhost:3000`

## 提交前自检

```bash
npm run submission:check
```

## 离线案例生成

```bash
npm run cases:generate
```

## 一键生成演示视频（Remotion）

```bash
npm run video:render -- --input cases/generated/demo-学习平板.json --out renders/demo.mp4 --title "学习平板结构演示稿" --quality high
```

提示：首次渲染前先执行一次 `npm run media:install-binaries`（会安装/链接 Remotion compositor + ffmpeg/ffprobe）。

## 本地样例素材（可选）

- 把 `mp4/mov` 放到 `data/uploads/`（已在 `.gitignore` 中，不会被提交）。
- 打开页面后，可在“输入素材 → 本地已导入视频（data/uploads）”直接选择，无需重复上传。
- 如需“自动读取时长/分辨率/抽帧”，先执行一次：`npm run media:install-binaries`（会在 `.remotion-binaries/` 放置 compositor + ffmpeg/ffprobe）。

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

- 提供演示预设，适合现场快速跑通完整链路。
- 上传样例视频或填写样例链接/观察文本。
- 自动生成样例结构拆解。
- 生成前检索本地剪辑技巧库（RAG），让方案不只会写文案，也知道“怎么剪”。
- 输入新主题、商品 Brief 和用户素材后生成 3 个可比较方案。
- 识别素材槽位缺口，并给出结构重排、字幕补全、包装补全或素材复用策略。
- 生成可视化时间线草案，按秒展示 Hook、证据、收益、CTA 与素材状态。
- 展示样例节拍到新方案镜头的迁移映射，串起结构规则、素材槽位和补全动作。
- 自动给出质量评分、推荐主版本和优先修改建议。
- 支持自然语言编辑当前方案，并保存新的修订版本。
- 导出 Markdown 或 JSON。
- 数据通过 Prisma + SQLite 存储。

## 演示材料

- [比赛演示脚本](docs/DEMO_SCRIPT.md)
- [AI 架构、工具协议与安全边界](docs/ARCHITECTURE.md)
- [参赛提交清单](docs/SUBMISSION.md)
- [视频产物 Case](cases/ai-resume-demo-case.md)
- [离线可复现实验案例](cases/generated/README.md)

## 参赛亮点

- 不是简单生成文案，而是先拆解样例结构，再迁移创作方法。
- 能展示素材缺口如何被识别、映射和补全，贴合真实创作流程。
- 迁移映射图让评审能看到“样例结构 → 新内容镜头 → 素材补全”的中间推理链路。
- RAG 剪辑技巧命中面板让评审看到系统如何把可复用剪辑方法注入生成流程。
- 时间线草案把脚本变成可验证的生产计划，方便后续接 Remotion/FFmpeg 或人工剪辑。
- 输出包含多版本时间线、可替换素材、风险提示和质量诊断。
- 自然语言编辑让系统更接近真实创作平台，而不是一次性文案工具。
- 无 API Key 时也能跑通演示链路，配置云模型后可升级为真实多模态分析。

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

## 冲奖案例校验

```bash
npm run award:check
```

该命令会用离线案例跑“大奖目标看板”，要求所有演示案例达到 90+，防止提交前只看功能可用、没看参赛说服力。

## 一键生成演示视频（Remotion）

```bash
npm run video:render -- --input cases/generated/demo-学习平板.json --out renders/demo.mp4 --title "学习平板结构迁移成片预览" --quality high
```

渲染结果是 1080x1920 竖屏成片预览：每个 beat 都会变成全屏场景，包含大字幕、素材位、包装提示、素材缺口/补全标签和节奏进度。提示：首次渲染前先执行一次 `npm run media:install-binaries`（会安装/链接 Remotion compositor + ffmpeg/ffprobe）。

## 高质量有声成片（拿奖主版本）

```bash
npm run video:render -- --input cases/generated/demo-咖啡新品.json --out renders/coffee-launch-short-high.mp4 --composition CoffeeLaunchShort --quality high --title "咖啡新品高质量有声版"
```

`CoffeeLaunchShort` 是当前主推展示案例，比通用结构稿更像短视频广告：有冷萃杯、液体倒入、冰块、果香卡片、通勤场景、试饮反馈占位和限时 CTA。最新高质量本地验证结果：1080x1920、30fps、38 秒，视频码率约 2.03 Mbps，音频为 MP3 / 48kHz / stereo，`mean_volume` 约 -18.7 dB。

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
- 生成 9:16 竖屏分镜预览，把每段脚本拆成画面层、字幕层、包装层和素材状态。
- 一键渲染 1080x1920 竖屏视频预览，把脚本 beat 变成短视频式画面、字幕和素材缺口提示。
- 生成高质量有声 Remotion 成片：`RenderTimeline` 驱动动态字幕、素材槽位、节奏提示和可听见音频。
- 咖啡新品专用成片模板会把结构迁移变成更像商业短视频的视觉表达。
- 展示样例节拍到新方案镜头的迁移映射，串起结构规则、素材槽位和补全动作。
- 自动给出质量评分、推荐主版本和优先修改建议。
- 自动生成“大奖目标看板”，把冲奖目标拆成结构迁移、RAG 可解释、成片可执行、现场可控和上交证据 5 个评分项。
- 支持自然语言编辑当前方案，并保存新的修订版本。
- 导出 Markdown 或 JSON。
- 数据通过 Prisma + SQLite 存储。

## 演示材料

- [比赛演示脚本](docs/DEMO_SCRIPT.md)
- [AI 架构、工具协议与安全边界](docs/ARCHITECTURE.md)
- [参赛提交清单](docs/SUBMISSION.md)
- [可编辑答辩 PPT](docs/presentation/爆款结构迁移引擎答辩稿.pptx)
- [AIGC 视觉素材提示词](docs/IMAGEGEN_PROMPTS.md)
- [视频产物 Case](cases/ai-resume-demo-case.md)
- [离线可复现实验案例](cases/generated/README.md)

## 参赛亮点

- 不是简单生成文案，而是先拆解样例结构，再迁移创作方法。
- 能展示素材缺口如何被识别、映射和补全，贴合真实创作流程。
- 迁移映射图让评审能看到“样例结构 → 新内容镜头 → 素材补全”的中间推理链路。
- RAG 剪辑技巧命中面板让评审看到系统如何把可复用剪辑方法注入生成流程。
- 大奖目标看板把“能不能拿奖”拆成可验证证据与下一步补强动作，利于现场答辩。
- `npm run award:check` 把冲奖标准纳入提交前自动校验，确保演示案例持续保持 90+。
- 时间线草案把脚本变成可验证的生产计划，方便后续接 Remotion/FFmpeg 或人工剪辑。
- 竖屏分镜预览让评委不用读完整表格，也能看到成片画面组织方式。
- Remotion 成片预览把“结构可执行”变成可播放视频证据，评审能直接看到节奏、字幕、包装和补全策略。
- 高质量有声版本让评审能直接听到节奏 cue，避免视频只像静态方案页。
- 输出包含多版本时间线、可替换素材、风险提示和质量诊断。
- 自然语言编辑让系统更接近真实创作平台，而不是一次性文案工具。
- 无 API Key 时也能跑通演示链路，配置云模型后可升级为真实多模态分析。

# AI 架构、工具协议与安全边界

## 整体 AI 架构

系统按“样例理解 -> 结构抽取 -> 素材适配 -> 结果生成 -> 人机协同编辑”组织：

1. 样例理解：接收样例视频、链接或人工观察文本，结合 FFmpeg/ffprobe 元数据抽取基础信息。
2. 结构抽取：把样例拆成 Hook、节奏、字幕包装、画面包装、音乐卡点、卖点推进和 CTA 结构。
3. 素材适配：把新主题和用户素材映射到结构槽位，识别开头吸引、主体特写、使用过程、对比结果、背书证据、结尾 CTA 等缺口。
4. 结果生成：生成多版本短视频方案，包含脚本、分镜、时间线草案和包装建议。
5. 视频重组：把最佳版本转换成 `RenderTimeline`，由 Remotion 渲染动态字幕、素材槽位、节奏进度、音频床和 MP4。
6. 人机协同：支持自然语言编辑，例如“开头更抓人一些”“补充可信证据”，系统重写完整结构化方案。

## 工具协议

### LLM / 多模态模型

- 通过 OpenAI-compatible 接口接入云模型，使用 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL_TEXT`、`AI_MODEL_VISION` 配置。
- 系统要求模型输出符合 Zod Schema 的结构化 JSON，而不是自由文本。
- 未配置密钥时使用本地 fallback 策略，保证演示链路可运行。

### FFmpeg / ffprobe

- `ffprobe` 用于读取视频时长、分辨率、音频和帧率。
- `ffmpeg` 用于抽取预览帧。
- 预览帧只存储在本地 `data/frames`，不会提交到代码仓库。

### RenderTimeline / Remotion

- `RenderTimeline` 是模型和渲染器之间的协议层，字段包含 `scenes`、`captionTokens`、`visualLayers`、`audioCues`、`materialFit` 和 `completionPlan`。
- LLM 或本地 fallback 只能生成结构化 JSON，服务端用 Zod 校验后才交给 Remotion。
- Remotion 只渲染项目白名单组件，例如动态字幕、素材卡、真实视频层、节奏进度和 CTA 场景。
- `scripts/render-video.ts` 默认会为 `HighQualityShort` 生成临时 WAV 音频床，渲染完成后删除临时音频文件。

### AIGC 视觉素材

- 封面图、背景图和素材缺口补图只能作为素材槽位输入，不允许直接替换结构协议。
- 生成提示词记录在 `docs/IMAGEGEN_PROMPTS.md`，便于答辩时说明哪些视觉素材由 AI 生成，哪些结构规则由项目自主定义。

### Prisma / SQLite

- Prisma 管理项目、样例拆解和生成版本。
- SQLite 仅用于本地演示和开发。
- `dev.db` 已加入 `.gitignore`，不上传用户数据。

### Markdown / JSON 导出

- Markdown 用于 Obsidian、答辩文档和创作协作。
- JSON 用于后续对接 Remotion、FFmpeg 或剪映式时间线。

## 安全边界

- 不提交 `.env`、API Key、数据库、上传素材、构建产物和个人隐私文件。
- 不复刻样例视频的具体人物、台词、画面和品牌表达，只迁移创作结构。
- 背书、评价、参数和数据必须真实可追溯；系统会在风险提示中提醒不要虚构证据。
- 用户上传素材默认只在本地处理；公开仓库不包含任何上传文件。
- 模型不生成可执行代码。模型输出必须先通过 Zod Schema，渲染端只接受 `RenderTimeline`。
- 临时渲染素材放在 `public/render-sources/` 或 `public/render-audio/`，这些目录已被 `.gitignore` 忽略。
- 如果接入真实商业模型，应使用服务端环境变量保存密钥，前端只调用后端 API。

## 使用 AI 辅助说明

- AI 编码工具用于辅助工程实现、调试和测试。
- LLM 用于样例结构分析、方案生成和自然语言编辑。
- 图像生成工具用于封面、背景和缺口补图，不决定视频结构。
- 本项目自主设计并实现了结构定义、素材槽位、缺口补全、质量诊断、导出和交互流程。

# AI 架构、工具协议与安全边界

## 整体 AI 架构

系统按“样例理解 -> 结构抽取 -> 素材适配 -> 结果生成 -> 人机协同编辑”组织：

1. 样例理解：接收样例视频、链接、人工观察文本或补充样例文本，结合 FFmpeg/ffprobe 元数据抽取基础信息。
2. 多样例汇总：`combineSampleAnalyses()` 会把多条样例拆解合成一个带来源标题的综合 `VideoStructureAnalysis`，保留每条样例的 Hook、节奏、包装和可迁移节拍。
3. 结构抽取：把样例拆成 Hook、节奏、字幕包装、画面包装、音乐卡点、卖点推进和 CTA 结构。
4. 结构指纹：本地从 `VideoStructureAnalysis` 推导 Hook 强度、镜头密度、字幕密度、证据位置、CTA 位置、节奏曲线和包装标签，用于答辩解释“学到了什么结构”。
5. 素材适配：`parseMaterialAssets()` 把用户素材拆成图片、视频、文本证据和行动入口资产，再映射到开头吸引、主体特写、使用过程、对比结果、背书证据、结尾 CTA 等结构槽位。
6. 手法迁移：`TechniqueTransferRecipe` 将源样例时间段、可迁移规则、字幕密度、转场倾向、beat intensity、素材状态和补全计划映射到新片段。
7. 结果生成：生成多版本短视频方案，包含脚本、分镜、时间线草案、包装建议和评分证据矩阵。
8. 视频重组：把最佳版本转换成 `RenderTimeline`，由 Remotion 渲染动态字幕、素材槽位、节奏进度、音频床和 MP4；UI 出片 API 会同时传入 `analysis`，确保成片由样例手法驱动。
9. 人机协同：支持字段级人工编辑和自然语言编辑，例如“开头更抓人一些”“补充可信证据”，系统重写完整结构化方案。

## 工具协议

### LLM / 多模态模型

- 通过 OpenAI-compatible 接口接入云模型，使用 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL_TEXT`、`AI_MODEL_VISION`、`AI_MODEL_VIDEO` 配置。
- 上传视频采用混合理解：支持 `video_url` 的网关会先由 `AI_MODEL_VIDEO` 直接观察整段视频；同时 FFmpeg 抽取带时间戳的时间轴关键帧，把最多 `AI_VIDEO_FRAME_COUNT` 张本地 JPG 作为多模态 `image` parts 传给 `AI_MODEL_VISION`。
- `AI_MODEL_TEXT` 再把视觉观察笔记、样例描述和媒体元数据整理成严格 Zod JSON，避免视觉模型直接输出复杂 JSON 时格式不稳。
- 系统要求模型输出符合 Zod Schema 的结构化 JSON，而不是自由文本。
- 对不支持 schema response format 的本地 OpenAI-compatible 网关，系统会退到 `generateText`，再执行 JSON 提取、一次修复和 Zod 校验；校验失败才进入本地 fallback。
- 对智谱 / Z.ai 的推理模型，可设置 `AI_DISABLE_THINKING=true`，服务端会附加 `thinking: { type: "disabled" }`，减少推理 token 消耗并提升 JSON 输出稳定性。
- `AI_VIDEO_INPUT_MODE=hybrid` 默认先尝试整段视频理解，再用时间轴关键帧作为稳定保底；可改成 `direct`、`frames` 或 `off`。
- `AI_DIRECT_VIDEO_MAX_MB` 控制本地视频转 data URL 的最大体积，避免请求体过大。
- `AI_DIRECT_VIDEO_FPS` 控制整段视频理解的采样频率，默认 1 FPS。
- `AI_MAX_OUTPUT_TOKENS` 默认 4096，避免视觉模型输出结构化拆解时被截断成不完整 JSON。
- `AI_PLAN_TIMEOUT_MS` 默认 22000，`AI_REFINE_TIMEOUT_MS` 默认 18000；当方案生成或自然语言修订超过时限，会自动进入本地保底生成，避免答辩现场卡在模型网关。
- 未配置密钥时使用本地 fallback 策略，保证演示链路可运行。

### FFmpeg / ffprobe

- `ffprobe` 用于读取视频时长、分辨率、音频和帧率。
- `ffmpeg` 用于抽取预览帧。
- 预览帧只存储在本地 `data/frames`，不会提交到代码仓库。

### RenderTimeline / Remotion

- `StructureFingerprint` 是 `VideoStructureAnalysis` 的本地派生层，不调用模型，负责把样例节拍转成可展示的 Hook、节奏、字幕、证据、CTA 和包装指标。
- `TechniqueTransferRecipe` 是结构迁移和渲染之间的证据层，不调用模型，负责把源样例节拍映射到新方案镜头，并保留字幕密度、转场倾向、包装标签、素材槽位和补全计划。
- `AdaptiveTransferStoryboard` 是外部视频模型调用前的导演协议：从 `SampleAnalysis.beatMap`、目标 Brief、用户素材和 `scriptBeats` 推断目标时长与分段数，把源样片的镜头目的、视觉规律、字幕/包装和可迁移规则逐段写入生成 prompt。
- `RenderTimeline` 是模型和渲染器之间的协议层，字段包含 `scenes`、`captionTokens`、`visualLayers`、`audioCues`、`materialFit` 和 `completionPlan`。
- LLM 或本地 fallback 只能生成结构化 JSON，服务端用 Zod 校验后才交给 Remotion。
- Remotion 只渲染项目白名单组件，例如动态字幕、素材卡、真实视频层、节奏进度、CTA 场景、漏光转场、运动模糊和颗粒层。
- `scripts/render-video.ts` 默认会为 `HighQualityShort` / `CoffeeLaunchShort` 生成临时 WAV 音频床，渲染完成后删除临时音频文件。
- 高质量 Remotion 渲染会设置 `chromiumOptions: { gl: "angle" }`，保证 `@remotion/light-leaks` 的 WebGL 漏光效果在本地 SSR 渲染中可用。
- `scripts/video-quality-check.ts` 是成片质量门禁，用 ffprobe/ffmpeg 验证 9:16 竖屏、帧率、码率、音轨、采样率、声道数和音量范围。

### AIGC 视觉素材

- 封面图、背景图和素材缺口补图只能作为素材槽位输入，不允许直接替换结构协议。
- 生成提示词记录在 `docs/IMAGEGEN_PROMPTS.md`，便于答辩时说明哪些视觉素材由 AI 生成，哪些结构规则由项目自主定义。

### Prisma / SQLite

- Prisma 管理项目、样例拆解和生成版本。
- SQLite 仅用于本地演示和开发。
- `dev.db` 已加入 `.gitignore`，不上传用户数据。

### Markdown / JSON 导出

- Markdown 用于 Obsidian、答辩文档和创作协作。
- Markdown 导出包含样例拆解、结构迁移映射、手法迁移配方、样例-结果对比、素材资产盘点、分镜、评分证据矩阵和完整脚本。
- JSON 用于后续对接 Remotion、FFmpeg 或剪映式时间线，也保留 `techniqueTransfer` 与素材资产字段。

## 安全边界

- 不提交 `.env`、API Key、数据库、上传素材、构建产物和个人隐私文件。
- 不复刻样例视频的具体人物、台词、画面和品牌表达，只迁移创作结构。
- 多样例模式只汇总共性结构和可迁移手法，不把任一样例的内容当作模板逐帧复刻。
- 背书、评价、参数和数据必须真实可追溯；系统会在风险提示中提醒不要虚构证据。
- AIGC 图像/视频只能作为缺口槽位素材，必须标注来源和用途；不能直接替代样例拆解、结构定义和迁移配方。
- 一键外部成片接口只按 `AdaptiveTransferStoryboard` 生成分段素材，再由 FFmpeg/Remotion 拼接或重组；不得把“根据主题生成完整短片”作为主链路，避免偏离“结构迁移”课题。
- 用户上传素材默认只在本地处理；公开仓库不包含任何上传文件。
- 模型不生成可执行代码。模型输出必须先通过 Zod Schema，渲染端只接受 `RenderTimeline`。
- 临时渲染素材放在 `public/render-sources/` 或 `public/render-audio/`，这些目录已被 `.gitignore` 忽略。
- 如果接入真实商业模型，应使用服务端环境变量保存密钥，前端只调用后端 API。

## 使用 AI 辅助说明

- AI 编码工具用于辅助工程实现、调试和测试。
- LLM 用于样例结构分析、方案生成和自然语言编辑。
- 图像生成工具用于封面、背景和缺口补图，不决定视频结构。
- Remotion 用于把受控 `RenderTimeline` 渲染为有声 MP4，不让模型直接生成前端/渲染代码。
- 本项目自主设计并实现了结构定义、多样例汇总、手法迁移配方、素材资产盘点、素材槽位、缺口补全、质量诊断、导出和交互流程。

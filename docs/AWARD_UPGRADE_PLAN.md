# 拿奖导向改进方案

更新时间：2026-05-26

## 一句话定位

把项目从“脚本和成片生成器”升级成“AI 视频导演台”：系统先学习样例的结构指纹，再把新素材放进可解释的镜头槽位，最后输出可播放视频、可编辑时间线和可交付证据包。

## 外部学习结论

### 1. Remotion 的优势是可参数化视频系统

Remotion 官方强调用 React 生成真实 MP4，支持把数据传入视频、嵌入 `@remotion/player` 做浏览器预览，并面向 prompt-to-video、视频编辑器和自动化视频生产场景。我们已经用了 Remotion 渲染 MP4，但还没有把它变成“可交互导演台”。

对本项目的启发：

- 把 Remotion 从 CLI 渲染工具前移到网页：用 Player 预览时间线、镜头层和字幕节奏。
- 把每个镜头的参数暴露给前端：节奏、字幕密度、包装风格、CTA 强度、素材补全策略。
- 给评委看“改一个参数，成片结构怎么变”，比只播放最终 MP4 更有说服力。

参考：Remotion 官方介绍其可用 React 编写视频、参数化内容、嵌入 Player 并渲染真实 MP4。  
https://www.remotion.dev/

### 2. CapCut 的产品强点是“生成后继续编辑”

CapCut Video Studio 的公开页面强调从文本生成视频后，用户可以进入编辑器继续调整文本、视觉、配音、音乐、字幕和时间。CapCut for Business 也把 Ad Script、Storyboard Editor、Business Video Templates、Smart Ads 放在同一条商业视频生产链里。

对本项目的启发：

- 评委不只想看生成结果，也想看可改性。我们要把“自然语言改片”做成核心演示点。
- 方案页要更像剪映式工作台：素材、结构、时间线、预览、质量诊断在一个工作流里。
- 输入可以从商品信息拓展到商品 URL、卖点表、店铺素材包，形成更接近商业创作的入口。

参考：CapCut Video Studio 说明生成后可继续编辑文本、视觉、配音、音乐、字幕和 timing；CapCut for Business 资料列出广告脚本、分镜编辑器、商业模板和 Smart Ads。  
https://www.capcut.com/tools/video-studio  
https://ads.tiktok.com/business/library/NA_Capcut_For_Business_One_Pager.pdf

### 3. Runway 这类视频模型适合补素材，不适合替代结构

Runway API 文档公开了 text-to-video、image-to-video、video-to-video、sound effects、TTS、voice dubbing、voice isolation 等能力。这些能力很强，但比赛题目看重“结构迁移”和“素材不足处理”。如果直接把整片交给视频模型，项目会像黑盒生成器，评分风险反而更高。

对本项目的启发：

- 把视频生成模型放在 `GapFillTask` 里，只生成封面、背景、转场垫片、商品氛围图、短 B-roll。
- 每个 AIGC 素材都要绑定结构槽位和使用原因，例如“缺少开头吸引镜头，用 2 秒冰杯微距替代”。
- 生成素材后仍交给 Remotion/时间线系统统一编排，保持可控。

参考：Runway API 列出 image/text/video generation、sound effects、speech、voice dubbing 等任务端点。  
https://docs.dev.runwayml.com/api/

### 4. 专业剪辑系统关心时间线交换，不只关心视频文件

OpenTimelineIO 把时间线表达为 tracks、clips、gaps、transitions，并引用外部媒体。它不是媒体容器，而是剪辑信息交换格式。这个思路很适合本项目：我们可以输出 MP4，也可以输出“可继续剪”的时间线描述。

对本项目的启发：

- 在 `RenderTimeline` 旁边增加 `EditableTimeline` 或 OTIO-like JSON。
- 每个镜头都保留素材引用、可替换槽位、转场、字幕层、音频 cue 和风险提示。
- 交付包里加入 `timeline.json`，二期可以导出 `.otio` 或剪映草稿兼容格式。

参考：OpenTimelineIO 官方说明 timeline 可包含 tracks、clips、gaps 和 transitions，并引用外部媒体；GitHub README 说明 OTIO 是 editorial cut information 的交换格式，不是媒体容器。  
https://opentimelineiox.readthedocs.io/en/latest/tutorials/otio-timeline-structure.html  
https://github.com/AcademySoftwareFoundation/OpenTimelineIO

### 5. 模型 API 要继续走结构化输出

OpenAI Structured Outputs 强调模型可以按 JSON Schema 输出，减少缺字段和枚举幻觉。OpenAI Audio 文档提供语音转写能力，Image generation 文档提供生成和编辑图片能力。对我们来说，模型应该产出“结构决策”和“素材建议”，而不是随意生成自由文本。

对本项目的启发：

- 继续坚持 Zod Schema：模型只输出 `VideoStructureAnalysis`、`MigratedVideoPlan`、`GapFillTask`、`RenderRecipe`。
- ASR 用于样例字幕/口播拆解，图像生成用于补素材，LLM 用于结构抽象和迁移解释。
- 每个模型输出都要被记录到证据链：输入、输出、Schema 校验、人工可改字段。

参考：OpenAI Structured Outputs、Speech to text、Image generation 官方文档。  
https://platform.openai.com/docs/guides/structured-outputs  
https://platform.openai.com/docs/guides/speech-to-text  
https://platform.openai.com/docs/guides/image-generation

## 改进后的产品主线

### 当前主线

样例输入 -> 样例拆解 -> 新 Brief -> 多版本方案 -> 分镜/时间线 -> Remotion 有声成片 -> 质量门禁

### 改进主线

样例输入 -> 结构指纹 -> 素材资产盘点 -> 缺口任务队列 -> 多策略迁移 -> 可编辑导演台 -> Remotion 有声成片 -> 证据交付包

新的核心卖点：

- 结构指纹：用图表展示样例的 hook 强度、镜头密度、字幕密度、证据推进和 CTA 位置。
- 素材资产盘点：把用户素材自动分成商品特写、使用过程、对比证据、场景氛围、结尾 CTA。
- 缺口任务队列：每个缺口都有补全策略、替代镜头和风险提示。
- 可编辑导演台：用户改 hook、卖点顺序、字幕密度、节奏档位，预览马上变化。
- 证据交付包：导出 MP4、Markdown、JSON、质量报告、关键帧和时间线。

## 新增数据协议

### `StructureFingerprint`

用途：把样例从“文字拆解”变成可视化结构曲线。

关键字段：

- `hookStrength`: 0-100
- `shotDensity`: 每 10 秒镜头数
- `subtitleDensity`: 每 10 秒字幕字数
- `proofPosition`: 证据出现的时间点
- `ctaPosition`: CTA 出现的时间点
- `rhythmCurve`: 快慢变化数组
- `packagingTags`: 字幕、标题条、贴纸、转场、封面风格

### `MaterialAsset`

用途：把用户素材变成可匹配的镜头资产。

关键字段：

- `assetId`
- `kind`: image / video / text / audio
- `duration`
- `detectedSubjects`
- `bestSlots`: hook / product-closeup / usage / proof / cta
- `qualityScore`
- `riskFlags`

### `GapFillTask`

用途：让素材不足处理可解释、可执行。

关键字段：

- `slotId`
- `missingReason`
- `impact`
- `strategy`: rearrange / caption / packaging / aigc / reuse
- `prompt`
- `fallbackPlan`
- `needsHumanReview`

### `DirectorEdit`

用途：让人工可调和自然语言改片进入统一协议。

关键字段：

- `target`: hook / pacing / sellingPointOrder / subtitleDensity / cta
- `instruction`
- `before`
- `after`
- `affectedScenes`

### `ExportBundle`

用途：把提交材料一次性打包。

关键字段：

- `mp4Path`
- `storyboardMarkdownPath`
- `timelineJsonPath`
- `qualityReportPath`
- `keyframes`
- `sourceManifest`

## 评分导向路线图

### P0：把“可解释结构迁移”做成可视化证据

目标：评委能在 30 秒内看懂系统学到了什么、迁移了什么、补了什么。

任务：

1. 新增结构指纹面板：显示 hook、节奏、字幕密度、证据推进和 CTA 时间点。
2. 新增样例 vs 新方案对比图：左右两条时间线，连接对应节拍。
3. 新增缺口任务队列：每个缺口显示槽位、影响、补全策略和替代素材。

验收：

- `npm run award:check` 仍全部 90+。
- 页面截图能看到“样例结构 -> 新方案 -> 缺口补全”的完整链路。

### P0：把高质量视频从单模板升级成导演参数

目标：用户可以控制视频风格，而不是只能选择固定 coffee 模板。

任务：

1. 在 `RenderTimeline` 增加 `stylePreset`: cinematic / conversion / fast-cut / premium。
2. 把字幕密度、转场强度、镜头推拉、CTA 强度做成参数。
3. 在网页渲染按钮前加入“高点击 / 高转化 / 高质感”选择。

验收：

- 同一 coffee case 能渲染 2 个明显不同版本。
- `video:check` 对两个版本都通过。

### P0：补素材资产理解

目标：真实素材适配拿满更多分。

任务：

1. 对上传视频抽 5-8 张关键帧。
2. 为每个素材生成 `MaterialAsset`，记录主体、场景、适合槽位和质量分。
3. 在素材缺口面板显示“已有素材能撑哪些结构槽位”。

验收：

- 给一条用户素材视频时，系统能推荐开头、中段、结尾适用片段。
- 无模型 Key 时保留本地 fallback，保证现场稳定。

### P1：接入 AIGC 缺口补全

目标：让“素材不足处理”从文字建议升级成可用素材。

任务：

1. 根据 `GapFillTask` 生成封面、背景图、卖点卡片或 2 秒 B-roll prompt。
2. 支持 OpenAI-compatible 图像生成接口，生成结果落到本地素材库。
3. 每个生成素材显示来源、用途和人工审核标记。

验收：

- 缺少开头吸引镜头时，系统能生成一张可用于开场的竖屏视觉图。
- 文档说明 AIGC 只补槽位，不替代结构迁移。

### P1：可编辑导演台

目标：把自然语言编辑做成比赛亮点。

任务：

1. 新增“导演控制条”：Hook 强度、字幕密度、节奏、CTA 强度。
2. 自然语言编辑后生成 `DirectorEdit` diff。
3. 页面显示变更前后影响的 scenes。

验收：

- 输入“开头更抓人，商品信息提前”，时间线和字幕能明显变化。
- 导出 Markdown 记录人工修改过程。

### P1：提交证据包

目标：降低上交材料遗漏风险。

任务：

1. 新增 `submission:case`：生成 MP4、关键帧、质量报告、Markdown、timeline JSON。
2. 把 `video:check` 输出保存为 `quality-report.json`。
3. README 给出“一条命令生成提交材料”的流程。

验收：

- 本地生成一个 `submissions/case-咖啡新品/` 目录。
- 目录包含 MP4、3 张关键帧、质量报告和方案说明。

## 最值得先做的 3 个 commit

1. `Add structure fingerprint panel`
   - 文件：`src/lib/structure-fingerprint.ts`、`src/app/page.tsx`、测试文件
   - 价值：直接提升可解释性和展示分。

2. `Add material asset scoring`
   - 文件：`src/lib/material-assets.ts`、`src/lib/media.ts`、素材面板
   - 价值：补真实素材适配短板。

3. `Add submission case bundle`
   - 文件：`scripts/submission-case.mjs`、`scripts/video-quality-check.ts`、`docs/SUBMISSION.md`
   - 价值：让提交材料更完整，降低现场翻车风险。

## 当前项目应该避免的方向

- 直接接一个整片文生视频模型作为主流程。评委会看不到结构迁移和素材补全的自主设计。
- 继续只打磨 coffee 模板。视频效果还可以更好，但边际收益开始下降。
- 过早做账号、计费、团队协作。比赛评分更关心样例拆解、迁移、补全和可展示结果。
- 把剪映/CapCut 当成后端 API。公开资料更适合把它当产品交互参考，而不是稳定工程依赖。

## 最终答辩表述

我们不是复刻样例，也不是把整片交给视频模型。系统先把样例拆成结构指纹，再把用户素材映射到镜头槽位。素材不够时，系统生成缺口任务，选择结构重排、字幕补全、包装补全、AIGC 补图或素材复用。最后，Remotion 根据同一份时间线协议生成有声 MP4，`video:check` 验证成片规格，导出包保留脚本、分镜、时间线和质量报告。评委可以看到每一步为什么发生，也能继续手动修改。

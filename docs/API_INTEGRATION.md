# API 接入说明

本项目把外部模型能力分成两层：主创作链路负责“结构迁移、素材补全和可编辑时间线”，外部 API 只作为理解样例、补充素材或生成视频片段的能力来源。这样现场演示不会变成黑盒视频生成器。

## 配置文件

把真实密钥写到 `.env.local`，不要写入仓库。当前 `.gitignore` 已忽略 `.env` 和 `.env*.local`。

```bash
AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY="sk-..."
AI_MODEL_TEXT="gpt-4.1-mini"
AI_MODEL_VISION="gpt-4.1-mini"
AI_MODEL_VIDEO="gpt-4.1-mini"
AI_SUPPORTS_STRUCTURED_OUTPUTS="false"
AI_VIDEO_INPUT_MODE="hybrid"
AI_VISION_FRAME_LIMIT="12"
AI_DIRECT_VIDEO_MAX_MB="20"
AI_DIRECT_VIDEO_FPS="1"

VIDEO_API_BASE_URL="https://example.com"
VIDEO_API_KEY="..."
VIDEO_API_MODEL="cogvideox-3"
VIDEO_API_ENDPOINT="/v1/videos/generations"
VIDEO_API_QUERY_ENDPOINT="/v1/async-result/{id}"
VIDEO_API_DURATION_SECONDS="5"
VIDEO_API_SEGMENT_SECONDS="5"
```

## 推荐接法

### 文本与结构化脚本

使用 `AI_BASE_URL` + `AI_API_KEY` 接 OpenAI-compatible 服务。系统会用文本模型生成结构化 JSON，再经过 Zod Schema 校验和本地修复逻辑。没有密钥时，页面仍会走本地 fallback，保证演示不断。

### 多模态样例理解

默认推荐 `AI_VIDEO_INPUT_MODE=hybrid`：

- 先尝试整段视频理解，用于读取镜头顺序、字幕、节奏和 CTA。
- 如果兼容服务不支持 `video_url`，自动回退到关键帧理解。
- 如果没有可用视觉模型，继续使用人工观察/转写文本和本地策略。

可选模式：

- `frames`：只用抽帧，不尝试整段视频。
- `direct`：优先整段视频理解。
- `off`：关闭视觉视频输入，只走文本观察。

### 视频生成 API

视频生成 API 只用于“素材缺口补全”和“分段素材生成”。项目仍然用样例结构迁移出的分镜、字幕、包装和时间线控制成片，不把整条片子交给模型黑盒生成。

当前通用接口会：

1. 根据迁移分镜生成每段 prompt。
2. 调用 `VIDEO_API_ENDPOINT` 提交任务。
3. 用 `VIDEO_API_QUERY_ENDPOINT` 轮询结果。
4. 下载每段视频到 `renders/api-videos`。
5. 用 FFmpeg 拼接成可预览视频。

## 诊断入口

主页面不显示 API 配置，避免干扰创作演示。开发自检使用：

- 页面：`/integrations`
- JSON：`/api/integrations/status`

这两个入口只展示是否配置、模型名、endpoint 和能力状态，不展示任何 API Key。

## 安全边界

- API Key 只从环境变量读取。
- 前端、数据库、导出 Markdown/JSON 都不回显密钥。
- 诊断接口不返回密钥值，只返回脱敏后的配置状态。
- 外部视频生成产物默认进入 `renders/`，该目录已被 `.gitignore` 忽略。
- 如果模型失败或超时，系统回退到本地策略，保证演示可继续。

## 演示建议

正式展示时只打开主页面 `/`，让评审看输入、拆解、迁移、补全、分镜和出片。`/integrations` 只在准备阶段确认 API 是否接通，不作为主产品页面展示。

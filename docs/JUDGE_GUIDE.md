# 评委快速验收指南

## 5 分钟看懂项目

本项目不是“直接让视频模型生成一条片子”，而是一个 AI 视频创作平台原型：

1. 理解样例视频，抽取 Hook、节奏、字幕包装、卖点推进和 CTA。
2. 把样例结构迁移到新商品或新主题。
3. 识别用户素材缺口，并给出结构重排、字幕补全、包装补全、AIGC 素材或素材复用方案。
4. 输出可编辑脚本、分镜、时间线、手法迁移配方、样例-结果对比和质量诊断。
5. 用 Remotion 渲染稳定有声竖屏 MP4，并用 ffprobe/ffmpeg 做质量门禁。

## 推荐验收顺序

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

打开 `http://localhost:3000`，按页面顺序检查：

1. 选择“学习平板”或“咖啡新品”预设。
2. 点击“拆解成结构卡片”，查看样例结构指纹。
3. 填写或保留 Brief，点击“生成迁移方案”。
4. 查看 RAG 技巧命中、手法迁移配方、真实素材资产、素材缺口、迁移映射、竖屏分镜和时间线草案。
5. 使用自然语言编辑，例如“开头更抓人，并把证据提前”。
6. 点击 Markdown / JSON 导出。

## 最终视频证据

录屏或答辩前建议运行：

```bash
npm run demo:final -- --out-dir submissions/final-coconut-latte --quality high
```

输出目录：

- `submissions/final-coconut-latte/final-video.mp4`
- `submissions/final-coconut-latte/final-demo-report.md`
- `submissions/final-coconut-latte/quality-report.json`
- `submissions/final-coconut-latte/keyframes/*.png`
- `submissions/final-coconut-latte/final-flow/case.md`
- `submissions/final-coconut-latte/final-flow/case.json`

`quality-report.json` 会记录分辨率、时长、帧率、音频、码率和音量检查结果。当前主推演示片是 15 秒 9:16 有声视频，开场使用稳定 AIGC 商品图 + Remotion 可控推镜，避免生成视频大特写抖动。

## 一键提交包

只打源码：

```bash
npm run submission:pack
```

打源码并附最终演示证据：

```bash
npm run submission:pack -- --include-final-demo-dir submissions/final-coconut-latte
```

产物会输出到 `submissions/`，该目录不会进入 Git 仓库。

## 评分点对应

| 评分点 | 项目证据 |
| --- | --- |
| 样例输入与解析 | 视频上传、本地视频选择、ffprobe 元数据、时间轴关键帧 |
| 结构拆解 | Hook、节奏、字幕包装、画面包装、卖点推进、CTA、结构指纹 |
| 结构迁移 | 多版本脚本、迁移映射、`TechniqueTransferRecipe`、源样例时间段到新方案镜头 |
| 素材缺口 | 真实素材资产盘点、结构槽位诊断、缺口影响、补全策略 |
| 可展示结果 | 竖屏分镜、时间线草案、Remotion MP4、关键帧、质量报告 |
| 进阶能力 | RAG 剪辑技巧、多版本、自然语言编辑、AIGC 素材策略 |
| 安全边界 | Zod Schema、服务端密钥、本地素材忽略、模型不生成可执行代码 |

## AI 工具与自主实现

- LLM / 多模态模型用于视频结构观察、方案生成和自然语言编辑。
- FFmpeg/ffprobe 用于媒体解析、抽帧和质量检查。
- Remotion 用于可控视频重组和有声 MP4 渲染。
- 项目的核心结构定义、多样例汇总、素材资产盘点、素材槽位、缺口补全、手法迁移配方、质量门禁和前端工作流为自主设计与实现。

## 安全边界

- `.env`、API Key、数据库、上传素材、渲染产物和提交包目录均已被 `.gitignore` 忽略。
- 样例视频只迁移创作结构，不复刻具体人物、台词、品牌表达或镜头。
- 模型输出必须先经过 Zod Schema 校验，再进入渲染或导出流程。
- 视频生成模型只作为素材补全工具，最终成片由 Remotion 时间线统一控制。

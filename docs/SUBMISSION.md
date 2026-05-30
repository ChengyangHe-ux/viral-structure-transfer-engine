# 参赛提交清单

## 交付物

- 代码仓库：https://github.com/ChengyangHe-ux/viral-structure-transfer-engine
- 项目说明：`README.md`
- AI 架构、工具协议与安全边界：`docs/ARCHITECTURE.md`
- 演示讲稿与录屏流程：`docs/DEMO_SCRIPT.md`
- 冠军答辩手册：`docs/CHAMPIONSHIP_PLAYBOOK.md`
- 可编辑答辩 PPT：`docs/presentation/爆款结构迁移引擎答辩稿.pptx`
- AIGC 视觉素材提示词：`docs/IMAGEGEN_PROMPTS.md`
- 视频产物 case：`cases/ai-resume-demo-case.md`
- 离线可复现实验案例（自动生成）：`cases/generated/README.md`

## 运行方式

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

默认地址：`http://localhost:3000`

未配置模型密钥时，系统会使用本地 fallback 策略，保证评审现场能完整跑通样例拆解、结构迁移、素材缺口、时间线、迁移映射、手法迁移配方、真实素材资产盘点、质量诊断和导出。

生成迁移方案前，系统会先进行一次本地 RAG 检索：用目标 Brief、用户素材和样例结构命中“剪辑技巧库”，把 Hook、B-roll 场景阶梯、卡点字幕、动作/形状匹配转场、证据卡片和 CTA 收束等方法注入脚本与制作备注。该能力不依赖外部向量库，适合比赛现场稳定演示，后续也可替换成真实 embedding + 向量数据库。

## 提交前自检（推荐）

```bash
npm run submission:check
```

该命令会检查工作区是否干净、关键文档是否齐全、以及是否存在被误提交的 `.env`/数据库/构建产物等；随后运行 `award:check` 和 `lint`/`test`/`build`，用于提交前的稳定性与冲奖说服力验证。

也可以单独运行冲奖案例校验：

```bash
npm run award:check
```

当前离线演示案例（AI 简历、学习平板、咖啡新品、矿泉水）都必须在“大奖目标看板”达到 90+，否则提交前应先补强结构、RAG 技巧命中、真实素材证据或答辩证明链。

冠军级验收建议再运行：

```bash
npm run champion:check
```

该命令使用官方评分表 evaluator 检查每个离线案例是否 `champion-ready`，并在最终演示包存在时检查视频质量 100/100 以及 `case.md` 是否包含手法迁移配方、样例-结果手法对比、评分证据矩阵、官方评分表拆解和真实素材资产盘点。

## 打包提交物（可选）

若比赛要求提交压缩包，可用下列命令生成只包含 Git 追踪文件的提交包（自动先跑 `submission:check`）：

```bash
npm run submission:pack
```

产物会输出到 `submissions/`（已在 `.gitignore` 中忽略）。

如需把演示视频一并塞进压缩包，可加参数：

```bash
npm run submission:pack -- --include-demo-video renders/demo.mp4
```

如果已经运行过最终演示包，推荐把完整证据目录一起打入压缩包：

```bash
npm run submission:pack -- --include-final-demo-dir submissions/final-coconut-latte
```

该命令会把 `final-video.mp4`、`final-demo-report.md`、`quality-report.json`、关键帧和 `case.md/case.json` 放到压缩包内的 `final-demo/` 目录。

## 评委快速验收

评委或导师可以直接阅读 `docs/JUDGE_GUIDE.md`，按 5 分钟路径检查页面、最终视频、质量报告、AI 架构和安全边界。

## 离线案例生成（推荐）

```bash
npm run cases:generate
```

该命令会基于 `src/lib/demo-presets.ts` 生成 `cases/generated/*`，用于在无模型密钥时也能展示“样例拆解 → RAG 剪辑技巧 → 结构迁移 → 大奖目标看板 → 映射 → 质量诊断”的完整链路，并提供可复现实验材料。

## 最终演示包（推荐录屏前跑一次）

```bash
npm run demo:final -- \
  --out-dir submissions/final-coconut-latte \
  --asset-manifest outputs/zhipu-video-assets/asset-manifest.json
```

该命令会输出 `submissions/final-coconut-latte/final-video.mp4`、`final-demo-report.md`、`quality-report.json`、`keyframes/*.png`、`final-flow/case.md` 和 `final-flow/case.json`。Markdown 开头包含运行证据：整段视频理解是否启用、时间轴采样帧数、样例拆解/方案生成是否走本地保底。主推荐成片使用 AIGC 静帧 + Remotion 可控推镜作为开场，以避免图生视频大特写逐帧形变；视频生成模型用于补充 B-roll、转场垫片和素材缺口，不强行作为开场主画面。

## 一键生成演示视频（Remotion，可选加分项）

```bash
npm run video:render -- --input cases/generated/demo-学习平板.json --out renders/demo.mp4 --title "学习平板结构迁移成片预览" --quality high
```

说明：这里生成的是 1080x1920 竖屏成片预览，不只是字幕卡。每个脚本 beat 会渲染为全屏场景，包含大字幕、模拟素材位、包装提示、素材缺口/补全标签和节奏进度；后续仍可在剪辑软件中替换为真实素材或 AIGC 画面。
提示：首次渲染前执行一次 `npm run media:install-binaries`（安装/链接 Remotion compositor + ffmpeg/ffprobe）。

## 高质量有声成片（主推荐）

```bash
npm run video:render -- --input cases/generated/demo-咖啡新品.json --out renders/coffee-launch-short-high.mp4 --composition CoffeeLaunchShort --quality high --title "咖啡新品高质量有声版"
```

本命令会从方案 JSON 自动构建 `RenderTimeline`，生成临时 WAV 音频床，再由 Remotion 输出 MP4。当前主推案例换成“咖啡新品”，画面包含冷萃杯、液体倒入、冰块、果香卡片、通勤场景、试饮反馈、限时 CTA、WebGL 漏光转场、运动模糊和颗粒层。当前高质量验证结果：视频 1080x1920 / 30fps / 38 秒，视频码率约 5.01 Mbps，音频 MP3 / 48kHz / stereo，`mean_volume` 约 -18.5 dB，`max_volume` 约 -3.2 dB。抽帧验证文件位于本机 `renders/coffee-launch-high-02s.png`、`renders/coffee-launch-high-12s.png`、`renders/coffee-launch-high-27s.png`。

渲染完成后，建议立即运行视频质量门禁：

```bash
npm run video:check -- --input renders/coffee-launch-short-high.mp4
```

该命令会用 ffprobe/ffmpeg 自动验证 1080x1920 竖屏、30fps、视频码率、音轨存在、48kHz stereo 和音量范围，避免最终交付出现“视频能播放但无声音/码率太低/规格不对”的扣分风险。

## 本地样例素材导入（建议演示用）

- 将样例 `mp4/mov` 放入 `data/uploads/`（已被 `.gitignore` 忽略）。
- 页面“输入素材”支持直接选择本地已导入视频，用于拆解结构与抽帧，无需重复上传。
- 如需自动读取视频元数据与抽帧，执行一次：`npm run media:install-binaries`。

## 评分覆盖

| 评分项 | 项目对应能力 | 演示位置 |
| --- | --- | --- |
| 样例输入与基础解析 | 支持样例文本、链接、视频上传，读取媒体元信息 | 首页左侧“输入素材” |
| 多样例输入 | 主样例 + “补充样例”文本，服务端合并为带来源标题的综合结构拆解 | “输入素材 / 补充样例” |
| 结构拆解 | Hook、节奏、字幕包装、画面包装、卖点推进、CTA，并用结构指纹量化 Hook 强度、镜头密度、字幕密度、证据位置和 CTA 位置 | “样例结构拆解 / 结构指纹”面板 |
| RAG 技巧检索 | 生成前命中剪辑技巧库，输出可解释的“怎么剪”依据 | “迁移 Brief”和“RAG 技巧库”面板 |
| 结构迁移生成 | 生成脚本、分镜式时间线、包装建议、多版本方案 | “多版本方案脚本” |
| 手法迁移证明 | `TechniqueTransferRecipe` 把源样例时间段、可迁移规则、字幕密度、转场倾向、beat intensity 和素材状态映射到新片段 | “手法迁移配方”面板 / 导出 Markdown |
| 冲奖目标自评 | 将大奖目标拆成 5 个评分项，并给出下一步补强动作 | “大奖目标看板” |
| 官方评分表 | 将题目 100 分基础项 + 10 分加分项结构化评分，列出证据和展示位置 | “冠军验收台” / Markdown 导出 |
| 素材缺口识别 | 结构槽位诊断，识别开头、主体、过程、对比、证据、CTA 缺口 | “素材缺口与补全” |
| 素材缺口补全 | 结构重排、文案补全、包装补全、素材复用 | “素材缺口与补全” |
| 真实素材适配 | 用户素材被拆成图片、视频、文本证据、行动入口资产，并推荐到结构槽位 | “素材缺口与补全 / 真实素材资产” |
| 迁移过程可视化 | 结构指纹先展示样例学到的曲线，再用样例节拍 -> 新方案镜头 -> 素材槽位 -> 补全动作解释迁移链路 | “结构指纹”“手法迁移配方”“迁移映射” |
| 结果可验证 | 秒级时间线草案、9:16 分镜预览、Remotion 竖屏成片预览、版本切换、Markdown/JSON 导出 | “时间线草案”“竖屏分镜预览”、`npm run video:render` 和导出按钮 |
| 画面包装能力 | 字幕、标题条、卖点卡片、转场、封面标题 | 每个脚本 beat 的包装字段 |
| 有声视频效果 | `CoffeeLaunchShort` 渲染冷萃杯、液体倒入、冰块、通勤场景、动态字幕、WebGL 漏光、运动模糊、颗粒层和合成音频床，并用 `video:check` 验证音画指标 | `npm run video:render -- --composition CoffeeLaunchShort` / `npm run video:check` |
| 多版本生成 | 稳妥转化版、强 Hook 版、内容种草版 | 版本切换按钮 |
| 人工可调 | 自然语言编辑当前方案 | “自然语言编辑” |
| 评分证据矩阵 | 导出 Markdown 自动列出每个评分项、当前证据和验收口径 | “完整项目稿预览” / Markdown 导出 |

## 推荐录屏脚本

1. 打开首页，选择“学习平板”预设，因为它自带素材缺口，适合展示补全能力。
2. 点击“拆解样例结构”，先展示“结构指纹”，讲清楚系统不是复刻视频，而是把 Hook 强度、镜头密度、字幕密度、证据位置、CTA 位置和包装标签抽成可迁移规则。
3. 在“迁移 Brief”处指出系统会先检索剪辑技巧库，而不是直接生成文案。
4. 点击“生成迁移方案”，先展示“RAG 技巧库”命中结果，再展示三版本脚本。
5. 展示“大奖目标看板”，说明系统把拿奖目标拆成结构迁移、RAG 可解释、成片可执行、现场可控和上交证据。
6. 展示“手法迁移配方”，逐段指出源样例时间段如何迁移到新片段，以及字幕密度、转场倾向、beat 强度和素材状态如何继承。
7. 停留在“素材缺口与补全”，先讲真实素材资产盘点，再指出缺少对比/结果镜头和 CTA 镜头时，系统给出包装补全和素材复用策略。
8. 展示“时间线草案”，说明脚本已经按秒拆成可生产时间线。
9. 展示“竖屏分镜预览”，说明系统已经把每段转成画面层、字幕层、包装层和素材状态。
10. 播放 Remotion 导出的高质量有声成片，说明方案已经能被验证为字幕、画面包装、素材补全和节奏组合。
11. 展示“迁移映射”，说明每段新脚本如何继承样例规则，以及素材缺口怎么被处理。
12. 展示“质量诊断”，用综合评分和推荐版本回答为什么这个方案可上交。
13. 在自然语言编辑里输入“开头更抓人一些，并补充可信证据”，展示方案可被人工协同调整。
14. 点击 Markdown 导出，说明导出稿包含样例-结果对比、素材资产、评分证据矩阵，可进入 Obsidian、剪辑协作或二期视频合成链路。

## 安全与合规

- 不提交 `.env`、API Key、数据库、上传素材和构建产物。
- 样例只迁移结构方法，不复刻人物、台词、品牌表达或具体镜头。
- 背书、评价、参数和数据必须真实可追溯；系统会在风险提示中保留提醒。
- 若使用真实模型服务，密钥只放在服务端环境变量，不暴露到前端。

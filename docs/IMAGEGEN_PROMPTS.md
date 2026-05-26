# AIGC 视觉素材提示词

本项目用图像生成工具补封面和素材缺口，但不让图像工具决定视频结构。生成图只进入 `RenderTimeline.visualLayers` 的素材槽位，结构迁移、缺口判断和渲染节奏仍由项目协议控制。

## 主封面图

用途：答辩 PPT、README 首图、视频封面。

```text
Use case: ads-marketing
Asset type: vertical short-video cover image, 1080x1920
Primary request: Create a polished cover image for an AI short-video creation platform named "爆款结构迁移引擎".
Scene/backdrop: a creator desk with a vertical video preview, timeline blocks, subtitle cards, and material-slot markers.
Subject: the product interface as a high-end software workflow, not a generic robot.
Composition: leave clean space in the upper third for the title "爆款结构迁移引擎"; keep the video preview readable in the center.
Style: premium Chinese tech demo, sharp UI details, cinematic but practical lighting, no fake brand logos, no watermark.
Avoid: random abstract blobs, unreadable tiny text, human faces, copied Douyin/CapCut logos, exaggerated sci-fi elements.
```

## 素材缺口补图：商品特写

用途：当用户缺少商品/主体特写时，作为 `hero` 槽位的临时画面。

```text
Use case: product-mockup
Asset type: vertical video insert still, 1080x1920
Primary request: Create a clean product close-up placeholder for an educational learning tablet.
Scene/backdrop: bright study desk, tablet screen showing abstract learning cards without real app logos.
Subject: tablet device, stylus, notebook, soft desk light.
Composition: tablet centered, generous top and bottom safe area for subtitles.
Style: realistic product photography, crisp edges, modern Chinese family education context.
Avoid: readable brand names, real app UI, children faces, cluttered desk, watermark.
```

## 素材缺口补图：对比结果

用途：当用户缺少 Before/After 或效果截图时，作为 `comparison` 槽位的包装补全画面。

```text
Use case: infographic-diagram
Asset type: vertical split-screen result card, 1080x1920
Primary request: Create a before-and-after study workflow comparison card.
Scene/backdrop: left side shows messy homework workflow, right side shows organized learning plan.
Subject: abstract icons and cards only; no real people or brand UI.
Composition: clear split line in the middle, large empty caption area at the bottom.
Style: clean editorial infographic, high contrast, readable shapes, suitable for short-video overlay.
Avoid: tiny unreadable text, fake numbers, brand logos, overly cute stickers, watermark.
```

## 素材缺口补图：CTA 结尾

用途：当用户缺少购买入口或行动镜头时，作为 `cta` 槽位的结尾定格。

```text
Use case: ads-marketing
Asset type: vertical CTA ending card, 1080x1920
Primary request: Create a conversion ending visual for a learning tablet recommendation video.
Scene/backdrop: elegant dark-to-light product stage with a tablet silhouette and clean space for CTA text.
Subject: tablet silhouette, subtle learning cards, no real store page or QR code.
Composition: product in lower half, strong blank area in upper half for copy.
Style: premium, trustworthy, restrained motion-graphics look.
Avoid: fake discounts, fake reviews, QR codes, brand logos, watermark.
```

## 使用边界

- 生成图必须标记为 AIGC 或占位素材，最终商业发布前应替换成真实素材或可授权素材。
- 生成图不能伪造用户反馈、测评数据、证书、真实购买入口。
- 生成图不能复刻样例视频中的人物、品牌、镜头构图或具体台词。
- 生成图只补表达缺口，不能绕过 `VideoStructureAnalysis`、`MigratedVideoPlan` 和 `RenderTimeline` 的结构校验。

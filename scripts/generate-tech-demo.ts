/**
 * 生成科技风格演示视频
 * 展示新的视觉效果系统
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const compositionId = "TechDemo";
const outputLocation = path.join(process.cwd(), "outputs", "tech-demo.mp4");

async function generateTechDemo() {
  console.log("🚀 开始生成科技风格演示视频...\n");

  // 确保输出目录存在
  const outputDir = path.dirname(outputLocation);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 视频配置
  const inputProps = {
    style: "tech",
    scenes: [
      {
        id: "scene1",
        duration: 3,
        type: "hook",
        content: {
          title: "未来，就在你的手腕上",
          subtitle: "",
        },
        visual: {
          background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
          effects: ["glow", "scanlines"],
          animation: "glitch-in",
        },
      },
      {
        id: "scene2",
        duration: 5,
        type: "product",
        content: {
          title: "AI智能手表 X1",
          subtitle: "重新定义智能穿戴",
        },
        visual: {
          background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
          effects: ["glow", "vignette", "particles"],
          animation: "fade-slide-up",
        },
      },
      {
        id: "scene3",
        duration: 4,
        type: "features",
        content: {
          title: "7天续航 | 健康监测 | 智能助手",
          subtitle: "",
        },
        visual: {
          background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
          effects: ["glow", "scanlines", "grain"],
          animation: "glitch-in",
        },
      },
      {
        id: "scene4",
        duration: 3,
        type: "cta",
        content: {
          title: "立即预订",
          subtitle: "享受早鸟优惠",
        },
        visual: {
          background: "linear-gradient(135deg, #00D9FF 0%, #667eea 100%)",
          effects: ["glow", "particles"],
          animation: "bounce-in",
        },
      },
    ],
    transitions: [
      { type: "glitch", duration: 0.3 },
      { type: "slide", duration: 0.4, direction: "left" },
      { type: "glitch", duration: 0.3 },
    ],
    audio: {
      bgm: null, // 可选：添加背景音乐
      volume: 0.7,
    },
  };

  try {
    console.log("📦 正在打包 Remotion 项目...");
    const bundleLocation = await bundle({
      entryPoint: path.join(process.cwd(), "src", "remotion", "index.ts"),
      webpackOverride: (config) => config,
    });

    console.log("✅ 打包完成！");
    console.log("🎬 开始渲染视频...\n");

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    console.log(`📹 视频配置:`);
    console.log(`   - 分辨率: ${composition.width}x${composition.height}`);
    console.log(`   - 帧率: ${composition.fps} fps`);
    console.log(`   - 时长: ${composition.durationInFrames / composition.fps}秒`);
    console.log(`   - 风格: tech (科技风格)`);
    console.log(`   - 特效: 发光、扫描线、颗粒、暗角\n`);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation,
      inputProps,
      onProgress: ({ progress, renderedFrames }) => {
        const percent = (progress * 100).toFixed(1);
        process.stdout.write(
          `\r⏳ 渲染进度: ${percent}% (${renderedFrames}/${composition.durationInFrames} 帧)`
        );
      },
    });

    console.log("\n\n✨ 视频生成成功！");
    console.log(`📁 输出位置: ${outputLocation}`);
    console.log(`📊 文件大小: ${(fs.statSync(outputLocation).size / 1024 / 1024).toFixed(2)} MB`);
    console.log("\n🎉 你可以打开视频查看效果了！");
  } catch (error) {
    console.error("\n❌ 生成失败:", error);
    process.exit(1);
  }
}

// 运行
generateTechDemo();

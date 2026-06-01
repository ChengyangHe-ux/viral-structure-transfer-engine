/**
 * 增强的视频样式配置
 * 提供多种视觉风格预设，用于生成高质量短视频
 */

export type VideoStylePreset = "commercial" | "tech" | "lifestyle" | "minimal" | "energetic";

export interface VideoStyleConfig {
  background: string;
  accentColor: string;
  textColor: string;
  subtitleStyle: SubtitleStyleConfig;
  transitionStyle: TransitionStyleConfig;
  effects: EffectsConfig;
}

export interface SubtitleStyleConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textShadow: string;
  stroke?: string;
  strokeWidth?: number;
  background?: string;
  padding?: string;
  borderRadius?: string;
  animation: "bounce-in" | "fade-slide-up" | "glitch-in" | "scale-in" | "none";
}

export interface TransitionStyleConfig {
  type: "fade" | "slide" | "wipe" | "zoom" | "glitch";
  duration: number;
  easing: string;
}

export interface EffectsConfig {
  glow: boolean;
  particles: boolean;
  scanlines: boolean;
  vignette: boolean;
  grain: boolean;
  lightLeaks: boolean;
}

/**
 * 视觉风格预设
 */
export const VIDEO_STYLE_PRESETS: Record<VideoStylePreset, VideoStyleConfig> = {
  commercial: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    accentColor: "#FF6B6B",
    textColor: "#FFFFFF",
    subtitleStyle: {
      fontFamily: "'Inter', 'PingFang SC', sans-serif",
      fontSize: 72,
      fontWeight: 900,
      textShadow: "0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)",
      stroke: "#000000",
      strokeWidth: 4,
      animation: "bounce-in",
    },
    transitionStyle: {
      type: "slide",
      duration: 0.4,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    },
    effects: {
      glow: true,
      particles: true,
      scanlines: false,
      vignette: true,
      grain: false,
      lightLeaks: true,
    },
  },

  tech: {
    background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
    accentColor: "#00D9FF",
    textColor: "#FFFFFF",
    subtitleStyle: {
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: 64,
      fontWeight: 800,
      textShadow: "0 0 20px rgba(0, 217, 255, 0.8), 0 4px 8px rgba(0,0,0,0.5)",
      animation: "glitch-in",
    },
    transitionStyle: {
      type: "glitch",
      duration: 0.3,
      easing: "steps(4, end)",
    },
    effects: {
      glow: true,
      particles: false,
      scanlines: true,
      vignette: true,
      grain: true,
      lightLeaks: false,
    },
  },

  lifestyle: {
    background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    accentColor: "#FFD93D",
    textColor: "#FFFFFF",
    subtitleStyle: {
      fontFamily: "'Poppins', 'PingFang SC', sans-serif",
      fontSize: 68,
      fontWeight: 700,
      textShadow: "0 4px 16px rgba(245, 87, 108, 0.6), 0 2px 4px rgba(0,0,0,0.3)",
      background: "rgba(255, 255, 255, 0.1)",
      padding: "8px 16px",
      borderRadius: "12px",
      animation: "fade-slide-up",
    },
    transitionStyle: {
      type: "fade",
      duration: 0.5,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    },
    effects: {
      glow: true,
      particles: true,
      scanlines: false,
      vignette: false,
      grain: false,
      lightLeaks: true,
    },
  },

  minimal: {
    background: "linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)",
    accentColor: "#2D3748",
    textColor: "#1A202C",
    subtitleStyle: {
      fontFamily: "'Inter', 'PingFang SC', sans-serif",
      fontSize: 56,
      fontWeight: 600,
      textShadow: "0 2px 4px rgba(0,0,0,0.1)",
      animation: "scale-in",
    },
    transitionStyle: {
      type: "fade",
      duration: 0.6,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    },
    effects: {
      glow: false,
      particles: false,
      scanlines: false,
      vignette: false,
      grain: false,
      lightLeaks: false,
    },
  },

  energetic: {
    background: "linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 50%, #2BFF88 100%)",
    accentColor: "#FF3CAC",
    textColor: "#FFFFFF",
    subtitleStyle: {
      fontFamily: "'Montserrat', 'PingFang SC', sans-serif",
      fontSize: 76,
      fontWeight: 900,
      textShadow: "0 6px 20px rgba(255, 60, 172, 0.8), 0 3px 6px rgba(0,0,0,0.5)",
      stroke: "#000000",
      strokeWidth: 5,
      animation: "bounce-in",
    },
    transitionStyle: {
      type: "zoom",
      duration: 0.35,
      easing: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    },
    effects: {
      glow: true,
      particles: true,
      scanlines: false,
      vignette: false,
      grain: false,
      lightLeaks: true,
    },
  },
};

/**
 * 根据内容类型自动选择合适的风格
 */
export function selectStyleByContent(content: string): VideoStylePreset {
  const lowerContent = content.toLowerCase();

  if (/科技|tech|ai|数字|智能|未来/.test(lowerContent)) {
    return "tech";
  }

  if (/生活|美食|旅行|时尚|lifestyle/.test(lowerContent)) {
    return "lifestyle";
  }

  if (/商业|产品|营销|广告|commercial/.test(lowerContent)) {
    return "commercial";
  }

  if (/简约|极简|minimal|clean/.test(lowerContent)) {
    return "minimal";
  }

  if (/活力|运动|音乐|派对|energetic/.test(lowerContent)) {
    return "energetic";
  }

  return "commercial"; // 默认商业风格
}

/**
 * 字幕动画关键帧
 */
export const SUBTITLE_ANIMATIONS = {
  "bounce-in": {
    from: { opacity: 0, transform: "scale(0.3) translateY(20px)" },
    to: { opacity: 1, transform: "scale(1) translateY(0)" },
  },
  "fade-slide-up": {
    from: { opacity: 0, transform: "translateY(30px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
  "glitch-in": {
    "0%": { opacity: 0, transform: "translateX(-10px)" },
    "20%": { opacity: 0.5, transform: "translateX(10px)" },
    "40%": { opacity: 0.8, transform: "translateX(-5px)" },
    "60%": { opacity: 0.9, transform: "translateX(5px)" },
    "100%": { opacity: 1, transform: "translateX(0)" },
  },
  "scale-in": {
    from: { opacity: 0, transform: "scale(0.8)" },
    to: { opacity: 1, transform: "scale(1)" },
  },
  none: {
    from: { opacity: 1 },
    to: { opacity: 1 },
  },
};

/**
 * 颜色工具函数
 */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 根据焦点类型获取强调色
 */
export function getAccentColorByFocus(focus: string): string {
  const focusColors: Record<string, string> = {
    Hook: "#FF6B6B",
    证据: "#4ECDC4",
    收益: "#FFD93D",
    CTA: "#FF3CAC",
    包装: "#A78BFA",
    推进: "#60A5FA",
  };

  return focusColors[focus] || "#667eea";
}

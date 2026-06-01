import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, random } from "remotion";

/**
 * 发光效果组件
 */
export const GlowEffect: React.FC<{
  color: string;
  intensity?: number;
}> = ({ color, intensity = 0.5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = Math.sin((frame / fps) * Math.PI * 2) * 0.3 + 0.7;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, ${color}${Math.floor(intensity * pulse * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
        pointerEvents: "none",
        mixBlendMode: "screen",
      }}
    />
  );
};

/**
 * 粒子效果组件
 */
export const ParticleEffect: React.FC<{
  count?: number;
  color?: string;
  size?: number;
}> = ({ count = 50, color = "#ffffff", size = 4 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const particles = Array.from({ length: count }, (_, i) => {
    const seed = i * 1000;
    const x = random(seed) * width;
    const y = random(seed + 1) * height;
    const speed = random(seed + 2) * 2 + 0.5;
    const delay = random(seed + 3) * 60;

    const currentY = ((y + (frame - delay) * speed) % (height + 100)) - 100;
    const opacity = interpolate(
      currentY,
      [-100, 0, height, height + 100],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    return { x, y: currentY, opacity, size: size * (0.5 + random(seed + 4) * 0.5) };
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {particles.map((particle, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            borderRadius: "50%",
            background: color,
            opacity: particle.opacity,
            boxShadow: `0 0 ${particle.size * 2}px ${color}`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/**
 * 扫描线效果
 */
export const ScanlinesEffect: React.FC<{
  opacity?: number;
  lineHeight?: number;
}> = ({ opacity = 0.1, lineHeight = 2 }) => {
  return (
    <AbsoluteFill
      style={{
        background: `repeating-linear-gradient(
          0deg,
          rgba(0, 0, 0, ${opacity}) 0px,
          transparent ${lineHeight}px,
          transparent ${lineHeight * 2}px,
          rgba(0, 0, 0, ${opacity}) ${lineHeight * 2}px
        )`,
        pointerEvents: "none",
        mixBlendMode: "multiply",
      }}
    />
  );
};

/**
 * 暗角效果
 */
export const VignetteEffect: React.FC<{
  intensity?: number;
}> = ({ intensity = 0.5 }) => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, ${intensity}) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * 颗粒噪点效果
 */
export const GrainEffect: React.FC<{
  opacity?: number;
}> = ({ opacity = 0.05 }) => {
  const frame = useCurrentFrame();

  // 使用 CSS filter 创建噪点效果
  return (
    <AbsoluteFill
      style={{
        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        opacity,
        pointerEvents: "none",
        mixBlendMode: "overlay",
        animation: `grain-animation ${frame % 2 === 0 ? "0.1s" : "0.2s"} infinite`,
      }}
    />
  );
};

/**
 * 光漏效果
 */
export const LightLeaksEffect: React.FC<{
  color?: string;
  intensity?: number;
}> = ({ color = "#ff6b6b", intensity = 0.3 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = (frame / fps) % 3;
  const opacity = interpolate(progress, [0, 1, 2, 3], [0, intensity, intensity, 0]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 20% 30%, ${color} 0%, transparent 50%)`,
        opacity,
        pointerEvents: "none",
        mixBlendMode: "screen",
      }}
    />
  );
};

/**
 * 渐变背景组件
 */
export const GradientBackground: React.FC<{
  gradient: string;
  animated?: boolean;
}> = ({ gradient, animated = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rotation = animated ? (frame / fps) * 10 : 0;

  return (
    <AbsoluteFill
      style={{
        background: gradient,
        transform: `rotate(${rotation}deg) scale(1.2)`,
        transformOrigin: "center",
      }}
    />
  );
};

/**
 * 动态网格背景
 */
export const GridBackground: React.FC<{
  color?: string;
  size?: number;
  opacity?: number;
}> = ({ color = "#667eea", size = 50, opacity = 0.1 }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `
          linear-gradient(${color} 1px, transparent 1px),
          linear-gradient(90deg, ${color} 1px, transparent 1px)
        `,
        backgroundSize: `${size}px ${size}px`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * 脉冲圆环效果
 */
export const PulseRingEffect: React.FC<{
  color?: string;
  position?: { x: number; y: number };
}> = ({ color = "#667eea", position = { x: 50, y: 50 } }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = (frame / fps) % 2;
  const scale = interpolate(progress, [0, 2], [0, 3]);
  const opacity = interpolate(progress, [0, 1, 2], [0.8, 0.4, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: 100,
        height: 100,
        borderRadius: "50%",
        border: `4px solid ${color}`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * 组合特效容器
 */
export const EffectsContainer: React.FC<{
  children: React.ReactNode;
  effects: {
    glow?: boolean;
    particles?: boolean;
    scanlines?: boolean;
    vignette?: boolean;
    grain?: boolean;
    lightLeaks?: boolean;
  };
  accentColor?: string;
}> = ({ children, effects, accentColor = "#667eea" }) => {
  return (
    <AbsoluteFill>
      {children}
      {effects.glow && <GlowEffect color={accentColor} intensity={0.3} />}
      {effects.particles && <ParticleEffect color={accentColor} count={30} />}
      {effects.scanlines && <ScanlinesEffect opacity={0.05} />}
      {effects.vignette && <VignetteEffect intensity={0.4} />}
      {effects.grain && <GrainEffect opacity={0.03} />}
      {effects.lightLeaks && <LightLeaksEffect color={accentColor} intensity={0.2} />}
    </AbsoluteFill>
  );
};

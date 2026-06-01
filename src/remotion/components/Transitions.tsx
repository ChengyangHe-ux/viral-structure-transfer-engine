import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export type TransitionType = "fade" | "slide" | "wipe" | "zoom" | "glitch" | "dissolve";

export interface TransitionProps {
  type: TransitionType;
  durationFrames: number;
  direction?: "left" | "right" | "up" | "down";
  children: React.ReactNode;
}

/**
 * 淡入淡出转场
 */
export const FadeTransition: React.FC<{
  progress: number;
  children: React.ReactNode;
}> = ({ progress, children }) => {
  return (
    <AbsoluteFill style={{ opacity: progress }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * 滑动转场
 */
export const SlideTransition: React.FC<{
  progress: number;
  direction: "left" | "right" | "up" | "down";
  children: React.ReactNode;
}> = ({ progress, direction, children }) => {
  const getTransform = () => {
    const distance = (1 - progress) * 100;
    switch (direction) {
      case "left":
        return `translateX(-${distance}%)`;
      case "right":
        return `translateX(${distance}%)`;
      case "up":
        return `translateY(-${distance}%)`;
      case "down":
        return `translateY(${distance}%)`;
    }
  };

  return (
    <AbsoluteFill style={{ transform: getTransform() }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * 擦除转场
 */
export const WipeTransition: React.FC<{
  progress: number;
  direction: "left" | "right" | "up" | "down";
  children: React.ReactNode;
}> = ({ progress, direction, children }) => {
  const getClipPath = () => {
    const percent = progress * 100;
    switch (direction) {
      case "left":
        return `inset(0 ${100 - percent}% 0 0)`;
      case "right":
        return `inset(0 0 0 ${100 - percent}%)`;
      case "up":
        return `inset(${100 - percent}% 0 0 0)`;
      case "down":
        return `inset(0 0 ${100 - percent}% 0)`;
    }
  };

  return (
    <AbsoluteFill style={{ clipPath: getClipPath() }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * 缩放转场
 */
export const ZoomTransition: React.FC<{
  progress: number;
  zoomIn?: boolean;
  children: React.ReactNode;
}> = ({ progress, zoomIn = true, children }) => {
  const scale = zoomIn
    ? interpolate(progress, [0, 1], [0.5, 1])
    : interpolate(progress, [0, 1], [1.5, 1]);

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        opacity: progress,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * 故障转场
 */
export const GlitchTransition: React.FC<{
  progress: number;
  children: React.ReactNode;
}> = ({ progress, children }) => {
  const frame = useCurrentFrame();

  // 创建故障效果
  const glitchIntensity = progress < 0.5 ? (1 - progress * 2) : 0;
  const offsetX = Math.sin(frame * 0.5) * glitchIntensity * 20;
  const offsetY = Math.cos(frame * 0.3) * glitchIntensity * 10;

  return (
    <>
      {/* 红色通道 */}
      <AbsoluteFill
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          opacity: progress * glitchIntensity * 0.5,
          mixBlendMode: "screen",
          filter: "brightness(1.5) contrast(1.2)",
        }}
      >
        <div style={{ filter: "sepia(1) hue-rotate(-50deg)" }}>
          {children}
        </div>
      </AbsoluteFill>

      {/* 蓝色通道 */}
      <AbsoluteFill
        style={{
          transform: `translate(${-offsetX}px, ${-offsetY}px)`,
          opacity: progress * glitchIntensity * 0.5,
          mixBlendMode: "screen",
          filter: "brightness(1.5) contrast(1.2)",
        }}
      >
        <div style={{ filter: "sepia(1) hue-rotate(180deg)" }}>
          {children}
        </div>
      </AbsoluteFill>

      {/* 主内容 */}
      <AbsoluteFill style={{ opacity: progress }}>
        {children}
      </AbsoluteFill>
    </>
  );
};

/**
 * 溶解转场
 */
export const DissolveTransition: React.FC<{
  progress: number;
  children: React.ReactNode;
}> = ({ progress, children }) => {
  // 创建像素化溶解效果
  const pixelSize = Math.max(1, Math.floor((1 - progress) * 20));

  return (
    <AbsoluteFill
      style={{
        opacity: progress,
        filter: `blur(${(1 - progress) * 5}px)`,
        imageRendering: pixelSize > 1 ? "pixelated" : "auto",
        transform: `scale(${1 + (1 - progress) * 0.1})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * 通用转场组件
 */
export const Transition: React.FC<TransitionProps> = ({
  type,
  durationFrames,
  direction = "right",
  children,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [0, durationFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  switch (type) {
    case "fade":
      return <FadeTransition progress={progress}>{children}</FadeTransition>;
    case "slide":
      return <SlideTransition progress={progress} direction={direction}>{children}</SlideTransition>;
    case "wipe":
      return <WipeTransition progress={progress} direction={direction}>{children}</WipeTransition>;
    case "zoom":
      return <ZoomTransition progress={progress}>{children}</ZoomTransition>;
    case "glitch":
      return <GlitchTransition progress={progress}>{children}</GlitchTransition>;
    case "dissolve":
      return <DissolveTransition progress={progress}>{children}</DissolveTransition>;
    default:
      return <FadeTransition progress={progress}>{children}</FadeTransition>;
  }
};

/**
 * 场景转场包装器
 */
export const SceneWithTransition: React.FC<{
  children: React.ReactNode;
  transitionIn?: TransitionType;
  transitionOut?: TransitionType;
  transitionDuration?: number;
  sceneDuration: number;
}> = ({
  children,
  transitionIn = "fade",
  transitionOut = "fade",
  transitionDuration = 15,
  sceneDuration,
}) => {
  const frame = useCurrentFrame();

  // 入场转场
  if (frame < transitionDuration) {
    return (
      <Transition type={transitionIn} durationFrames={transitionDuration}>
        {children}
      </Transition>
    );
  }

  // 出场转场
  if (frame > sceneDuration - transitionDuration) {
    const exitFrame = frame - (sceneDuration - transitionDuration);
    const exitProgress = 1 - interpolate(
      exitFrame,
      [0, transitionDuration],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const exitOffset = interpolate(
      exitFrame,
      [0, transitionDuration],
      [0, 100],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const exitStyle: React.CSSProperties =
      transitionOut === "slide"
        ? { opacity: exitProgress, transform: `translateX(-${exitOffset}%)` }
        : transitionOut === "wipe"
          ? { clipPath: `inset(0 0 0 ${exitOffset}%)` }
          : transitionOut === "zoom"
            ? { opacity: exitProgress, transform: `scale(${1 + exitOffset / 500})` }
            : transitionOut === "glitch"
              ? {
                  opacity: exitProgress,
                  filter: `contrast(${1 + exitOffset / 100}) saturate(${1 + exitOffset / 80})`,
                  transform: `translateX(${Math.sin(exitFrame * 0.7) * exitOffset * 0.08}px)`,
                }
              : { opacity: exitProgress };

    return (
      <AbsoluteFill style={exitStyle}>
        {children}
      </AbsoluteFill>
    );
  }

  // 正常显示
  return <>{children}</>;
};

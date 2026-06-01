import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { SubtitleStyleConfig } from "../enhanced-video-styles";

export interface EnhancedSubtitleProps {
  text: string;
  children?: React.ReactNode;
  style: SubtitleStyleConfig;
  startFrame: number;
  durationFrames: number;
  emphasis?: boolean;
  position?: "top" | "center" | "bottom";
}

export const EnhancedSubtitle: React.FC<EnhancedSubtitleProps> = ({
  text,
  children,
  style,
  startFrame,
  durationFrames,
  emphasis = false,
  position = "bottom",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  // 动画进度
  const progress = spring({
    frame: localFrame,
    fps,
    config: {
      damping: 200,
      stiffness: 100,
      mass: 0.5,
    },
  });

  // 退出动画
  const exitProgress = interpolate(
    localFrame,
    [durationFrames - 10, durationFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const opacity = Math.min(progress, exitProgress);

  // 根据动画类型计算变换
  const getTransform = () => {
    if (style.animation === "bounce-in") {
      const scale = interpolate(progress, [0, 1], [0.3, 1]);
      const translateY = interpolate(progress, [0, 1], [20, 0]);
      return `scale(${scale}) translateY(${translateY}px)`;
    }

    if (style.animation === "fade-slide-up") {
      const translateY = interpolate(progress, [0, 1], [30, 0]);
      return `translateY(${translateY}px)`;
    }

    if (style.animation === "glitch-in") {
      const glitchX = localFrame < 20
        ? Math.sin(localFrame * 0.5) * 10 * (1 - progress)
        : 0;
      return `translateX(${glitchX}px)`;
    }

    if (style.animation === "scale-in") {
      const scale = interpolate(progress, [0, 1], [0.8, 1]);
      return `scale(${scale})`;
    }

    return "none";
  };

  // 位置样式
  const positionStyles: Record<typeof position, React.CSSProperties> = {
    top: {
      top: "10%",
      left: "50%",
      transform: `translateX(-50%) ${getTransform()}`,
    },
    center: {
      top: "50%",
      left: "50%",
      transform: `translate(-50%, -50%) ${getTransform()}`,
    },
    bottom: {
      bottom: "15%",
      left: "50%",
      transform: `translateX(-50%) ${getTransform()}`,
    },
  };

  // 强调效果
  const emphasisStyle: React.CSSProperties = emphasis
    ? {
        animation: "pulse 1s ease-in-out infinite",
        filter: "brightness(1.2)",
      }
    : {};

  // 描边效果
  const strokeStyle: React.CSSProperties = style.stroke
    ? {
        WebkitTextStroke: `${style.strokeWidth || 2}px ${style.stroke}`,
        paintOrder: "stroke fill",
      }
    : {};

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles[position],
        opacity,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: "white",
        textAlign: "center",
        textShadow: style.textShadow,
        maxWidth: "90%",
        padding: style.padding || "0",
        background: style.background || "transparent",
        borderRadius: style.borderRadius || "0",
        backdropFilter: style.background ? "blur(10px)" : "none",
        zIndex: 100,
        ...strokeStyle,
        ...emphasisStyle,
      }}
    >
      {children ?? text}
    </div>
  );
};

/**
 * 逐字显示的字幕组件
 */
export interface TypewriterSubtitleProps extends EnhancedSubtitleProps {
  charactersPerFrame?: number;
}

export const TypewriterSubtitle: React.FC<TypewriterSubtitleProps> = ({
  text,
  charactersPerFrame = 2,
  ...props
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - props.startFrame;

  const visibleCharacters = Math.min(
    Math.floor(localFrame * charactersPerFrame),
    text.length
  );

  const visibleText = text.slice(0, visibleCharacters);

  return <EnhancedSubtitle {...props} text={visibleText} />;
};

/**
 * 分行显示的字幕组件
 */
export interface MultiLineSubtitleProps extends Omit<EnhancedSubtitleProps, "text"> {
  lines: string[];
  lineDelay?: number;
}

export const MultiLineSubtitle: React.FC<MultiLineSubtitleProps> = ({
  lines,
  lineDelay = 5,
  ...props
}) => {
  const frame = useCurrentFrame();

  return (
    <>
      {lines.map((line, index) => {
        const lineStartFrame = props.startFrame + index * lineDelay;
        const lineVisible = frame >= lineStartFrame;

        if (!lineVisible) return null;

        return (
          <EnhancedSubtitle
            key={index}
            {...props}
            text={line}
            startFrame={lineStartFrame}
            style={{
              ...props.style,
              fontSize: props.style.fontSize * 0.9,
            }}
            position={index === 0 ? "center" : "bottom"}
          />
        );
      })}
    </>
  );
};

/**
 * 带高亮关键词的字幕组件
 */
export interface HighlightSubtitleProps extends EnhancedSubtitleProps {
  highlightWords?: string[];
  highlightColor?: string;
}

export const HighlightSubtitle: React.FC<HighlightSubtitleProps> = ({
  text,
  highlightWords = [],
  highlightColor = "#FFD93D",
  ...props
}) => {
  const renderTextWithHighlights = () => {
    if (highlightWords.length === 0) {
      return text;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    highlightWords.forEach((word) => {
      const index = text.indexOf(word, lastIndex);
      if (index !== -1) {
        // 添加普通文本
        if (index > lastIndex) {
          parts.push(text.slice(lastIndex, index));
        }
        // 添加高亮文本
        parts.push(
          <span
            key={index}
            style={{
              color: highlightColor,
              fontWeight: 900,
              textShadow: `0 0 20px ${highlightColor}`,
            }}
          >
            {word}
          </span>
        );
        lastIndex = index + word.length;
      }
    });

    // 添加剩余文本
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <EnhancedSubtitle
      {...props}
      text={text}
      style={props.style}
    >
      {renderTextWithHighlights()}
    </EnhancedSubtitle>
  );
};

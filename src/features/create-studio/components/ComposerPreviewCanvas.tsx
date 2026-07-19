/**
 * UI component: ComposerPreviewCanvas.
 *
 * Exports: ComposerPreviewCanvas, fitCanvasFrame
 * Depends on: react
 */

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, ReactElement} from "react";

const CANVAS_ASPECT_RATIO = 9 / 16;

/**
 * Render the ComposerPreviewCanvas UI.
 * @param props - Component props
 * @returns Rendered UI
 */
export function ComposerPreviewCanvas({
  className,
  style,
  children,
  maxHeight,
  onFrameChange,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  maxHeight?: string;
  onFrameChange?: (frame: { width: number; height: number }) => void;
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      const fitted = fitCanvasFrame(width, height, CANVAS_ASPECT_RATIO);
      setFrame((current) =>
        current?.width === fitted.width && current?.height === fitted.height ? current : fitted,
      );
      onFrameChangeRef.current?.(fitted);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 items-stretch justify-start ${className ?? ""}`}
      style={{ ...style, maxHeight }}
    >
      <div
        className="relative shrink-0"
        style={
          frame
            ? { width: frame.width, height: frame.height }
            : { aspectRatio: "9 / 16", height: "100%", width: "auto", maxWidth: "100%" }
        }
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Fit a 9:16 canvas frame inside a container without cropping.
 * @param containerWidth - containerWidth argument
 * @param containerHeight - containerHeight argument
 * @param ratio - ratio argument
 * @returns Computed value
 */
export function fitCanvasFrame(containerWidth: number, containerHeight: number, ratio: number): { width: number; height: number } {
  const heightAtFullWidth = containerWidth / ratio;
  if (heightAtFullWidth <= containerHeight) {
    return { width: containerWidth, height: heightAtFullWidth };
  }
  return { width: containerHeight * ratio, height: containerHeight };
}

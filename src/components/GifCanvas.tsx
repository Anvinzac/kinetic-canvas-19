import { useEffect, useRef, useState } from "react";
import { parseGIF, decompressFrames, type ParsedFrame } from "gifuct-js";

type GifCanvasProps = {
  src: string;
  className?: string;
  paused?: boolean;
};

// Plays a GIF by decoding it with gifuct-js and drawing frames to a <canvas>.
// Instead of letting the browser loop the raw GIF (which snaps from the last
// frame back to the first and produces a visible jump), we drive the frames
// ourselves and ping-pong: forward 0..N-1, then reverse N-2..1, forever. The
// sequence therefore always ends where it began, so the loop seam is seamless.
export function GifCanvas({
  src,
  className = "absolute inset-0 size-full object-cover",
  paused = false,
}: GifCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [errored, setErrored] = useState(false);

  const stateRef = useRef<{
    frames: ParsedFrame[] | null;
    temp: HTMLCanvasElement | null;
    tempCtx: CanvasRenderingContext2D | null;
    order: number[];
    index: number;
    direction: 1 | -1;
    timer: number | null;
    raf: number | null;
    ready: boolean;
  }>({
    frames: null,
    temp: null,
    tempCtx: null,
    order: [],
    index: 0,
    direction: 1,
    timer: null,
    raf: null,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;
    setErrored(false);
    const s = stateRef.current;
    s.ready = false;
    s.frames = null;
    s.order = [];
    s.index = 0;
    s.direction = 1;
    if (s.timer !== null) {
      clearTimeout(s.timer);
      s.timer = null;
    }

    fetch(src)
      .then((resp) => resp.arrayBuffer())
      .then((buffer) => {
        if (cancelled) return;
        const gif = parseGIF(buffer);
        const frames = decompressFrames(gif, true);
        if (cancelled || frames.length === 0) return;
        s.frames = frames;
        s.temp = document.createElement("canvas");
        s.tempCtx = s.temp.getContext("2d");
        // Forward then reverse (excluding the shared end/start frame) => seamless loop.
        const forward = frames.map((_, i) => i);
        const reverse = frames
          .map((_, i) => i)
          .slice(1, -1)
          .reverse();
        s.order = [...forward, ...reverse];
        s.index = 0;
        s.direction = 1;
        s.ready = true;
        drawCurrent();
        if (!paused) scheduleNext();
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });

    return () => {
      cancelled = true;
      if (s.timer !== null) clearTimeout(s.timer);
      if (s.raf !== null) cancelAnimationFrame(s.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const s = stateRef.current;
    if (s.timer !== null) clearTimeout(s.timer);
    if (paused) return;
    if (s.ready) scheduleNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        drawCurrent();
      }
    };
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  function drawCurrent() {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!s.frames || !s.temp || !s.tempCtx || !canvas) return;
    const frame = s.frames[s.order[s.index]];
    if (!frame) return;

    const { dims, patch, disposalType } = frame;
    const { width, height } = dims;

    if (!s.temp.width) {
      s.temp.width = canvas.width;
      s.temp.height = canvas.height;
    }

    if (disposalType === 2) {
      s.tempCtx.clearRect(0, 0, s.temp.width, s.temp.height);
    }

    const imageData = s.tempCtx.createImageData(width, height);
    imageData.data.set(patch);
    s.tempCtx.putImageData(imageData, dims.left, dims.top);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(s.temp, 0, 0, canvas.width, canvas.height);
  }

  function advance() {
    const s = stateRef.current;
    if (s.order.length === 0) return;
    s.index += s.direction;
    if (s.index >= s.order.length) {
      s.index = s.order.length - 2;
      s.direction = -1;
    } else if (s.index < 0) {
      s.index = 1;
      s.direction = 1;
    }
    drawCurrent();
  }

  function scheduleNext() {
    const s = stateRef.current;
    if (!s.frames || s.order.length === 0) return;
    const frame = s.frames[s.order[s.index]];
    const delay = Math.max(frame?.delay ?? 100, 20);
    s.timer = window.setTimeout(() => {
      advance();
      scheduleNext();
    }, delay);
  }

  if (errored) {
    // Fall back to a native <img> so the backdrop still shows something.
    return <img src={src} alt="" className={className} draggable={false} />;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ transformOrigin: "center center" }}
    />
  );
}

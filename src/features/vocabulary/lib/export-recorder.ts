/**
 * Record one on-screen element to a video file at an exact frame size.
 *
 * The card is DOM and CSS — springs, masks, blends — so there is no way to redraw
 * its frames anywhere but in the browser that is already drawing them. The clip is
 * therefore captured: the tab is shared with itself, every captured frame is
 * cropped to the stage element and drawn onto a canvas of the output size, and that
 * canvas is what gets encoded. The result is exactly the preset's dimensions no
 * matter how large the stage happens to be on this screen.
 *
 * It records in real time: a 35-second word takes 35 seconds.
 *
 * Exports: startStageRecording, StageRecording, canRecordStage
 * Depends on: browser Screen Capture, Canvas and MediaRecorder APIs
 */

export type StageRecordingOptions = {
  /** Element to record; it must stay on screen and uncovered for the whole take. */
  stage: HTMLElement;
  /** Output frame size in pixels. */
  width: number;
  height: number;
  fps: number;
  mimeType: string;
  /** Ask for the tab's audio as well (the reader must also tick it in the prompt). */
  withAudio: boolean;
  /** Called if the capture ends on its own, e.g. the reader pressed "Stop sharing". */
  onInterrupted?: () => void;
  /**
   * Source of the tab's pixels. Defaults to sharing the current tab; a test can pass
   * any stream whose frames cover the viewport.
   */
  acquire?: () => Promise<MediaStream>;
};

export type StageRecording = {
  /** Whether an audio track made it into the recording. */
  hasAudio: boolean;
  /** Finish the file. @returns The encoded clip */
  stop: () => Promise<Blob>;
  /** Abandon the take and release the capture. */
  cancel: () => void;
};

const VIDEO_BITS_PER_SECOND = 12_000_000;
const AUDIO_BITS_PER_SECOND = 160_000;

/** Whether this browser can share a tab with itself and encode the result. */
export function canRecordStage(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

function shareCurrentTab(fps: number, withAudio: boolean): Promise<MediaStream> {
  // The extra members steer Chrome to offer THIS tab first and to leave the pointer
  // out of the picture. They are hints: a browser that does not know them ignores
  // them, which is why they are not in the DOM typings.
  const constraints = {
    video: { frameRate: { ideal: fps }, cursor: "never", displaySurface: "browser" },
    audio: withAudio,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
  } as unknown as DisplayMediaStreamOptions;
  return navigator.mediaDevices.getDisplayMedia(constraints);
}

/**
 * Start recording the stage. Resolves once frames are flowing, so the caller can
 * begin the animation knowing nothing at its start will be missed.
 * @param options - stage, output size, frame rate, container and audio choice
 * @returns Handles to finish or abandon the take
 */
export async function startStageRecording(options: StageRecordingOptions): Promise<StageRecording> {
  const { stage, width, height, fps, mimeType, withAudio, onInterrupted } = options;
  const source = await (options.acquire ?? (() => shareCurrentTab(fps, withAudio)))();

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = source;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });

  let live = true;
  const release = () => {
    live = false;
    source.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  if (!context) {
    release();
    throw new Error("Canvas is unavailable, so the clip cannot be composed.");
  }
  context.imageSmoothingQuality = "high";

  try {
    await video.play();
  } catch (error) {
    release();
    throw error;
  }

  const draw = () => {
    if (!live) return;
    const frameWidth = video.videoWidth;
    const frameHeight = video.videoHeight;
    if (frameWidth && frameHeight) {
      // A shared tab's frame is its viewport, so the stage's place in the viewport
      // is its place in the frame. Read every frame: the browser's own "sharing this
      // tab" bar resizes the page a moment after capture begins.
      const rect = stage.getBoundingClientRect();
      const scaleX = frameWidth / window.innerWidth;
      const scaleY = frameHeight / window.innerHeight;
      context.drawImage(
        video,
        rect.left * scaleX,
        rect.top * scaleY,
        rect.width * scaleX,
        rect.height * scaleY,
        0,
        0,
        width,
        height,
      );
    }
    schedule();
  };
  // Draw when a captured frame actually arrives where the browser can tell us;
  // otherwise once per display frame.
  const schedule = () => {
    if (!live) return;
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(draw);
    } else {
      requestAnimationFrame(draw);
    }
  };
  draw();

  const audioTracks = source.getAudioTracks();
  const output = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...audioTracks]);
  const recorder = new MediaRecorder(output, {
    mimeType,
    videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    ...(audioTracks.length ? { audioBitsPerSecond: AUDIO_BITS_PER_SECOND } : {}),
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
    recorder.onerror = (event) =>
      reject((event as unknown as { error?: Error }).error ?? new Error("Recording failed"));
  });
  // Swallow the rejection here; `stop()` re-surfaces it to whoever is waiting.
  finished.catch(() => undefined);

  source.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (live) onInterrupted?.();
  });

  recorder.start(250);

  return {
    hasAudio: audioTracks.length > 0,
    stop: async () => {
      if (recorder.state !== "inactive") recorder.stop();
      try {
        return await finished;
      } finally {
        release();
      }
    },
    cancel: () => {
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

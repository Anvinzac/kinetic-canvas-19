/**
 * Render one word to an MP4, headlessly, with no browser automation dependency.
 *
 * This is the prototype that answers the one risky question behind the daily-post idea:
 * does /export/$code, driven by a machine, produce a clip that looks like the real card?
 * Everything after it — uploading to a Page, pushing a TikTok draft, scheduling — is
 * routine once a good file exists.
 *
 * It drives the installed Chrome over the DevTools protocol and captures with
 * Page.startScreencast, rather than the screen-capture path Export Studio uses. That
 * matters: getDisplayMedia wants a permission prompt and a visible tab, which is exactly
 * what an unattended job cannot give it. Screencast asks the browser for the frames it is
 * already compositing, so there is nothing to approve.
 *
 * Deliberately dependency-free: Node's own WebSocket talks CDP, and ffmpeg (already on
 * this machine) assembles the frames. Nothing is added to the app's tree for a tool that
 * belongs in the poster repo eventually.
 *
 * It records in REAL TIME, like Export Studio: a 30-second word takes 30 seconds. Frames
 * arrive irregularly, so each one's own timestamp drives its duration in the concat list
 * and ffmpeg resamples to a constant rate — otherwise the clip drifts out of time with
 * the animation it is supposed to be showing.
 *
 * Usage:
 *   npx tsx scripts/render-export-clip.ts <shareCode> [options]
 *     --preset <id>    export preset (default: tiktok-clear)
 *     --base <url>     app origin (default: http://localhost:5195)
 *     --out <path>     output file (default: ./export-<code>.mp4)
 *     --fps <n>        output frame rate (default: 30)
 *     --max <seconds>  give up if the card never finishes (default: 120)
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { getExportPreset } from "../src/features/vocabulary/lib/export-presets";

/** The frame a preset asks for, read from the app's own table rather than hardcoded. */
function presetSize(id: string): { width: number; height: number } {
  const found = getExportPreset(id);
  return { width: found.width, height: found.height };
}

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEBUG_PORT = 9333;

// ── Arguments ───────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`);
  return at !== -1 && argv[at + 1] ? argv[at + 1]! : fallback;
}
const code = argv.find(
  (a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1]?.startsWith("--") !== true,
);
if (!code) {
  console.error(
    "Usage: npx tsx scripts/render-export-clip.ts <shareCode> [--preset id] [--base url] [--out file]",
  );
  process.exit(1);
}
const preset = flag("preset", "tiktok-clear");
const base = flag("base", "http://localhost:5195");
const out = resolve(flag("out", `./export-${code}.mp4`));
const fps = Number(flag("fps", "30"));
const maxSeconds = Number(flag("max", "120"));

// ── A minimal CDP client over Node's built-in WebSocket ─────────────────────────────────
type Handler = (params: Record<string, unknown>) => void;

class Cdp {
  private socket: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private listeners = new Map<string, Handler[]>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String((event as MessageEvent).data));
      if (message.id !== undefined) {
        const waiter = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (!waiter) return;
        if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
        else waiter.resolve(message.result);
        return;
      }
      for (const handler of this.listeners.get(message.method) ?? []) handler(message.params ?? {});
    });
  }

  static async connect(url: string): Promise<Cdp> {
    const socket = new WebSocket(url);
    await new Promise<void>((ok, fail) => {
      socket.addEventListener("open", () => ok(), { once: true });
      socket.addEventListener("error", () => fail(new Error(`cannot connect to ${url}`)), {
        once: true,
      });
    });
    return new Cdp(socket);
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise<T>((res, rej) =>
      this.pending.set(id, { resolve: res as (v: unknown) => void, reject: rej }),
    );
  }

  on(method: string, handler: Handler): void {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), handler]);
  }

  /** Evaluate an expression in the page and return its JSON value. */
  async evaluate<T>(expression: string): Promise<T> {
    const { result } = await this.send<{ result: { value: T } }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.value;
  }

  close(): void {
    this.socket.close();
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────────────────
const profile = mkdtempSync(join(tmpdir(), "chayla-export-"));
const frames = mkdtempSync(join(tmpdir(), "chayla-frames-"));
let chrome: ReturnType<typeof spawn> | null = null;

async function main() {
  // The frame size is the preset's, read from the page once it loads; the window is sized
  // to it so screencast frames come out at exactly the output resolution.
  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      "--hide-scrollbars",
      "--mute-audio",
      "--force-device-scale-factor=1",
      "--force-color-profile=srgb",
      // The card plays on its own; nothing should wait for a gesture that will never come.
      "--autoplay-policy=no-user-gesture-required",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  // Wait for the DevTools endpoint rather than guessing a delay.
  let targetUrl = "";
  for (let attempt = 0; attempt < 50 && !targetUrl; attempt += 1) {
    try {
      const list = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()) as {
        type: string;
        webSocketDebuggerUrl?: string;
      }[];
      targetUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl ?? "";
    } catch {
      await sleep(200);
    }
  }
  if (!targetUrl) throw new Error("Chrome did not expose a page target");

  const cdp = await Cdp.connect(targetUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // Size the viewport BEFORE loading. The card measures its own box with a ResizeObserver
  // and lays out from those numbers; arriving at one size and being resized to another
  // leaves it laid out for the box it first saw — text low and left, chrome crammed into
  // a corner. Loading straight into the final frame avoids the question entirely.
  const { width: presetWidth, height: presetHeight } = presetSize(preset);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: presetWidth,
    height: presetHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const url = `${base}/export/${code}?preset=${encodeURIComponent(preset)}`;
  console.log(`→ ${url}`);
  await cdp.send("Page.navigate", { url });

  // Wait for the page's own readiness signal — the contract, not a guessed delay.
  let phase = "";
  let size = "";
  for (let attempt = 0; attempt < 150; attempt += 1) {
    phase = (await cdp.evaluate<string>("document.body.dataset.exportPhase || ''")) ?? "";
    if (phase === "ready" || phase === "missing") break;
    await sleep(200);
  }
  if (phase === "missing") throw new Error(`No word has the share code "${code}"`);
  if (phase !== "ready") throw new Error(`page never became ready (phase: "${phase || "none"}")`);

  size = (await cdp.evaluate<string>("document.body.dataset.exportSize || ''")) ?? "";
  const word = await cdp.evaluate<string>("document.body.dataset.exportWord || ''");
  const [width, height] = size.split("x").map(Number);
  if (!width || !height) throw new Error(`page did not report a frame size (got "${size}")`);
  console.log(`  word "${word}" at ${width}×${height}`);

  if (width !== presetWidth || height !== presetHeight) {
    throw new Error(
      `preset "${preset}" is ${presetWidth}×${presetHeight} here but the page reported ${size}`,
    );
  }
  // The page is already at the right size; give the card a moment to have settled on it.
  await sleep(400);

  const captured: { file: string; atMs: number }[] = [];
  const startedAt = Date.now();
  cdp.on("Page.screencastFrame", (params) => {
    const sessionId = params.sessionId as number;
    const data = params.data as string;
    const file = join(frames, `f${String(captured.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(data, "base64"));
    captured.push({ file, atMs: Date.now() - startedAt });
    // Chrome stops sending until each frame is acknowledged.
    void cdp.send("Page.screencastFrameAck", { sessionId });
  });

  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    everyNthFrame: 1,
    maxWidth: width,
    maxHeight: height,
  });
  // Hand the page its cue only once frames are flowing, so the entrance is not already
  // part-way through by the time anything is being recorded.
  await cdp.evaluate(`window.dispatchEvent(new Event("vocab-export-start"))`);

  const deadline = Date.now() + maxSeconds * 1000;
  for (;;) {
    const current = await cdp.evaluate<string>("document.body.dataset.exportPhase || ''");
    if (current === "done") break;
    if (Date.now() > deadline) {
      console.warn(`! card never reported done within ${maxSeconds}s; using what was captured`);
      break;
    }
    await sleep(250);
  }
  await cdp.send("Page.stopScreencast");
  await sleep(200);
  cdp.close();

  if (captured.length < 2) throw new Error(`captured ${captured.length} frames; nothing to encode`);
  const seconds = captured[captured.length - 1]!.atMs / 1000;
  console.log(
    `  ${captured.length} frames over ${seconds.toFixed(1)}s (${(captured.length / seconds).toFixed(1)}/s)`,
  );

  // Each frame shows until the next one arrives. Without this the clip would play at a
  // made-up constant rate and drift away from the animation it is showing.
  const list = captured
    .map((frame, index) => {
      const next = captured[index + 1]?.atMs ?? frame.atMs + 1000 / fps;
      return `file '${frame.file}'\nduration ${((next - frame.atMs) / 1000).toFixed(4)}`;
    })
    .join("\n");
  const listFile = join(frames, "frames.txt");
  // The concat demuxer ignores the last entry's duration unless the file is repeated.
  writeFileSync(listFile, `${list}\nfile '${captured[captured.length - 1]!.file}'\n`);

  console.log("→ encoding");
  const ffmpeg = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-vf",
      `fps=${fps},scale=${width}:${height}:flags=lanczos,format=yuv420p`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-movflags",
      "+faststart",
      out,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  if (ffmpeg.status !== 0)
    throw new Error(`ffmpeg failed:\n${ffmpeg.stderr?.toString().slice(-1500)}`);
  console.log(`✓ ${out}`);
}

main()
  .catch((error) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    chrome?.kill();
    // Chrome keeps writing to its profile for a moment after the signal, and removing the
    // directory out from under it fails with ENOTEMPTY. The clip is already written by
    // now, so a failed cleanup is worth a warning and nothing more.
    await sleep(500);
    for (const directory of [profile, frames]) {
      try {
        rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      } catch {
        console.warn(`! left behind ${directory}`);
      }
    }
  });

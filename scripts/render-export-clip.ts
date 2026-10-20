/**
 * Render one word to an MP4, headlessly, with no browser automation dependency.
 *
 * Two modes, because they capture different things:
 *
 *   feed    (default) the real /feed page as a visitor sees it — toolbar, action bar,
 *           progress, all of it — at a phone-sized viewport, for one whole word. This is
 *           what a promo clip wants: the app, not a cutout of it.
 *   export  the stripped /export/$code frame, chrome removed to the preset's clear zone.
 *           Addressable by share code, for when one specific word is wanted.
 *
 * Everything after this — uploading to a Page, pushing a TikTok draft, scheduling — is
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
 *   npx tsx scripts/render-export-clip.ts                  # one word off the live feed
 *   npx tsx scripts/render-export-clip.ts --mode export T22
 *
 *     --mode <feed|export>  what to record (default: feed)
 *     --base <url>          app origin (default: http://localhost:5195)
 *     --out <path>          output file
 *     --fps <n>             output frame rate (default: 30)
 *     --max <seconds>       give up if the word never finishes (default: 120)
 *   feed mode:
 *     --css <w>x<h>         CSS viewport, phone-sized (default: 405x720)
 *     --side <px>           left/right inset clear of a platform's crop (default: 52)
 *     --scale <n>           device pixel ratio (default: 2.667 — 405×720 → 1080×1920)
 *   export mode:
 *     --preset <id>         export preset (default: tiktok-clear)
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { getExportPreset } from "../src/features/vocabulary/lib/export-presets";
import { DIFFICULTY_CHOICE_KEY } from "../src/features/vocabulary/lib/difficulty-choice";
import { DIFFICULTY_ALL } from "../src/features/vocabulary/lib/difficulty";

/** The frame a preset asks for, read from the app's own table rather than hardcoded. */
function presetSize(id: string): { width: number; height: number } {
  const found = getExportPreset(id);
  return { width: found.width, height: found.height };
}

/** The word on screen, by its position in the stream; 0 when none is. */
const ACTIVE_POSITION = `(() => {
  const mid = innerHeight / 2;
  for (const card of document.querySelectorAll('.vocab-card')) {
    const r = card.getBoundingClientRect();
    if (r.top <= mid && r.bottom >= mid) return Number(card.getAttribute('aria-posinset')) || 0;
  }
  return 0;
})()`;

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
const mode = flag("mode", "feed");
if (mode !== "feed" && mode !== "export") {
  console.error(`--mode must be "feed" or "export" (got "${mode}")`);
  process.exit(1);
}
if (mode === "export" && !code) {
  console.error("export mode needs a share code: --mode export <code>");
  process.exit(1);
}
const preset = flag("preset", "tiktok-clear");
const base = flag("base", "http://localhost:5195");
const fps = Number(flag("fps", "30"));
const maxSeconds = Number(flag("max", "120"));
// A phone-shaped CSS viewport scaled up to the output size, so the app lays itself out the
// way it does on a phone — the layout a viewer recognises — rather than the desktop one it
// would choose at a literal 1080px wide.
const [cssWidth, cssHeight] = flag("css", "405x720").split("x").map(Number);
// How far in from the top and bottom edges the app's own bars are pushed, in CSS pixels.
// Defaults are roughly TikTok's overlay zones at a 405×720 viewport (~8% and ~15%); pass
// 0,0 to record the app exactly as it sits on a phone.
const [insetTop, insetBottom] = flag("inset", "56,110").split(",").map(Number);
// How far in from the LEFT and RIGHT edges, in CSS pixels, and the reason it is not zero:
// a 9:16 clip on a taller phone is scaled to COVER the feed, so the sides are cropped off.
// At 20:9 \u2014 the common case \u2014 that is 12.5% of the width gone from each edge, about 51px
// of a 405px viewport; 21:9 takes 15.6%. Anything anchored to an edge is what disappears
// first, which is why the title and the gear were the casualties.
//
// 31px is a judgement call, not the safe number: it is what clearing the crop outright
// (52px) was traded down to because the clip looked too boxed-in. It keeps the toolbar and
// the rows outside a 19.5:9 crop, leaves them a few pixels inside a 20:9 one, and does not
// save them at 21:9. Raise it towards 52 to buy that back, or pass 0 to record the app
// exactly as a reader sees it.
const insetSide = Number(flag("side", "31"));
const scale = Number(flag("scale", String(1080 / 405)));
const out = resolve(
  flag("out", mode === "feed" ? "./feed-clip.mp4" : `./export-${code ?? "clip"}.mp4`),
);

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
      // Forced at the BROWSER, not through Emulation.setDeviceMetricsOverride. Screencast
      // hands back frames sized in CSS pixels, so an emulated scale factor leaves them at
      // the viewport's logical size and ffmpeg upscales — 1080×1920 in the container,
      // 405×720 of real detail. Forcing the device scale factor makes the surface itself
      // that many pixels, which is what screencast then captures.
      `--force-device-scale-factor=${mode === "feed" ? scale : 1}`,
      `--window-size=${mode === "feed" ? `${cssWidth},${cssHeight}` : "1080,1920"}`,
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

  // ── Set the stage, per mode ───────────────────────────────────────────────────────────
  let width: number;
  let height: number;
  let url: string;
  /** Resolves when the thing being recorded has finished; polled below. */
  let isFinished: () => Promise<boolean>;
  let describe: () => Promise<string>;

  if (mode === "feed") {
    width = Math.round(cssWidth * scale);
    height = Math.round(cssHeight * scale);
    // Phone metrics, not a 1080px-wide desktop window. `mobile` makes the app lay out the
    // way it does on a phone; the scale factor is what turns that into output pixels.
    // deviceScaleFactor 0 means "keep what the browser already has" — the forced factor
    // above. Passing `scale` here instead would emulate it a second time, and the frames
    // would come back logical again.
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: cssWidth,
      height: cssHeight,
      deviceScaleFactor: 0,
      mobile: true,
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    // Push the app's own chrome clear of the platform's. TikTok puts a search row across
    // the top and a caption, action rail and nav across the bottom; a toolbar 12px from
    // the edge sits underneath them. These two variables move the app's bars inward —
    // the bottom one is the shell's existing contract, so the meaning panel's cap and the
    // clue band's foot follow it without anything else being told.
    if (insetTop || insetBottom || insetSide) {
      // A STYLESHEET, not a property set on the root. --vocab-chrome-inset is declared on
      // .vocabulary-shell itself, and a declaration on the element beats a value inherited
      // from an ancestor — so setting it on <html> moves the toolbar and leaves the bottom
      // exactly where it was. A rule targeting the shell wins, and survives re-renders.
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `(() => {
          const css = ':root{--vocab-chrome-head:${insetTop}px;--vocab-chrome-side:${insetSide}px}'
            + '.vocabulary-shell{--vocab-chrome-inset:${insetBottom}px}';
          const add = () => {
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
          };
          if (document.head) add();
          else document.addEventListener('DOMContentLoaded', add, { once: true });
        })();`,
      });
    }
    // Skip the difficulty onboarding. It is a first-visit screen, and a clip that opens on
    // it is showing the reader a form rather than the thing being advertised. Written
    // before any app script runs, so the feed never renders the onboarding at all.
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { localStorage.setItem(${JSON.stringify(DIFFICULTY_CHOICE_KEY)}, ${JSON.stringify(DIFFICULTY_ALL)}); } catch {}`,
    });
    url = `${base}/feed`;
  } else {
    const size = presetSize(preset);
    width = size.width;
    height = size.height;
    // The card measures its own box and lays out from what it first saw, so it has to
    // arrive at the final size rather than be resized into it.
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    url = `${base}/export/${code}?preset=${encodeURIComponent(preset)}`;
  }

  console.log(`→ ${url}`);
  await cdp.send("Page.navigate", { url });

  if (mode === "feed") {
    // Wait for a card to be on screen. A fresh load starts the first word at its first
    // page, so recording from here gives a clean beginning with nothing to trim.
    let position = 0;
    for (let attempt = 0; attempt < 150; attempt += 1) {
      position = (await cdp.evaluate<number>(ACTIVE_POSITION)) ?? 0;
      if (position > 0) break;
      await sleep(200);
    }
    if (!position) throw new Error("the feed never put a word on screen");
    const startedOn = position;
    console.log(`  feed at ${cssWidth}×${cssHeight} ×${scale.toFixed(2)} → ${width}×${height}`);
    // One whole word: finished when the feed has moved on to the next one.
    isFinished = async () =>
      ((await cdp.evaluate<number>(ACTIVE_POSITION)) ?? startedOn) !== startedOn;
    // Named by position, not by headword. Reading the answer off the page during the take
    // is possible but was not worth the fuss here: a caller that needs the word can ask
    // the feed API for the word at this position, and export mode reports it outright.
    describe = async () => `position ${startedOn}`;
  } else {
    let phase = "";
    for (let attempt = 0; attempt < 150; attempt += 1) {
      phase = (await cdp.evaluate<string>("document.body.dataset.exportPhase || ''")) ?? "";
      if (phase === "ready" || phase === "missing") break;
      await sleep(200);
    }
    if (phase === "missing") throw new Error(`No word has the share code "${code}"`);
    if (phase !== "ready") throw new Error(`page never became ready (phase: "${phase || "none"}")`);
    const reported = (await cdp.evaluate<string>("document.body.dataset.exportSize || ''")) ?? "";
    const word = await cdp.evaluate<string>("document.body.dataset.exportWord || ''");
    if (reported !== `${width}x${height}`) {
      throw new Error(
        `preset "${preset}" is ${width}×${height} here but the page reported ${reported}`,
      );
    }
    console.log(`  word "${word}" at ${width}×${height}`);
    isFinished = async () =>
      (await cdp.evaluate<string>("document.body.dataset.exportPhase || ''")) === "done";
    describe = async () => word;
  }

  // Let whatever just mounted settle before the first frame is kept.
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
  // Export mode holds its card still until cued, so that it is not already part-way
  // through an entrance by the time frames are flowing. The feed needs no cue: it plays
  // on its own, which is the whole point of recording it.
  if (mode === "export") {
    await cdp.evaluate(`window.dispatchEvent(new Event("vocab-export-start"))`);
  }

  const deadline = Date.now() + maxSeconds * 1000;
  for (;;) {
    if (await isFinished()) break;
    if (Date.now() > deadline) {
      console.warn(`! never finished within ${maxSeconds}s; using what was captured`);
      break;
    }
    await sleep(250);
  }
  const subject = await describe();
  await cdp.send("Page.stopScreencast");
  await sleep(200);
  cdp.close();

  if (captured.length < 2) throw new Error(`captured ${captured.length} frames; nothing to encode`);

  // Measure what Chrome actually handed back, which is not always what was asked for: a
  // screencast of a scaled viewport can arrive at the CSS size rather than the device-pixel
  // one, and ffmpeg would then quietly UPSCALE it to the output size. Asking for the scale
  // is not the same as getting it, so the check is on the result, and it refuses rather
  // than warns \u2014 a clip that says 1080\u00d71920 and holds 405\u00d7720 of detail looks soft with
  // nothing in the file to say why, and that one shipped before anyone noticed.
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
     "-of", "csv=p=0", captured[0]!.file],
    { encoding: "utf8" },
  );
  const [grabbedWidth, grabbedHeight] = (probe.stdout ?? "").trim().split(",").map(Number);
  if (grabbedWidth && grabbedHeight) {
    if (grabbedWidth < width || grabbedHeight < height) {
      throw new Error(
        `frames came back at ${grabbedWidth}\u00d7${grabbedHeight}, short of the ${width}\u00d7${height} asked for; ` +
          "encoding them would upscale. Check --force-device-scale-factor reached the browser.",
      );
    }
    console.log(`  frames captured at ${grabbedWidth}\u00d7${grabbedHeight} (native)`);
  }
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
      // A silent track. The picture is the whole point, but an upload with no audio stream
      // at all is the odd one out in a platform's ingest pipeline, and a muted track costs
      // a few kilobytes.
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-shortest",
      "-vf",
      // in_range=full is what the frames really are \u2014 they arrive as JPEG, which is full
      // range \u2014 and out_range=tv is what an H.264 file is expected to hold. Without the
      // conversion the levels stay 0\u2013255 and the file gets tagged yuvj420p; players that
      // read it as 16\u2013235 anyway crush the blacks and blow out the white text.
      `fps=${fps},scale=${width}:${height}:flags=lanczos:in_range=full:out_range=tv,format=yuv420p`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      // Spelled out rather than left to be guessed at the other end.
      "-pix_fmt",
      "yuv420p",
      "-color_range",
      "tv",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-profile:v",
      "high",
      "-level",
      "4.0",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      out,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  if (ffmpeg.status !== 0)
    throw new Error(`ffmpeg failed:\n${ffmpeg.stderr?.toString().slice(-1500)}`);
  console.log(`✓ ${subject} → ${out}`);
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

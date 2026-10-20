/**
 * Hand a rendered clip to the TikTok app running in the Android emulator.
 *
 * This is the second half of the posting path. `render-export-clip.ts` makes the MP4;
 * this puts it in front of TikTok's own upload flow, so the post is composed by the real
 * app rather than by an API. It stops at the editor: you review and tap Post yourself,
 * which is the draft-and-publish arrangement this was built for.
 *
 * Why the indirection — three things that look like they should be simpler but are not:
 *
 *   file:// URIs are refused. Anything targeting Android 7+ gets a FileUriExposedException
 *   when handed a raw path, so the clip has to be referenced by its MediaStore id. Pushing
 *   the file is therefore only step one; it also has to be INDEXED before it can be shared.
 *
 *   The index is not synchronous. MediaProvider notices new files in /sdcard/Movies on its
 *   own, but on its own schedule, so the id is polled for rather than assumed.
 *
 *   TikTok's share activity is not a fixed name. It moves between app versions, so it is
 *   resolved at run time from the intent filters the installed build actually declares.
 *   Hardcoding the component is what breaks silently after an app update.
 *
 * Usage:
 *   npx tsx scripts/post-to-tiktok.ts <clip.mp4>
 *
 *     --avd <name>     emulator to use (default: TikTokPoster)
 *     --serial <id>    adb target, when more than one device is attached
 *     --boot           start the emulator first if nothing is attached
 *     --keep           leave the pushed file on the device afterwards
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const TIKTOK_PACKAGES = [
  "com.zhiliaoapp.musically", // TikTok, most regions
  "com.ss.android.ugc.trill", // TikTok, some regions
];
/** Scanned by MediaProvider, so a file landing here gets indexed without a manual scan. */
const DEVICE_DIR = "/sdcard/Movies";

const argv = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`);
  return at !== -1 && argv[at + 1] ? argv[at + 1]! : fallback;
}
const has = (name: string) => argv.includes(`--${name}`);

const clip = argv.find((a) => !a.startsWith("--") && a.endsWith(".mp4"));
const avd = flag("avd", "TikTokPoster");
const serial = flag("serial", "");

/** adb, with the serial pinned when one was asked for. */
function adb(args: string[], opts: { quiet?: boolean } = {}) {
  const full = serial ? ["-s", serial, ...args] : args;
  const run = spawnSync("adb", full, { encoding: "utf8" });
  if (!opts.quiet && run.status !== 0) {
    throw new Error(`adb ${args.join(" ")} failed:\n${(run.stderr || run.stdout || "").trim()}`);
  }
  return (run.stdout ?? "").trim();
}

/** The device's answer with the carriage returns adb's shell leaves behind stripped. */
function shell(command: string): string {
  return adb(["shell", command], { quiet: true }).replace(/\r/g, "").trim();
}

function attachedDevices(): string[] {
  return adb(["devices"], { quiet: true })
    .split("\n")
    .slice(1)
    .filter((line) => line.includes("\tdevice"))
    .map((line) => line.split("\t")[0]!);
}

async function bootEmulator() {
  const sdk = process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`;
  console.log(`→ booting ${avd}`);
  spawnSync("sh", ["-c", `nohup "${sdk}/emulator/emulator" -avd ${avd} >/tmp/emulator-boot.log 2>&1 &`]);
  adb(["wait-for-device"], { quiet: true });
  for (let i = 0; i < 150; i += 1) {
    if (shell("getprop sys.boot_completed") === "1") return;
    await sleep(2000);
  }
  throw new Error(`${avd} did not finish booting; see /tmp/emulator-boot.log`);
}

/**
 * The MediaStore id for a pushed file, once MediaProvider has noticed it.
 * @param name - the file's name on the device
 * @returns the content:// URI, or null if it never showed up
 */
async function waitForMediaUri(name: string): Promise<string | null> {
  // The quoting survives two hops: Node's argv and the device's own shell.
  const where = `_display_name='${name.replace(/'/g, "")}'`;
  for (let i = 0; i < 30; i += 1) {
    const row = shell(
      `content query --uri content://media/external/video/media` +
        ` --projection _id --where "${where}"`,
    );
    const found = row.match(/_id=(\d+)/);
    if (found) return `content://media/external/video/media/${found[1]}`;
    await sleep(1000);
  }
  return null;
}

/** The installed TikTok package, or null when none of the known ones are present. */
function findTikTok(): string | null {
  const installed = shell("pm list packages");
  return TIKTOK_PACKAGES.find((p) => installed.includes(`package:${p}`)) ?? null;
}

/**
 * The component that actually handles a shared video in the installed TikTok build,
 * read from its intent filters rather than hardcoded.
 * @param pkg - TikTok's package name
 * @returns a `package/activity` component, or null to fall back to the system chooser
 */
function findShareActivity(pkg: string): string | null {
  const listed = shell(
    `cmd package query-activities --brief -a android.intent.action.SEND -t video/mp4`,
  );
  const line = listed.split("\n").find((l) => l.includes(`${pkg}/`));
  return line?.trim().match(/([\w.]+\/[\w.$]+)/)?.[1] ?? null;
}

async function main() {
  if (!clip) throw new Error("give me a path to an .mp4");
  const file = resolve(clip);
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);

  if (attachedDevices().length === 0) {
    if (!has("boot")) {
      throw new Error(`no device attached. Start the emulator, or pass --boot to start ${avd}.`);
    }
    await bootEmulator();
  }

  const tiktok = findTikTok();
  if (!tiktok) {
    throw new Error(
      "TikTok is not installed on the device.\n" +
        "  Open the Play Store in the emulator, sign in, and install TikTok first.",
    );
  }

  // A name that will not collide with yesterday's clip in the gallery.
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const name = `${stamp}-${basename(file)}`;
  const target = `${DEVICE_DIR}/${name}`;

  const mb = (statSync(file).size / 1_048_576).toFixed(1);
  console.log(`→ pushing ${basename(file)} (${mb}MB) to ${target}`);
  adb(["push", file, target]);

  console.log("→ waiting for MediaStore to index it");
  const uri = await waitForMediaUri(name);
  if (!uri) {
    throw new Error(
      `the clip is at ${target} but MediaStore never indexed it.\n` +
        "  It can still be picked by hand from TikTok's gallery.",
    );
  }
  console.log(`  ${uri}`);

  const component = findShareActivity(tiktok);
  // --grant-read-uri-permission is what lets TikTok read a URI owned by MediaProvider.
  const intent = [
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.SEND",
    "-t",
    "video/mp4",
    "--grant-read-uri-permission",
    "--eu",
    "android.intent.extra.STREAM",
    uri,
    ...(component ? ["-n", component] : []),
  ];
  console.log(`→ handing it to ${component ?? "the system chooser"}`);
  adb(intent);

  if (!has("keep")) {
    // The device copy is TikTok's to read until it has imported the clip, so this only
    // removes the previous run's file, never the one just handed over.
    const stale = shell(`ls ${DEVICE_DIR}`)
      .split("\n")
      .filter((f) => f.endsWith(".mp4") && f !== name);
    for (const old of stale) shell(`rm ${DEVICE_DIR}/${old}`);
    if (stale.length) console.log(`  cleared ${stale.length} earlier clip(s)`);
  }

  console.log(
    "\n✓ TikTok has the clip. Finish in the emulator:\n" +
      "  add the caption, then Post — or save it as a draft and publish from your phone.\n" +
      "  (The caption is not settable from here; TikTok ignores intent text in the editor.)",
  );
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

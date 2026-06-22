// Scans every post's stored background for the gradient-validation bug class:
// a value that looks fine when it was saved but can no longer paint as
// `background-image` (bad syntax, a bare color where a gradient was expected,
// an empty/blank transition path, etc). Run after generating/seeding posts, or
// on a schedule, to catch the failure before it ever reaches a user as a black
// canvas. Exits 1 if anything is flagged.
//
//   node scripts/check-canvas-gradients.ts

import { createClient } from "@supabase/supabase-js";
import { isUsableCanvasBackground, parseCanvas } from "../src/lib/canvas.ts";

try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional if the vars are already in the environment.
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY in the environment or .env");
  process.exit(2);
}

type Issue = { postId: string; problem: string; value: string };

function truncate(value: string, max = 80) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  const issues: Issue[] = [];
  let scanned = 0;

  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("posts")
      .select("id, bg_gradient, canvas_html")
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Failed to read posts:", error.message);
      process.exit(2);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      scanned += 1;

      if (row.bg_gradient != null && !isUsableCanvasBackground(row.bg_gradient)) {
        issues.push({
          postId: row.id,
          problem: "bg_gradient fails background-image validation",
          value: truncate(row.bg_gradient),
        });
      }

      const spec = parseCanvas(row.canvas_html);
      if (spec.backgroundStyle === "transition") {
        const path = spec.gradientPath ?? [];
        const badEntries = path.filter((entry) => !isUsableCanvasBackground(entry));
        const usableCount = path.length - badEntries.length;

        for (const bad of badEntries) {
          issues.push({
            postId: row.id,
            problem: "gradientPath entry fails background-image validation",
            value: truncate(bad),
          });
        }
        if (path.length > 0 && usableCount < 2) {
          issues.push({
            postId: row.id,
            problem: `transition backgroundStyle but only ${usableCount} usable gradientPath entr${
              usableCount === 1 ? "y" : "ies"
            } (needs 2+, sliding animation silently drops to static)`,
            value: truncate(JSON.stringify(path)),
          });
        }
      }
    }

    if (data.length < pageSize) break;
  }

  console.log(`Scanned ${scanned} post${scanned === 1 ? "" : "s"}.`);

  if (issues.length === 0) {
    console.log("No broken canvas backgrounds found.");
    return;
  }

  console.log(`\nFound ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n`);
  for (const issue of issues) {
    console.log(`  post ${issue.postId}: ${issue.problem}\n    value: ${issue.value}`);
  }
  process.exitCode = 1;
}

main();

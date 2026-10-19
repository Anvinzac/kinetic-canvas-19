import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ExportFramePage } from "@/features/vocabulary/components/ExportFramePage";
import { EXPORT_PRESETS } from "@/features/vocabulary/lib/export-presets";
import { STYLE_IDS } from "@/features/vocabulary/lib/schema";

/**
 * The automatable half of Export Studio: one word, one preset, nothing else on screen.
 *
 * Addressed by share code, which every English word already carries and which /w/$code
 * already resolves — so "post a random word" is "pick a random code".
 *
 * noindex on purpose. This is a rendering surface for a recorder, not a page for a
 * reader: it has no navigation, no way back, and a crawler finding it would offer
 * searchers a dead end that happens to spoil the answer.
 */
const presetIds = EXPORT_PRESETS.map((preset) => preset.id);

export const Route = createFileRoute("/export/$code")({
  validateSearch: z.object({
    /** Frame size and safe area; defaults to the first preset. */
    preset: z.enum(presetIds as [string, ...string[]]).optional(),
    /** Pin the palette and the narration style so a scheduled clip is reproducible.
     *  Validated against the real style ids, so a typo is a 400 rather than a clip
     *  silently recorded in whatever "mix" happened to pick. */
    theme: z.string().max(400).optional(),
    style: z.enum([...STYLE_IDS, "mix"] as [string, ...string[]]).optional(),
    /** Chrome inside the frame. Brand on by default, progress off, as Export Studio opens. */
    brand: z.boolean().optional(),
    progress: z.boolean().optional(),
    /** Start playing on load instead of waiting for the start event. For eyeballing it. */
    autostart: z.boolean().optional(),
  }),
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }, { title: "Export frame" }],
  }),
  component: ExportFramePage,
});

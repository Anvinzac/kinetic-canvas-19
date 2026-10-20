import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ShowcasePage } from "@/features/vocabulary/components/ShowcasePage";
import { STYLE_IDS } from "@/features/vocabulary/lib/schema";

/**
 * A whole promo clip for one word: opening badge, the word in the app's chrome, end card.
 *
 * The sibling of /export/$code. That one renders a word stripped to a preset's clear zone;
 * this one renders what a visitor would see, framed as something postable.
 *
 * It exists so a recorder has a surface built for it rather than the reader's feed driven
 * from outside — which meant clicking a pause button to hold the text, and synthesising
 * taps to replay a page. Both were races, and both lost silently. Here the sequence is
 * component state.
 *
 * noindex on purpose, and deliberately not linked from anywhere: a rendering surface for a
 * recorder, not a page for a reader.
 */
export const Route = createFileRoute("/showcase")({
  validateSearch: z.object({
    /** A specific word by share code; otherwise one is picked from the deck. */
    code: z.string().max(16).optional(),
    /** Pick the same word again — an index into the deck, so a job is reproducible. */
    seed: z.number().int().nonnegative().optional(),
    /** Pin the palette and narration style, as /export/$code does. */
    theme: z.string().max(400).optional(),
    style: z.enum([...STYLE_IDS, "mix"] as [string, ...string[]]).optional(),
    /** What the opening badge says. */
    badge: z.string().max(80).optional(),
    /** Run without waiting for the start event. For eyeballing it in a browser. */
    autostart: z.boolean().optional(),
  }),
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }, { title: "Showcase" }],
  }),
  component: ShowcasePage,
});

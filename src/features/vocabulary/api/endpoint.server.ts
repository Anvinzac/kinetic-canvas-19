/** Public vocabulary HTTP boundary. Exports: vocabularyResponse. Depends on: zod, server catalog, difficulty bands. */
import { z } from "zod";
import { LEVELS } from "../lib/schema";
import { DIFFICULTY_IDS } from "../lib/difficulty";
import { catalogFor, MAX_POSITION, readVocabularyPage } from "./catalog.server";
import { resolveTarget } from "../lib/target-language";

const unsigned = (fallback: string, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .default(fallback)
    .transform(Number)
    .pipe(z.number().int().min(0).max(max));
const requestSchema = z
  .object({
    seed: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/),
    position: unsigned("0", MAX_POSITION),
    limit: unsigned("12", 24).pipe(z.number().min(1)),
    // The revision is an opaque digest the client only ever echoes back, and the server
    // only ever compares for equality. It is validated as bounded hex rather than at an
    // exact width: the cursor for EVERY page after the first is built from the revision
    // this server just issued, so a digest that merely changes length would be rejected
    // here and silently end the feed at word twelve.
    revision: z
      .string()
      .regex(/^[a-f0-9]{8,64}$/)
      .optional(),
    topic: z
      .string()
      .max(60)
      .regex(/^[a-z0-9-]*$/)
      .default(""),
    level: z.union([z.enum(LEVELS), z.literal("")]).default(""),
    // Difficulty is multi-select: a comma-joined list of track ids, or "" for all.
    // Every segment is validated against the declared list, so an unknown id is a 400
    // rather than a silently empty stream.
    difficulty: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .join(","),
      )
      .refine(
        (value) =>
          value === "" ||
          value.split(",").every((id) => (DIFFICULTY_IDS as readonly string[]).includes(id)),
        { message: "Unknown difficulty track" },
      ),
  })
  .strict()
  .refine((input) => input.position % input.limit === 0, {
    path: ["position"],
    message: "Position must be aligned with the page size",
  });
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

/** Serve bounded pages without authentication. @param request Incoming GET. @returns JSON response. */
export function vocabularyResponse(request: Request): Response {
  const url = new URL(request.url);
  if (url.search.length > 512)
    return Response.json(
      { code: "INVALID_REQUEST", error: "Query is too long" },
      { status: 400, headers },
    );
  const parsed = requestSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success)
    return Response.json(
      {
        code: "INVALID_REQUEST",
        error: "Invalid vocabulary query",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers },
    );
  const locale = resolveTarget(request.headers.get("host") ?? url.host);
  if (parsed.data.revision && parsed.data.revision !== catalogFor(locale).revision) {
    return Response.json(
      { code: "CATALOG_CHANGED", error: "The vocabulary catalog changed. Start a fresh stream." },
      { status: 409, headers },
    );
  }
  try {
    return Response.json(readVocabularyPage(parsed.data, locale), { headers });
  } catch {
    return Response.json(
      { code: "UNAVAILABLE", error: "Vocabulary is temporarily unavailable. Please retry." },
      { status: 503, headers },
    );
  }
}

/** Public vocabulary HTTP boundary. Exports: vocabularyResponse. Depends on: zod, server catalog. */
import { z } from "zod";
import { LEVELS } from "../lib/schema";
import { catalog, MAX_POSITION, readVocabularyPage } from "./catalog.server";

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
    revision: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    topic: z
      .string()
      .max(60)
      .regex(/^[a-z0-9-]*$/)
      .default(""),
    level: z.union([z.enum(LEVELS), z.literal("")]).default(""),
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
  if (parsed.data.revision && parsed.data.revision !== catalog.revision) {
    return Response.json(
      { code: "CATALOG_CHANGED", error: "The vocabulary catalog changed. Start a fresh stream." },
      { status: 409, headers },
    );
  }
  try {
    return Response.json(readVocabularyPage(parsed.data), { headers });
  } catch {
    return Response.json(
      { code: "UNAVAILABLE", error: "Vocabulary is temporarily unavailable. Please retry." },
      { status: 503, headers },
    );
  }
}

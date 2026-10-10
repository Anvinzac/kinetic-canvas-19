/**
 * Admin wording CRUD server functions (Supabase-backed).
 *
 * Manages the vocab_wordings table for customizing the reveal button text
 * and guess lead phrasing used in the vocabulary feed.
 *
 * Exports: listVocabWordings, saveVocabWording, deleteVocabWording, activateVocabWording
 * Depends on: zod, admin-access, require-admin, supabase admin client
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "../lib/admin-access";
import { requireAdminContext } from "../lib/require-admin";

export type VocabWording = {
  id: string;
  reveal_button: string;
  guess_lead: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const wordingSchema = z.object({
  id: z.string().uuid().optional(),
  reveal_button: z.string().trim().min(1).max(120),
  guess_lead: z.string().trim().max(240).nullable().default(null),
  is_active: z.boolean().default(false),
});

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Use any to bypass type checking until Supabase types are regenerated with the new table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

/**
 * List all wording presets, active first.
 */
export const listVocabWordings = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<VocabWording[]> => {
    await requireAdminContext({ authUserId: context.userId });
    const supabase = await getAdminClient();
    const { data, error } = await supabase
      .from("vocab_wordings")
      .select("*")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as VocabWording[];
  });

/**
 * Insert or update one wording preset.
 */
export const saveVocabWording = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((d: unknown) => z.object({ wording: wordingSchema }).parse(d))
  .handler(async ({ data, context }): Promise<VocabWording> => {
    await requireAdminContext({ authUserId: context.userId });
    const supabase = await getAdminClient();
    const wording = data.wording;

    if (wording.id) {
      // Update existing
      const { data: updated, error } = await supabase
        .from("vocab_wordings")
        .update({
          reveal_button: wording.reveal_button,
          guess_lead: wording.guess_lead,
          is_active: wording.is_active,
        })
        .eq("id", wording.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return updated as VocabWording;
    }

    // Insert new
    const { data: inserted, error } = await supabase
      .from("vocab_wordings")
      .insert({
        reveal_button: wording.reveal_button,
        guess_lead: wording.guess_lead,
        is_active: wording.is_active,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted as VocabWording;
  });

/**
 * Delete one wording preset.
 */
export const deleteVocabWording = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    await requireAdminContext({ authUserId: context.userId });
    const supabase = await getAdminClient();
    const { error } = await supabase.from("vocab_wordings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Activate one wording preset (deactivates all others).
 */
export const activateVocabWording = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    await requireAdminContext({ authUserId: context.userId });
    const supabase = await getAdminClient();

    // Deactivate all first
    await supabase.from("vocab_wordings").update({ is_active: false }).neq("id", data.id);
    // Activate the target
    const { error } = await supabase
      .from("vocab_wordings")
      .update({ is_active: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Get the currently active wording (public, no admin gate).
 * Used by the vocabulary feed to read the active preset.
 */
export const getActiveVocabWording = createServerFn({ method: "GET" }).handler(
  async (): Promise<VocabWording | null> => {
    const supabase = await getAdminClient();
    const { data, error } = await supabase
      .from("vocab_wordings")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();
    if (error) return null;
    return (data as VocabWording) ?? null;
  },
);

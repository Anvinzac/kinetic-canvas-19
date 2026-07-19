/**
 * Settings page shell: profile card, preference sections, and sign-out.
 *
 * Exports: SettingsPage
 * Depends on: discovery me query, session, settings hooks/components
 */

import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut } from "lucide-react";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { getMe, meQueryOptions } from "@/features/discovery";
import { getProfileCompletion } from "@/features/profile";
import { endDemoSession, resolveDataMode } from "@/features/session";
import { supabase } from "@/integrations/supabase/client";
import type { SocialMeData } from "@/shared/types";
import { useSettingsPreferences } from "../hooks/useSettingsPreferences";
import { SettingsHeader } from "./SettingsHeader";
import { SettingsPreferenceSections } from "./SettingsPreferenceSections";
import { SettingsProfileCard } from "./SettingsProfileCard";

/**
 * Compose the authenticated Settings experience.
 * @returns Full settings page
 */
export function SettingsPage(): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const { prefs, setPrefs, resetPreferences } = useSettingsPreferences();

  function handleBack(): void {
    if (router.history.length > 1) router.history.back();
    else navigate({ to: "/feed" });
  }

  const fetchMe = useServerFn(getMe);
  const dataMode = resolveDataMode();
  const demoMode = dataMode === "demo";
  const { data } = useQuery(meQueryOptions(dataMode, () => fetchMe() as Promise<SocialMeData>));

  async function handleSignOut(): Promise<void> {
    await qc.cancelQueries();
    qc.clear();
    if (demoMode) endDemoSession();
    else await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function copyProfileLink(): Promise<void> {
    if (!data?.profile) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${data.profile.username}`);
      toast.success("profile link copied");
    } catch {
      toast.error("could not copy link");
    }
  }

  function handleReset(): void {
    resetPreferences();
    toast.success("settings reset");
  }

  const profile = data?.profile;
  const completion = profile
    ? getProfileCompletion({
        displayName: profile.display_name,
        bio: profile.bio ?? null,
        avatar: profile.avatar_url,
        posts: data.stats.posts,
      }): 0;

  return (
    <div className="min-h-[100dvh] pb-8">
      <SettingsHeader onBack={handleBack} onReset={handleReset} />

      <div className="px-4 py-5 space-y-5">
        {profile && (
          <SettingsProfileCard
            username={profile.username}
            displayName={profile.display_name}
            avatarUrl={profile.avatar_url}
            posts={data.stats.posts}
            followers={data.stats.followers}
            completion={completion}
            onCopyLink={copyProfileLink}
          />
        )}

        <SettingsPreferenceSections
          prefs={prefs}
          setPrefs={setPrefs}
          username={profile?.username}
          completion={completion}
        />

        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/15 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-destructive ring-1 ring-destructive/30 transition hover:bg-destructive/25"
        >
          <LogOut className="size-4" /> sign out
        </button>

        <p className="pt-2 text-center font-mono text-[10px] text-muted-foreground/50">
          kinetic · v0.1 · made for moving words
        </p>
      </div>
    </div>
  );
}

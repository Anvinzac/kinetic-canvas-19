/**
 * Edit-profile page shell: load me, mutate profile, compose form sections.
 *
 * Exports: EditProfilePage
 * Depends on: discovery updateProfile, EditProfileAvatarField/FormFields
 */

import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { discoveryKeys, getMe, meQueryOptions, updateProfile } from "@/features/discovery";
import { resolveDataMode } from "@/features/session";
import { updateMockProfile } from "@/lib/mock-data";
import type { SocialMeData } from "@/shared/types";
import { getProfileCompletion } from "../lib/stats";
import { EditProfileAvatarField } from "./EditProfileAvatarField";
import { EditProfileFormFields, isValidAvatarUrl } from "./EditProfileFormFields";

/**
 * Compose the edit-profile form with save/back chrome.
 * @returns Edit profile page
 */
export function EditProfilePage(): ReactElement {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const updateFn = useServerFn(updateProfile);
  const dataMode = resolveDataMode();
  const demoMode = dataMode === "demo";
  const { data } = useQuery(meQueryOptions(dataMode, () => fetchMe() as Promise<SocialMeData>));

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (data?.profile) {
      setDisplayName(data.profile.display_name);
      setBio(data.profile.bio ?? "");
      setAvatar(data.profile.avatar_url ?? "");
    }
  }, [data]);

  useEffect(() => {
    setAvatarError(false);
  }, [avatar]);

  const cleanAvatar = avatar.trim();
  const validAvatar = !cleanAvatar || isValidAvatarUrl(cleanAvatar);
  const profileCompletion = getProfileCompletion({
    displayName,
    bio,
    avatar: cleanAvatar || null,
    posts: data?.stats.posts ?? 0,
  });

  const mut = useMutation({
    mutationFn: () => {
      if (!displayName.trim()) throw new Error("display name is required");
      if (!validAvatar) throw new Error("avatar url is invalid");
      if (demoMode) {
        return updateMockProfile({
          display_name: displayName.trim(),
          bio: bio.trim(),
          avatar_url: cleanAvatar || null,
        });
      }
      return updateFn({
        data: {
          display_name: displayName.trim(),
          bio: bio.trim(),
          ...(cleanAvatar ? { avatar_url: cleanAvatar } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("profile updated ✨");
      qc.invalidateQueries({ queryKey: discoveryKeys.meRoot });
      qc.invalidateQueries({ queryKey: discoveryKeys.profileRoot });
      navigate({ to: "/settings" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function shuffleAvatar(): void {
    const seed = Math.random().toString(36).slice(2, 10);
    setAvatar(`https://i.pravatar.cc/240?u=${seed}`);
  }

  const previewAvatar =
    cleanAvatar || `https://i.pravatar.cc/240?u=${data?.profile?.username ?? "kinetic"}`;
  const fallbackAvatar = `https://i.pravatar.cc/240?u=${data?.profile?.username ?? "kinetic"}`;
  const canSave = !!displayName.trim() && validAvatar && !mut.isPending;

  return (
    <div className="min-h-[100dvh] pb-8">
      <header className="sticky top-0 z-30 glass flex items-center gap-3 border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button
          onClick={() => navigate({ to: "/settings" })}
          className="-ml-1 grid size-8 place-items-center"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-impact text-xl tracking-wider flex-1">EDIT PROFILE</h1>
        <button
          onClick={() => mut.mutate()}
          disabled={!canSave}
          className="grad-aurora flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          <Check className="size-3.5" />
          {mut.isPending ? "saving" : "save"}
        </button>
      </header>

      <div className="px-5 py-6 space-y-6">
        <EditProfileAvatarField
          displayName={displayName}
          username={data?.profile?.username}
          bio={bio}
          previewAvatar={previewAvatar}
          avatarError={avatarError}
          fallbackAvatar={fallbackAvatar}
          profileCompletion={profileCompletion}
          onAvatarError={() => setAvatarError(true)}
          onShuffle={shuffleAvatar}
          onRestore={() => setAvatar(data?.profile?.avatar_url ?? "")}
        />

        <EditProfileFormFields
          displayName={displayName}
          bio={bio}
          avatar={avatar}
          validAvatar={validAvatar}
          avatarError={avatarError}
          username={data?.profile?.username}
          onDisplayNameChange={setDisplayName}
          onBioChange={setBio}
          onAvatarChange={setAvatar}
        />
      </div>
    </div>
  );
}

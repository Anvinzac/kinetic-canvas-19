/**
 * Edit-profile avatar preview, completion bar, and shuffle/restore actions.
 *
 * Exports: EditProfileAvatarField
 * Depends on: lucide-react
 */

import { Camera, RefreshCw, Sparkles } from "lucide-react";
import type { ReactElement } from "react";

type EditProfileAvatarFieldProps = {
  displayName: string;
  username: string | undefined;
  bio: string;
  previewAvatar: string;
  avatarError: boolean;
  fallbackAvatar: string;
  profileCompletion: number;
  onAvatarError: () => void;
  onShuffle: () => void;
  onRestore: () => void;
};

/**
 * Render the live avatar preview card plus shuffle/restore controls.
 * @param props - Preview fields, completion, and avatar action handlers
 * @returns Avatar preview section and action buttons
 */
export function EditProfileAvatarField({
  displayName,
  username,
  bio,
  previewAvatar,
  avatarError,
  fallbackAvatar,
  profileCompletion,
  onAvatarError,
  onShuffle,
  onRestore,
}: EditProfileAvatarFieldProps): ReactElement {
  return (
    <>
      <section className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="grad-aurora rounded-full p-[3px]">
              <img
                src={avatarError ? fallbackAvatar : previewAvatar}
                alt=""
                onError={onAvatarError}
                className="size-24 rounded-full border-4 border-background object-cover"
              />
            </div>
            <span className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full bg-white text-black ring-4 ring-background">
              <Camera className="size-4" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-2xl font-black">
              {displayName.trim() || "Display name"}
            </h2>
            <p className="font-mono text-xs text-muted-foreground">@{username ?? "username"}</p>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/85">
              {bio.trim() || "Add a short bio for your profile."}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              profile signal
            </span>
            <span className="font-mono text-xs text-muted-foreground">{profileCompletion}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${profileCompletion}%` }}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onShuffle}
          className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-xs font-mono uppercase tracking-widest ring-1 ring-white/10 transition hover:ring-primary/60"
        >
          <RefreshCw className="size-3" /> shuffle avatar
        </button>
        <button
          onClick={onRestore}
          className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-xs font-mono uppercase tracking-widest ring-1 ring-white/10 transition hover:ring-primary/60"
        >
          <Sparkles className="size-3" /> restore
        </button>
      </div>
    </>
  );
}

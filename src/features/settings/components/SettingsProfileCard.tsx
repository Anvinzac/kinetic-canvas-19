/**
 * Settings hero card: avatar, stats, completion bar, edit/copy actions.
 *
 * Exports: SettingsProfileCard
 * Depends on: features/profile formatCount, tanstack Link
 */

import { Link } from "@tanstack/react-router";
import { Copy, Edit3 } from "lucide-react";
import type { ReactElement } from "react";
import { formatCount } from "@/features/profile";

type SettingsProfileCardProps = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  posts: number;
  followers: number;
  completion: number;
  onCopyLink: () => void;
};

/**
 * Render the signed-in user's profile summary on Settings.
 * @param props - Profile fields, completion percent, and copy-link handler
 * @returns Rounded profile card section
 */
export function SettingsProfileCard({
  username,
  displayName,
  avatarUrl,
  posts,
  followers,
  completion,
  onCopyLink,
}: SettingsProfileCardProps): ReactElement {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-4 ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        <Link
          to="/u/$username"
          params={{ username }}
          className="grad-aurora rounded-full p-[2px]"
        >
          <img
            src={avatarUrl ?? ""}
            alt=""
            className="size-16 rounded-full border-2 border-background object-cover"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-bold">{displayName}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">@{username}</div>
          <div className="mt-2 flex gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{formatCount(posts)} posts</span>
            <span>{formatCount(followers)} followers</span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            profile signal
          </span>
          <span className="font-mono text-xs text-muted-foreground">{completion}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/edit-profile"
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black transition hover:bg-white/90"
        >
          <Edit3 className="size-4" />
          edit
        </Link>
        <button
          type="button"
          onClick={onCopyLink}
          className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold ring-1 ring-white/10 transition hover:bg-white/15"
        >
          <Copy className="size-4" />
          copy
        </button>
      </div>
    </section>
  );
}

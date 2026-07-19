/**
 * Profile page identity block: avatar, stats, bio, and follow/edit actions.
 *
 * Exports: ProfileHeader
 * Depends on: features/profile formatCount, tanstack Link
 */

import { Link } from "@tanstack/react-router";
import { ArrowLeft, Settings, Share2, UserCheck, UserPlus } from "lucide-react";
import type { ReactElement } from "react";
import { formatCount } from "../lib/stats";

type ProfileHeaderProps = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  postCount: number;
  followers: number;
  following: number;
  isMe: boolean;
  isFollowing: boolean;
  followPending: boolean;
  onBack: () => void;
  onSettings: () => void;
  onShare: () => void;
  onFollow: () => void;
};

/**
 * Render the top identity + CTA strip of a profile snap page.
 * @param props - Profile fields and action handlers
 * @returns Header block (back, avatar, stats, bio, buttons)
 */
export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  bio,
  postCount,
  followers,
  following,
  isMe,
  isFollowing,
  followPending,
  onBack,
  onSettings,
  onShare,
  onFollow,
}: ProfileHeaderProps): ReactElement {
  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:bg-white/15 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <div className="grad-aurora inline-block shrink-0 rounded-full p-[2px]">
          <img
            src={avatarUrl ?? ""}
            alt=""
            className="size-20 rounded-full border-[3px] border-background object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-black leading-tight">{displayName}</h1>
          <p className="font-mono text-[11px] text-muted-foreground">@{username}</p>
          <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>
              <strong className="text-foreground">{formatCount(postCount)}</strong> posts
            </span>
            <span>
              <strong className="text-foreground">{formatCount(followers)}</strong> followers
            </span>
            <span>
              <strong className="text-foreground">{formatCount(following)}</strong> following
            </span>
          </div>
        </div>
      </div>

      {bio && <p className="mt-2 text-sm leading-relaxed text-foreground/85">{bio}</p>}

      <div className="mt-2.5 flex items-center gap-2">
        {isMe ? (
          <>
            <Link
              to="/edit-profile"
              className="flex-1 rounded-full bg-white/10 px-4 py-2 text-center text-sm font-bold ring-1 ring-white/10 transition hover:bg-white/15"
            >
              edit profile
            </Link>
            <button
              onClick={onSettings}
              className="grid size-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:bg-white/15"
              aria-label="Settings"
            >
              <Settings className="size-4" />
            </button>
          </>
        ): (
          <>
            <button
              onClick={onFollow}
              disabled={followPending}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition ${
                isFollowing
                  ? "bg-white/10 ring-1 ring-white/10 hover:bg-white/15"
                  : "grad-aurora text-white shadow-[var(--shadow-glow)]"
              }`}
            >
              {isFollowing ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
              {isFollowing ? "following" : "follow"}
            </button>
            <button
              onClick={onShare}
              className="grid size-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:bg-white/15"
              aria-label="Share"
            >
              <Share2 className="size-4" />
            </button>
          </>
        )}
      </div>
    </>
  );
}

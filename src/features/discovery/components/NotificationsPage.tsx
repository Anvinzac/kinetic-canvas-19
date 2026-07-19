/**
 * Activity / notifications list page.
 *
 * Exports: NotificationsPage
 * Depends on: features/discovery API, session data mode, lib/canvas, lucide-react
 */

import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { parseCanvas } from "@/lib/canvas";
import { resolveDataMode } from "@/features/session";
import { ChevronLeft, Heart, MessageCircle, UserPlus } from "lucide-react";
import type { SocialNotificationsData } from "@/shared/types";
import { getNotifications } from "../api/discovery.functions";
import { notificationsQueryOptions } from "../api/queries";

/**
 * @responsibility Format a relative short age string (s/m/h/d) from an ISO timestamp.
 * @param iso ISO datetime string
 * @returns Compact relative age label
 */
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/**
 * @responsibility Render the activity feed of likes, comments, and follows.
 * @returns Activity page with header and notification rows
 */
export function NotificationsPage() {
  const fn = useServerFn(getNotifications);
  const navigate = useNavigate();
  const router = useRouter();
  const dataMode = resolveDataMode();

  function handleBack() {
    if (router.history.length > 1) router.history.back();
    else navigate({ to: "/feed" });
  }

  const { data, isLoading } = useQuery(
    notificationsQueryOptions(dataMode, () => fn() as Promise<SocialNotificationsData>),
  );

  return (
    <div className="min-h-[100dvh] pb-8">
      <header className="sticky top-0 z-30 glass flex items-center gap-3 border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button
          type="button"
          onClick={handleBack}
          className="-ml-1 grid size-8 place-items-center"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-impact text-2xl tracking-wider">ACTIVITY</h1>
      </header>
      {isLoading || !data ? (
        <div className="flex h-64 items-center justify-center">
          <div className="grad-aurora size-10 animate-pulse rounded-full" />
        </div>
      ) : data.items.length === 0 ? (
        <p className="py-16 text-center font-mono text-xs text-muted-foreground">
          no echoes yet — post some kinetics ✨
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {data.items.map((n, i) => {
            const spec = n.post_preview ? parseCanvas(n.post_preview) : null;
            return (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="relative shrink-0">
                  <img src={n.actor?.avatar_url ?? ""} alt="" className="size-11 rounded-full" />
                  <span
                    className={`absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-background ${
                      n.kind === "like"
                        ? "bg-[var(--magenta)]"
                        : n.kind === "comment"
                          ? "bg-[var(--cyber)] text-black"
                          : "bg-[var(--citrus)] text-black"
                    }`}
                  >
                    {n.kind === "like" && <Heart className="size-2.5 fill-current" />}
                    {n.kind === "comment" && <MessageCircle className="size-2.5" />}
                    {n.kind === "follow" && <UserPlus className="size-2.5" />}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {n.actor ? (
                      <Link
                        to="/u/$username"
                        params={{ username: n.actor.username }}
                        className="font-bold"
                      >
                        @{n.actor.username}
                      </Link>
                    ) : (
                      <span className="font-bold">someone</span>
                    )}{" "}
                    <span className="text-muted-foreground">
                      {n.kind === "like" && "sparked your kinetic"}
                      {n.kind === "comment" && `dropped a "${n.chip_id?.replace(/_/g, " ")}"`}
                      {n.kind === "follow" && "is tuning in"}
                    </span>
                  </p>
                  {spec && (
                    <p className="truncate font-mono text-[10px] text-muted-foreground/70">
                      "{spec.text}"
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {timeAgo(n.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

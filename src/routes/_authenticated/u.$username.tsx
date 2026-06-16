import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getProfile } from "@/lib/social.functions";
import { supabase } from "@/integrations/supabase/client";
import { KineticText } from "@/components/KineticText";
import { parseCanvas } from "@/lib/canvas";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const fetchProfile = useServerFn(getProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile({ data: { username } }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="grad-aurora size-12 animate-pulse rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-28">
      <div className="grad-aurora relative h-40">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
      </div>
      <div className="-mt-16 px-5">
        <img src={data.profile.avatar_url ?? ""} alt="" className="size-24 rounded-full border-4 border-background" />
        <h1 className="mt-3 font-display text-2xl font-black">{data.profile.display_name}</h1>
        <p className="font-mono text-xs text-muted-foreground">@{data.profile.username}</p>
        {data.profile.bio && <p className="mt-2 text-sm">{data.profile.bio}</p>}
        <div className="mt-4 flex gap-6 font-mono text-xs uppercase tracking-widest">
          <Stat n={data.posts.length} label="posts" />
          <Stat n={data.followers} label="followers" />
          <Stat n={data.following} label="following" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-1 px-1">
        {data.posts.map((p) => {
          const spec = parseCanvas(p.canvas_html);
          return (
            <div
              key={p.id}
              className="relative aspect-[3/4] overflow-hidden rounded-md"
              style={{ background: p.bg_gradient ?? "#111" }}
            >
              {p.media_urls?.[0] && (
                <img src={p.media_urls[0]} alt="" className="absolute inset-0 size-full object-cover opacity-90" />
              )}
              <div
                className="absolute inset-0 flex items-center justify-center p-1 text-center"
                style={{ fontFamily: spec.font, color: spec.color, fontWeight: spec.weight }}
              >
                <span className="line-clamp-3 text-[10px] font-bold drop-shadow">{spec.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-display text-xl font-black normal-case tracking-normal">{n}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

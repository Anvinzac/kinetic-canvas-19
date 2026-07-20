/**
 * Discover search + trending creators/posts page.
 *
 * Exports: DiscoverPage
 * Depends on: features/discovery API, DiscoverGrid, session data mode, mock-data types
 */

import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {type ReactElement, useState, useEffect } from "react";
import { resolveDataMode } from "@/features/session";
import { type MockDiscoverData, type MockSearchData } from "@/features/demo";
import { ChevronLeft, Search as SearchIcon } from "lucide-react";
import type { SocialDiscoverData, SocialSearchData } from "@/shared/types";
import { getDiscover, search } from "../api/discovery.functions";
import { discoverQueryOptions, searchQueryOptions } from "../api/queries";
import { DiscoverLoader, PostGrid } from "./DiscoverGrid";

/**
 * @responsibility Render discover search header and either search results or trending feed.
 * @returns Discover page shell
 */
export function DiscoverPage(): ReactElement {
  const fetchDiscover = useServerFn(getDiscover);
  const searchFn = useServerFn(search);
  const navigate = useNavigate();
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleBack() {
    if (router.history.length > 1) router.history.back();
    else navigate({ to: "/feed" });
  }

  const debounced = useDebounced(q, 250);
  const dataMode = resolveDataMode();

  const discover = useQuery(
    discoverQueryOptions(dataMode, () => fetchDiscover() as Promise<SocialDiscoverData>),
  );
  const results = useQuery(
    searchQueryOptions(dataMode, debounced, () =>
      searchFn({ data: { q: debounced } }) as Promise<SocialSearchData>,
    ),
  );

  const showResults = debounced.length > 0;

  return (
    <div className="min-h-[100dvh] pb-8">
      <header className="sticky top-0 z-30 glass border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="-ml-1 grid size-8 place-items-center"
            aria-label="Back"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="font-impact text-2xl tracking-wider">DISCOVER</h1>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-full bg-white/5 px-4 py-2.5 ring-1 ring-white/10 focus-within:ring-primary/60 transition">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search creators, words, vibes"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              clear
            </button>
          )}
        </div>
      </header>

      {showResults ? (
        <SearchResults data={results.data} loading={results.isLoading} />
      ): (
        <TrendingFeed data={discover.data} loading={discover.isLoading} />
      )}
    </div>
  );
}

/**
 * @responsibility Render creator + post search hit lists (or empty/loading).
 */
function SearchResults({ data, loading }: { data: MockSearchData | undefined; loading: boolean }) {
  if (loading) return <DiscoverLoader />;
  if (!data) return null;
  return (
    <div className="px-4 py-5">
      {data.users.length > 0 && (
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            creators
          </h2>
          <div className="mt-3 space-y-2">
            {data.users.map((u) => (
              <Link
                key={u.id}
                to="/u/$username"
                params={{ username: u.username }}
                className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 hover:ring-primary/60 transition"
              >
                <img src={u.avatar_url ?? ""} alt="" className="size-12 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-bold">{u.display_name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    @{u.username}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {data.posts.length > 0 && (
        <section className="mt-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            posts
          </h2>
          <PostGrid posts={data.posts} className="mt-3" />
        </section>
      )}
      {data.users.length === 0 && data.posts.length === 0 && (
        <p className="py-12 text-center font-mono text-xs text-muted-foreground">
          no echoes match that
        </p>
      )}
    </div>
  );
}

/**
 * @responsibility Render fresh creators rail + trending kinetics grid.
 */
function TrendingFeed({ data, loading }: { data: MockDiscoverData | undefined; loading: boolean }) {
  if (loading || !data) return <DiscoverLoader />;
  return (
    <div className="px-4 py-5">
      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          fresh creators
        </h2>
        <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
          {data.profiles.map((p) => (
            <Link
              key={p.id}
              to="/u/$username"
              params={{ username: p.username }}
              className="flex w-20 shrink-0 flex-col items-center gap-1.5"
            >
              <div className="grad-aurora rounded-full p-[2px]">
                <img
                  src={p.avatar_url ?? ""}
                  alt=""
                  className="size-16 rounded-full border-2 border-background"
                />
              </div>
              <span className="truncate w-full text-center font-mono text-[10px] text-muted-foreground">
                @{p.username}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          trending kinetics
        </h2>
        <PostGrid posts={data.posts} className="mt-3" />
      </section>
    </div>
  );
}

/**
 * @responsibility Debounce a string value for search queries.
 * @param value Live input
 * @param ms Delay in milliseconds
 * @returns Debounced string
 */
function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

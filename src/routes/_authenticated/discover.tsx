import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { search, getDiscover } from "@/lib/discovery.functions";
import { getCanvasTextColor, parseCanvas, resolveCanvasBackground } from "@/lib/canvas";
import { isDemoSession } from "@/lib/demo-session";
import {
  getMockDiscover,
  searchMock,
  type MockDiscoverData,
  type MockPost,
  type MockSearchData,
} from "@/lib/mock-data";
import { ChevronLeft, Newspaper, Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/discover")({
  component: DiscoverPage,
});

function DiscoverPage() {
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
  const demoMode = isDemoSession();

  const discover = useQuery<MockDiscoverData>({
    queryKey: ["discover", demoMode ? "demo" : "live"],
    queryFn: () => (demoMode ? getMockDiscover() : (fetchDiscover() as Promise<MockDiscoverData>)),
    staleTime: 30_000,
  });
  const results = useQuery<MockSearchData>({
    queryKey: ["search", demoMode ? "demo" : "live", debounced],
    queryFn: () =>
      demoMode
        ? searchMock(debounced)
        : (searchFn({ data: { q: debounced } }) as Promise<MockSearchData>),
    enabled: debounced.length > 0,
  });

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
      ) : (
        <TrendingFeed data={discover.data} loading={discover.isLoading} />
      )}
    </div>
  );
}

function SearchResults({ data, loading }: { data: MockSearchData | undefined; loading: boolean }) {
  if (loading) return <Loader />;
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

function TrendingFeed({ data, loading }: { data: MockDiscoverData | undefined; loading: boolean }) {
  if (loading || !data) return <Loader />;
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

function PostGrid({ posts, className }: { posts: MockPost[]; className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-1 ${className ?? ""}`}>
      {posts.map((p) => {
        const spec = parseCanvas(p.canvas_html);
        const background = resolveCanvasBackground(p.bg_gradient, p.id);
        const textColor = getCanvasTextColor(spec, background);
        return (
          <div
            key={p.id}
            className="relative aspect-[3/4] overflow-hidden rounded-md"
            style={{ background }}
          >
            {(p.post_type === "image" || p.post_type === "slideshow") && p.media_urls?.[0] && (
              <img
                src={p.media_urls[0]}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-90"
              />
            )}
            {p.post_type === "link" && <ArticleMiniClip title={spec.link?.title ?? spec.text} />}
            <div
              className="absolute inset-0 flex items-center justify-center p-1 text-center"
              style={{ fontFamily: spec.font, color: textColor, fontWeight: spec.weight }}
            >
              <span className="line-clamp-3 text-[10px] font-bold drop-shadow">{spec.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArticleMiniClip({ title }: { title: string }) {
  return (
    <div className="absolute inset-x-1.5 bottom-1.5 z-10 rounded-sm bg-[#f5f0df] p-1.5 text-[#17140f] shadow-lg">
      <div className="mb-0.5 flex items-center justify-between border-b border-black/25 pb-0.5 font-serif text-[6px] font-black uppercase tracking-widest">
        <span>Article</span>
        <Newspaper className="size-2.5" />
      </div>
      <p className="line-clamp-2 font-serif text-[9px] font-black leading-none">{title}</p>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="grad-aurora size-10 animate-pulse rounded-full" />
    </div>
  );
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

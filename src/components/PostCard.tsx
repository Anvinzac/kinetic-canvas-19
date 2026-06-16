import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Share2, MessageCircle, MoreVertical } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { KineticText } from "@/components/KineticText";
import { parseCanvas, COMMENT_CHIPS } from "@/lib/canvas";

type Profile = { id: string; username: string; display_name: string; avatar_url: string | null };
type Post = {
  id: string;
  author_id: string;
  post_type: string;
  canvas_html: string;
  media_urls: string[];
  bg_gradient: string | null;
  created_at: string;
};
type Comment = { id: string; post_id: string; user_id: string; chip_id: string; created_at: string };

export function PostCard({
  post,
  author,
  likes,
  comments,
  liked,
  onLike,
  onComment,
}: {
  post: Post;
  author?: Profile;
  likes: number;
  comments: Comment[];
  liked: boolean;
  onLike: () => void;
  onComment: (chip: string) => void;
}) {
  const spec = parseCanvas(post.canvas_html);
  const [slide, setSlide] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [showChips, setShowChips] = useState(false);
  const [flying, setFlying] = useState<{ id: number; chip: string }[]>([]);
  const flyId = useRef(0);

  // Auto-advance slideshow
  useEffect(() => {
    if (post.post_type !== "slideshow" || post.media_urls.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % post.media_urls.length), 2800);
    return () => clearInterval(t);
  }, [post.post_type, post.media_urls.length]);

  // Seed flying chips from existing comments
  useEffect(() => {
    const sample = comments.slice(-6);
    const seeded = sample.map((c, i) => ({ id: i, chip: c.chip_id }));
    setFlying(seeded);
    flyId.current = seeded.length;
  }, [comments]);

  function flyChip(chipId: string) {
    flyId.current += 1;
    const id = flyId.current;
    setFlying((prev) => [...prev, { id, chip: chipId }]);
    setTimeout(() => setFlying((prev) => prev.filter((c) => c.id !== id)), 6000);
  }

  return (
    <section
      className="relative h-[100dvh] w-full snap-start overflow-hidden"
      style={{ background: post.bg_gradient ?? "#000" }}
      onClick={() => setPlayKey((k) => k + 1)}
    >
      {/* media layer */}
      {post.post_type === "image" && post.media_urls[0] && (
        <img src={post.media_urls[0]} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {post.post_type === "video" && post.media_urls[0] && (
        <video
          src={post.media_urls[0]}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {post.post_type === "slideshow" && (
        <AnimatePresence mode="wait">
          <motion.img
            key={slide}
            src={post.media_urls[slide]}
            alt=""
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 size-full object-cover"
          />
        </AnimatePresence>
      )}

      {/* overlay darken for legibility on media */}
      {post.post_type !== "text" && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
      )}

      {/* kinetic text */}
      <KineticText spec={spec} playKey={playKey} />

      {/* slideshow indicators */}
      {post.post_type === "slideshow" && (
        <div className="absolute top-4 left-1/2 z-20 flex -translate-x-1/2 gap-1">
          {post.media_urls.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 w-8 rounded-full ${i === slide ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
      )}

      {/* author chip top-left */}
      {author && (
        <Link
          to="/u/$username"
          params={{ username: author.username }}
          className="absolute left-4 top-12 z-20 flex items-center gap-2"
        >
          <img src={author.avatar_url ?? ""} alt="" className="size-9 rounded-full border-2 border-white/80" />
          <div>
            <p className="text-sm font-bold text-white drop-shadow">@{author.username}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/70 drop-shadow">{post.post_type}</p>
          </div>
        </Link>
      )}

      {/* right action rail */}
      <div className="absolute right-3 bottom-32 z-20 flex flex-col items-center gap-5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className="flex flex-col items-center gap-1"
        >
          <span
            className={`flex size-12 items-center justify-center rounded-full transition ${
              liked ? "bg-[var(--color-magenta)] scale-110" : "bg-black/40 backdrop-blur"
            }`}
          >
            <Heart className={`size-6 ${liked ? "fill-white text-white" : "text-white"}`} />
          </span>
          <span className="text-xs font-bold text-white drop-shadow">{likes}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowChips((s) => !s);
          }}
          className="flex flex-col items-center gap-1"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <MessageCircle className="size-6 text-white" />
          </span>
          <span className="text-xs font-bold text-white drop-shadow">{comments.length}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (navigator.share) navigator.share({ title: "kinetic", url: window.location.href });
          }}
          className="flex flex-col items-center gap-1"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <Share2 className="size-5 text-white" />
          </span>
        </button>

        <button onClick={(e) => e.stopPropagation()} className="flex size-12 items-center justify-center rounded-full bg-black/40 backdrop-blur">
          <MoreVertical className="size-5 text-white" />
        </button>
      </div>

      {/* flying comments bottom strip */}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 h-16 overflow-hidden">
        {flying.map((c) => {
          const chip = COMMENT_CHIPS.find((x) => x.id === c.chip) ?? COMMENT_CHIPS[0];
          return (
            <div
              key={c.id}
              className="absolute right-0 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-black"
              style={{
                top: `${(c.id % 5) * 12}px`,
                animation: "chip-fly 6s linear forwards",
              }}
            >
              {chip.emoji} {chip.label}
            </div>
          );
        })}
      </div>

      {/* chip drawer */}
      <AnimatePresence>
        {showChips && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute inset-x-0 bottom-20 z-30 glass mx-3 rounded-2xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              tap to react
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {COMMENT_CHIPS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    flyChip(c.id);
                    onComment(c.id);
                  }}
                  className="rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 active:scale-90"
                >
                  <span className="mr-1">{c.emoji}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ChevronLeft, Type, Palette, Sparkles, Image as ImageIcon, Send, Move, Trash2 } from "lucide-react";
import { KineticText } from "@/components/KineticText";
import {
  DEFAULT_CANVAS,
  FONTS,
  ENTRANCES,
  LOOPS,
  PALETTE,
  GRADIENTS,
  serializeCanvas,
  type CanvasSpec,
} from "@/lib/canvas";
import { createPost } from "@/lib/social.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create")({
  component: CreatePage,
});

type Tool = "text" | "style" | "motion" | "position" | "bg" | "media";

function CreatePage() {
  const navigate = useNavigate();
  const submit = useServerFn(createPost);
  const [spec, setSpec] = useState<CanvasSpec>(DEFAULT_CANVAS);
  const [bg, setBg] = useState<string>(GRADIENTS[0]);
  const [tool, setTool] = useState<Tool>("text");
  const [postType, setPostType] = useState<"text" | "image" | "video" | "slideshow">("text");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState("");
  const [playKey, setPlayKey] = useState(0);
  const [posting, setPosting] = useState(false);

  function patch<K extends keyof CanvasSpec>(key: K, value: CanvasSpec[K]) {
    setSpec((s) => ({ ...s, [key]: value }));
  }

  async function publish() {
    if (!spec.text.trim()) return toast.error("type something first");
    setPosting(true);
    try {
      await submit({
        data: {
          post_type: postType,
          canvas_html: serializeCanvas(spec),
          media_urls: mediaUrls,
          bg_gradient: bg,
        },
      });
      toast.success("posted ✨");
      navigate({ to: "/feed" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-background">
      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button
          onClick={() => navigate({ to: "/feed" })}
          className="flex size-10 items-center justify-center rounded-full bg-black/40 backdrop-blur"
        >
          <ChevronLeft className="size-5 text-white" />
        </button>
        <button
          onClick={publish}
          disabled={posting}
          className="grad-aurora flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-glow)] disabled:opacity-50"
        >
          <Send className="size-4" />
          {posting ? "posting…" : "post"}
        </button>
      </header>

      {/* Canvas preview */}
      <div
        className="absolute inset-x-3 top-20 bottom-[280px] overflow-hidden rounded-3xl"
        style={{ background: bg }}
        onClick={() => setPlayKey((k) => k + 1)}
      >
        {postType === "image" && mediaUrls[0] && (
          <img src={mediaUrls[0]} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        {postType === "video" && mediaUrls[0] && (
          <video src={mediaUrls[0]} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" />
        )}
        {postType !== "text" && <div className="absolute inset-0 bg-black/30" />}
        <KineticText spec={spec} playKey={playKey} />
        <p className="absolute bottom-2 left-2 font-mono text-[10px] uppercase tracking-widest text-white/60">
          tap to replay
        </p>
      </div>

      {/* Bottom tool panel */}
      <div className="absolute inset-x-0 bottom-0 z-20 pb-[max(env(safe-area-inset-bottom),8px)]">
        {/* tool content */}
        <motion.div key={tool} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass mx-2 mb-2 rounded-2xl p-3">
          {tool === "text" && (
            <div className="space-y-2">
              <textarea
                value={spec.text}
                onChange={(e) => patch("text", e.target.value.slice(0, 140))}
                rows={2}
                placeholder="type your loudest thought…"
                className="w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {FONTS.map((f) => (
                  <button
                    key={f}
                    onClick={() => patch("font", f)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${spec.font === f ? "bg-white text-black" : "bg-white/10 text-white"}`}
                    style={{ fontFamily: f }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === "style" && (
            <div className="space-y-3">
              <SliderRow label="size" value={spec.size} min={24} max={180} onChange={(v) => patch("size", v)} />
              <SliderRow label="weight" value={spec.weight} min={100} max={900} step={100} onChange={(v) => patch("weight", v)} />
              <SliderRow label="tracking" value={spec.letterSpacing} min={-0.1} max={0.4} step={0.01} onChange={(v) => patch("letterSpacing", v)} />
              <div className="flex gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => patch("color", c)}
                    className={`size-7 rounded-full border-2 ${spec.color === c ? "border-white" : "border-white/20"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {tool === "motion" && (
            <div className="space-y-3">
              <Row label="entrance">
                <div className="flex flex-wrap gap-1.5">
                  {ENTRANCES.map((e) => (
                    <Pill key={e} active={spec.entrance === e} onClick={() => { patch("entrance", e); setPlayKey((k) => k + 1); }}>
                      {e}
                    </Pill>
                  ))}
                </div>
              </Row>
              <Row label="loop">
                <div className="flex flex-wrap gap-1.5">
                  {LOOPS.map((l) => (
                    <Pill key={l} active={spec.loop === l} onClick={() => patch("loop", l)}>
                      {l}
                    </Pill>
                  ))}
                </div>
              </Row>
              <SliderRow label="rotation" value={spec.rotation} min={-45} max={45} onChange={(v) => patch("rotation", v)} />
            </div>
          )}

          {tool === "position" && (
            <div className="space-y-3">
              <SliderRow label="x" value={spec.x} min={5} max={95} onChange={(v) => patch("x", v)} />
              <SliderRow label="y" value={spec.y} min={5} max={95} onChange={(v) => patch("y", v)} />
            </div>
          )}

          {tool === "bg" && (
            <div className="grid grid-cols-5 gap-2">
              {GRADIENTS.map((g) => (
                <button
                  key={g}
                  onClick={() => setBg(g)}
                  className={`h-12 rounded-xl border-2 ${bg === g ? "border-white" : "border-transparent"}`}
                  style={{ background: g }}
                />
              ))}
            </div>
          )}

          {tool === "media" && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                {(["text", "image", "video", "slideshow"] as const).map((t) => (
                  <Pill key={t} active={postType === t} onClick={() => setPostType(t)}>
                    {t}
                  </Pill>
                ))}
              </div>
              {postType !== "text" && (
                <>
                  <div className="flex gap-2">
                    <input
                      value={mediaInput}
                      onChange={(e) => setMediaInput(e.target.value)}
                      placeholder={`paste ${postType} url…`}
                      className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        if (!mediaInput.trim()) return;
                        setMediaUrls((m) => (postType === "slideshow" ? [...m, mediaInput.trim()] : [mediaInput.trim()]));
                        setMediaInput("");
                      }}
                      className="rounded-xl bg-white px-3 text-sm font-bold text-black"
                    >
                      add
                    </button>
                  </div>
                  {mediaUrls.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                      {mediaUrls.map((u, i) => (
                        <div key={i} className="relative shrink-0">
                          <img src={u} alt="" className="size-12 rounded-lg object-cover" />
                          <button
                            onClick={() => setMediaUrls((m) => m.filter((_, j) => j !== i))}
                            className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive"
                          >
                            <Trash2 className="size-2.5 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </motion.div>

        {/* tool tabs */}
        <div className="mx-2 flex justify-around rounded-2xl glass p-2">
          <ToolBtn icon={<Type className="size-5" />} label="text" active={tool === "text"} onClick={() => setTool("text")} />
          <ToolBtn icon={<Palette className="size-5" />} label="style" active={tool === "style"} onClick={() => setTool("style")} />
          <ToolBtn icon={<Sparkles className="size-5" />} label="motion" active={tool === "motion"} onClick={() => setTool("motion")} />
          <ToolBtn icon={<Move className="size-5" />} label="position" active={tool === "position"} onClick={() => setTool("position")} />
          <ToolBtn icon={<div className="size-5 rounded grad-aurora" />} label="bg" active={tool === "bg"} onClick={() => setTool("bg")} />
          <ToolBtn icon={<ImageIcon className="size-5" />} label="media" active={tool === "media"} onClick={() => setTool("media")} />
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition ${active ? "bg-white text-black" : "text-white"}`}
    >
      {icon}
      <span className="text-[9px] uppercase tracking-widest">{label}</span>
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-white/60">{label}</p>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs ${active ? "bg-white text-black" : "bg-white/10 text-white"}`}
    >
      {children}
    </button>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/60">
        <span>{label}</span>
        <span>{typeof value === "number" ? value.toFixed(step < 1 ? 2 : 0) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-magenta)]"
      />
    </div>
  );
}

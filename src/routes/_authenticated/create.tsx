import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Move,
  Palette,
  Send,
  SlidersHorizontal,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";
import { KineticText } from "@/components/KineticText";
import {
  DEFAULT_CANVAS,
  ENTRANCES,
  FONTS,
  GRADIENTS,
  LOOPS,
  PALETTE,
  serializeCanvas,
  type CanvasSpec,
} from "@/lib/canvas";
import { createPost } from "@/lib/social.functions";
import { isDemoSession } from "@/lib/demo-session";
import { addMockPost, getMockFeed } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create")({
  component: CreatePage,
});

type BackgroundMode = "gradient" | "photo" | "upload";
type StudioPage = "write" | "background" | "font" | "color" | "layout" | "motion";

const STATUS_CANVAS: CanvasSpec = {
  ...DEFAULT_CANVAS,
  text: "",
  size: 76,
  x: 50,
  y: 50,
  entrance: "scale",
  loop: "pulse",
};

const PRELOADED_PHOTOS = [
  {
    id: "city",
    label: "city glow",
    url: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "forest",
    label: "green quiet",
    url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "room",
    label: "warm room",
    url: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "road",
    label: "open road",
    url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "field",
    label: "soft field",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  },
];

const PLACEMENTS = [
  { label: "top", x: 50, y: 32 },
  { label: "center", x: 50, y: 50 },
  { label: "low", x: 50, y: 68 },
];

const PAGE_TITLES: Record<StudioPage, { title: string; subtitle: string }> = {
  write: { title: "STATUS STUDIO", subtitle: "type · preview · post" },
  background: { title: "BACKGROUND", subtitle: "gradient · photo · upload" },
  font: { title: "FONT", subtitle: "family · scale · weight" },
  color: { title: "COLOR", subtitle: "text tone" },
  layout: { title: "LAYOUT", subtitle: "placement" },
  motion: { title: "MOTION", subtitle: "entrance · loop" },
};

function CreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(createPost);
  const demoMode = isDemoSession();

  const [spec, setSpec] = useState<CanvasSpec>(STATUS_CANVAS);
  const [bg, setBg] = useState<string>(GRADIENTS[0]);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("gradient");
  const [selectedPhoto, setSelectedPhoto] = useState(PRELOADED_PHOTOS[0].url);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<StudioPage>("write");
  const [playKey, setPlayKey] = useState(0);
  const [posting, setPosting] = useState(false);

  const activePhoto =
    backgroundMode === "upload" ? uploadedPhoto : backgroundMode === "photo" ? selectedPhoto : null;
  const postType = activePhoto ? "image" : "text";
  const mediaUrls = activePhoto ? [activePhoto] : [];
  const canPost = spec.text.trim().length > 0 && !posting;
  const pageTitle = PAGE_TITLES[activePage];
  const backgroundSummary =
    backgroundMode === "gradient"
      ? "gradient"
      : backgroundMode === "photo"
        ? "preloaded photo"
        : "library photo";
  const fontSummary = `${spec.font} · ${spec.size}px`;
  const colorSummary = spec.color;
  const layoutSummary = PLACEMENTS.find((placement) => placement.y === spec.y)?.label ?? "custom";
  const motionSummary = `${spec.entrance} · ${spec.loop}`;

  function patch<K extends keyof CanvasSpec>(key: K, value: CanvasSpec[K]) {
    setSpec((s) => ({ ...s, [key]: value }));
  }

  function updateText(value: string) {
    const text = value.slice(0, 220);
    setSpec((s) => ({ ...s, text, size: suggestSize(text, s.size) }));
    setPlayKey((key) => key + 1);
  }

  function updatePlacement(x: number, y: number) {
    setSpec((s) => ({ ...s, x, y }));
    setPlayKey((key) => key + 1);
  }

  function replayPreview() {
    setPlayKey((key) => key + 1);
  }

  function goBack() {
    if (activePage === "write") {
      navigate({ to: "/feed" });
      return;
    }
    setActivePage("write");
  }

  async function publish() {
    if (!spec.text.trim()) return toast.error("type something first");
    setPosting(true);
    try {
      if (demoMode) {
        addMockPost({
          post_type: postType,
          canvas_html: serializeCanvas(spec),
          media_urls: mediaUrls,
          bg_gradient: bg,
        });
        qc.setQueryData(["feed", "demo"], getMockFeed());
        qc.invalidateQueries({ queryKey: ["discover"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
        toast.success("added to demo feed");
        navigate({ to: "/feed" });
        return;
      }

      await submit({
        data: {
          post_type: postType,
          canvas_html: serializeCanvas(spec),
          media_urls: mediaUrls,
          bg_gradient: bg,
        },
      });
      toast.success("posted");
      navigate({ to: "/feed" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("choose an image file");
      return;
    }
    if (file.size > 3_000_000) {
      toast.error("choose an image under 3MB");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setUploadedPhoto(dataUrl);
      setBackgroundMode("upload");
      toast.success("photo loaded");
    } catch {
      toast.error("could not load that photo");
    }
  }

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-40 glass flex items-center justify-between border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button
          onClick={goBack}
          className="-ml-1 grid size-9 place-items-center rounded-full bg-white/5 ring-1 ring-white/10"
          aria-label={activePage === "write" ? "Back" : "Back to writing"}
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="font-impact text-xl tracking-wider">{pageTitle.title}</h1>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            {pageTitle.subtitle}
          </p>
        </div>
        <button
          onClick={publish}
          disabled={!canPost}
          className="grad-aurora flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white shadow-[var(--shadow-glow)] transition disabled:opacity-40"
        >
          <Send className="size-3.5" />
          {posting ? "posting" : "post"}
        </button>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        <section className="sticky top-[72px] z-20 -mx-4 bg-background/95 px-4 pb-4 backdrop-blur">
          <div className="mx-auto flex justify-center">
            <button
              type="button"
              onClick={replayPreview}
              className="relative aspect-[9/16] h-[min(42dvh,360px)] min-h-[260px] overflow-hidden rounded-[24px] bg-black shadow-[0_24px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
              style={{ background: bg }}
              aria-label="Replay preview"
            >
              {activePhoto && (
                <img src={activePhoto} alt="" className="absolute inset-0 size-full object-cover" />
              )}
              {activePhoto && (
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/55" />
              )}
              {spec.text.trim() ? (
                <KineticText spec={spec} playKey={playKey} />
              ) : (
                <div className="absolute inset-0 grid place-items-center px-8 text-center">
                  <div>
                    <Type className="mx-auto size-7 text-white/65" />
                    <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                      type below
                    </p>
                  </div>
                </div>
              )}
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/65 backdrop-blur">
                tap to replay
              </span>
            </button>
          </div>
        </section>

        <section className="pt-2">
          {activePage === "write" && (
            <div className="space-y-4">
              <Panel icon={<Type />} title="sentence">
                <textarea
                  value={spec.text}
                  onChange={(event) => updateText(event.target.value)}
                  rows={5}
                  placeholder="write one or two sentences..."
                  className="w-full resize-none rounded-2xl bg-white/7 px-4 py-3 text-base leading-relaxed text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-primary/70"
                />
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span>{spec.text.trim() ? "live preview active" : "waiting for words"}</span>
                  <span>{spec.text.length}/220</span>
                </div>
              </Panel>

              <section className="space-y-2">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <Sparkles className="size-3.5" />
                  edit one thing
                </div>
                <div className="grid gap-2">
                  <StudioLink
                    icon={<Palette />}
                    label="Background"
                    value={backgroundSummary}
                    onClick={() => setActivePage("background")}
                  />
                  <StudioLink
                    icon={<Type />}
                    label="Font"
                    value={fontSummary}
                    onClick={() => setActivePage("font")}
                  />
                  <StudioLink
                    icon={<Palette />}
                    label="Color"
                    value={colorSummary}
                    onClick={() => setActivePage("color")}
                  />
                  <StudioLink
                    icon={<Move />}
                    label="Layout"
                    value={layoutSummary}
                    onClick={() => setActivePage("layout")}
                  />
                  <StudioLink
                    icon={<Sparkles />}
                    label="Motion"
                    value={motionSummary}
                    onClick={() => setActivePage("motion")}
                  />
                </div>
              </section>
            </div>
          )}

          {activePage === "background" && (
            <div className="space-y-4">
              <Panel icon={<ImageIcon />} title="background source">
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/25 p-1">
                  {[
                    { id: "gradient", label: "gradient", icon: <Palette className="size-3" /> },
                    { id: "photo", label: "photos", icon: <ImageIcon className="size-3" /> },
                    { id: "upload", label: "upload", icon: <Upload className="size-3" /> },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBackgroundMode(item.id as BackgroundMode)}
                      className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition ${
                        backgroundMode === item.id
                          ? "bg-white text-black"
                          : "text-muted-foreground hover:text-white"
                      }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>

                {backgroundMode === "gradient" && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {GRADIENTS.map((gradient) => (
                      <button
                        key={gradient}
                        type="button"
                        onClick={() => setBg(gradient)}
                        className={`aspect-square rounded-2xl border-2 transition ${
                          bg === gradient ? "border-white" : "border-transparent"
                        }`}
                        style={{ background: gradient }}
                        aria-label="Choose gradient background"
                      />
                    ))}
                  </div>
                )}

                {backgroundMode === "photo" && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {PRELOADED_PHOTOS.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => {
                          setSelectedPhoto(photo.url);
                          setBackgroundMode("photo");
                        }}
                        className={`relative aspect-[3/4] overflow-hidden rounded-2xl ring-2 transition ${
                          selectedPhoto === photo.url ? "ring-white" : "ring-transparent"
                        }`}
                      >
                        <img
                          src={photo.url}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                        />
                        <span className="absolute inset-x-1 bottom-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                          {photo.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {backgroundMode === "upload" && (
                  <div className="mt-3">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/25 bg-white/5 px-4 py-5 text-sm font-bold transition hover:border-primary/70">
                      <Upload className="size-4" />
                      choose from library
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => handleUpload(event.target.files?.[0])}
                      />
                    </label>
                    {uploadedPhoto && (
                      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
                        <img
                          src={uploadedPhoto}
                          alt=""
                          className="aspect-[3/4] h-20 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">library photo loaded</p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            used as background image
                          </p>
                        </div>
                        <Check className="size-4 text-primary" />
                      </div>
                    )}
                  </div>
                )}
              </Panel>
              <DoneButton onClick={() => setActivePage("write")} />
            </div>
          )}

          {activePage === "font" && (
            <div className="space-y-4">
              <Panel icon={<Type />} title="font family">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {FONTS.map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() => {
                        patch("font", font);
                        replayPreview();
                      }}
                      className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${
                        spec.font === font ? "bg-white text-black" : "bg-white/10 text-white"
                      }`}
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel icon={<SlidersHorizontal />} title="type scale">
                <div className="space-y-4">
                  <SliderRow
                    label="scale"
                    value={spec.size}
                    min={36}
                    max={132}
                    onChange={(value) => patch("size", value)}
                  />
                  <SliderRow
                    label="weight"
                    value={spec.weight}
                    min={300}
                    max={900}
                    step={100}
                    onChange={(value) => patch("weight", value)}
                  />
                </div>
              </Panel>
              <DoneButton onClick={() => setActivePage("write")} />
            </div>
          )}

          {activePage === "color" && (
            <div className="space-y-4">
              <Panel icon={<Palette />} title="text color">
                <div className="grid grid-cols-7 gap-2">
                  {PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => patch("color", color)}
                      className={`aspect-square rounded-full border-2 transition ${
                        spec.color === color ? "border-white" : "border-white/20"
                      }`}
                      style={{ background: color }}
                      aria-label={`Choose ${color}`}
                    />
                  ))}
                </div>
              </Panel>
              <DoneButton onClick={() => setActivePage("write")} />
            </div>
          )}

          {activePage === "layout" && (
            <div className="space-y-4">
              <Panel icon={<Move />} title="placement">
                <div className="grid grid-cols-3 gap-2">
                  {PLACEMENTS.map((placement) => (
                    <button
                      key={placement.label}
                      type="button"
                      onClick={() => updatePlacement(placement.x, placement.y)}
                      className={`rounded-xl px-3 py-3 text-xs font-bold ${
                        spec.y === placement.y ? "bg-white text-black" : "bg-white/10 text-white"
                      }`}
                    >
                      {placement.label}
                    </button>
                  ))}
                </div>
              </Panel>
              <DoneButton onClick={() => setActivePage("write")} />
            </div>
          )}

          {activePage === "motion" && (
            <div className="space-y-4">
              <Panel icon={<Sparkles />} title="entrance">
                <div className="flex flex-wrap gap-2">
                  {ENTRANCES.map((entrance) => (
                    <Pill
                      key={entrance}
                      active={spec.entrance === entrance}
                      onClick={() => {
                        patch("entrance", entrance);
                        replayPreview();
                      }}
                    >
                      {entrance}
                    </Pill>
                  ))}
                </div>
              </Panel>

              <Panel icon={<Sparkles />} title="loop">
                <div className="flex flex-wrap gap-2">
                  {LOOPS.map((loop) => (
                    <Pill
                      key={loop}
                      active={spec.loop === loop}
                      onClick={() => patch("loop", loop)}
                    >
                      {loop}
                    </Pill>
                  ))}
                </div>
              </Panel>
              <DoneButton onClick={() => setActivePage("write")} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="grid size-6 place-items-center rounded-lg bg-white/5 text-muted-foreground [&_svg]:size-3.5">
          {icon}
        </span>
        {title}
      </div>
      <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">{children}</div>
    </section>
  );
}

function StudioLink({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/5 px-3 text-left ring-1 ring-white/10 transition hover:bg-white/10"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/25 text-white/80 [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-white">{label}</span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {value}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-white/90"
    >
      done
    </button>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-xs font-bold ${
        active ? "bg-white text-black" : "bg-white/10 text-white"
      }`}
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
      <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/55">
        <span>{label}</span>
        <span>{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--color-magenta)]"
      />
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function suggestSize(text: string, current: number) {
  const clean = text.trim();
  if (!clean) return current;
  if (clean.length > 150) return Math.min(current, 54);
  if (clean.length > 90) return Math.min(current, 64);
  if (clean.length > 48) return Math.min(current, 76);
  return current;
}

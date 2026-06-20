import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Move,
  Newspaper,
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
  RHYTHMS,
  serializeCanvas,
  TEMPOS,
  TRANSITION_GRADIENT_PATHS,
  type CanvasLinkPreview,
  type CanvasSpec,
  type GradientTransitionPath,
} from "@/lib/canvas";
import { createPost } from "@/lib/social.functions";
import { isDemoSession } from "@/lib/demo-session";
import { addMockPost, getMockFeed } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create")({
  component: CreatePage,
});

type BackgroundMode = "gradient" | "transition" | "photo" | "upload";
type StudioPage = "write" | "background" | "font" | "color" | "layout" | "motion";
type AnimationTemplate = {
  id: string;
  label: string;
  mood: string;
  gradient: string;
  spec: Partial<Omit<CanvasSpec, "text">>;
};

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

const ANIMATION_TEMPLATES: AnimationTemplate[] = [
  {
    id: "neon-burst",
    label: "neon burst",
    mood: "snappy · burst",
    gradient: "linear-gradient(135deg,#FF006E,#8338EC)",
    spec: {
      font: "Bebas Neue",
      size: 92,
      color: "#ffffff",
      weight: 900,
      letterSpacing: -0.02,
      entrance: "scale",
      loop: "pulse",
      tempo: "snappy",
      rhythm: "burst",
      x: 50,
      y: 50,
      rotation: -1,
    },
  },
  {
    id: "editorial-drift",
    label: "editorial drift",
    mood: "slow · smooth",
    gradient: "linear-gradient(135deg,#073B4C,#06D6A0)",
    spec: {
      font: "Playfair Display",
      size: 76,
      color: "#ffffff",
      weight: 800,
      letterSpacing: -0.02,
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "smooth",
      x: 50,
      y: 50,
      rotation: -2,
    },
  },
  {
    id: "mono-sprint",
    label: "mono sprint",
    mood: "snappy · stagger",
    gradient: "linear-gradient(180deg,#000000,#1a1a2e)",
    spec: {
      font: "JetBrains Mono",
      size: 64,
      color: "#06FFA5",
      weight: 800,
      letterSpacing: -0.04,
      entrance: "split",
      loop: "shake",
      tempo: "snappy",
      rhythm: "stagger",
      x: 50,
      y: 55,
      rotation: 0,
    },
  },
  {
    id: "soft-signal",
    label: "soft signal",
    mood: "steady · smooth",
    gradient: "linear-gradient(135deg,#3A86FF,#06FFA5)",
    spec: {
      font: "Inter",
      size: 72,
      color: "#ffffff",
      weight: 850,
      letterSpacing: -0.03,
      entrance: "fade",
      loop: "float",
      tempo: "steady",
      rhythm: "smooth",
      x: 50,
      y: 48,
      rotation: 0,
    },
  },
  {
    id: "poster-pop",
    label: "poster pop",
    mood: "steady · burst",
    gradient: "linear-gradient(135deg,#FB5607,#FFBE0B)",
    spec: {
      font: "Space Grotesk",
      size: 84,
      color: "#000000",
      weight: 900,
      letterSpacing: -0.05,
      entrance: "slide",
      loop: "pulse",
      tempo: "steady",
      rhythm: "burst",
      x: 50,
      y: 46,
      rotation: 1,
    },
  },
];

const PAGE_TITLES: Record<StudioPage, { title: string; subtitle: string }> = {
  write: { title: "STATUS STUDIO", subtitle: "type · preview · post" },
  background: { title: "BACKGROUND", subtitle: "gradient · flow · photo" },
  font: { title: "FONT", subtitle: "family · scale · weight" },
  color: { title: "COLOR", subtitle: "text tone" },
  layout: { title: "LAYOUT", subtitle: "placement" },
  motion: { title: "MOTION", subtitle: "style · speed · rhythm" },
};

const DEFAULT_TRANSITION_PATH: GradientTransitionPath = TRANSITION_GRADIENT_PATHS[0] ?? {
  id: "aurora-rush",
  label: "aurora rush",
  mood: "hot pink -> electric blue -> acid green",
  gradients: [GRADIENTS[0], GRADIENTS[1], GRADIENTS[5]],
};

function CreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(createPost);
  const demoMode = isDemoSession();

  const [spec, setSpec] = useState<CanvasSpec>(STATUS_CANVAS);
  const [bg, setBg] = useState<string>(GRADIENTS[0]);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("gradient");
  const [selectedGradientPath, setSelectedGradientPath] =
    useState<GradientTransitionPath>(DEFAULT_TRANSITION_PATH);
  const [selectedPhoto, setSelectedPhoto] = useState(PRELOADED_PHOTOS[0].url);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [articleUrl, setArticleUrl] = useState("");
  const [articleOpen, setArticleOpen] = useState(false);
  const [activePage, setActivePage] = useState<StudioPage>("write");
  const [playKey, setPlayKey] = useState(0);
  const [posting, setPosting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activePhoto =
    backgroundMode === "upload" ? uploadedPhoto : backgroundMode === "photo" ? selectedPhoto : null;
  const normalizedArticleUrl = articleOpen ? normalizeArticleUrl(articleUrl) : "";
  const articlePreview = normalizedArticleUrl
    ? {
        url: normalizedArticleUrl,
        host: getUrlHost(normalizedArticleUrl),
        title: getArticleTitle(spec.text),
      }
    : null;
  const articleInvalid = articleOpen && articleUrl.trim().length > 0 && !articlePreview;
  const selectedTransitionGradients =
    selectedGradientPath.gradients.length > 0 ? selectedGradientPath.gradients : [bg];
  const backgroundSpec =
    backgroundMode === "transition"
      ? ({
          backgroundStyle: "transition",
          gradientPath: [...selectedTransitionGradients],
        } satisfies Pick<CanvasSpec, "backgroundStyle" | "gradientPath">)
      : ({
          backgroundStyle: "static",
          gradientPath: [],
        } satisfies Pick<CanvasSpec, "backgroundStyle" | "gradientPath">);
  const publishSpec: CanvasSpec = {
    ...spec,
    ...backgroundSpec,
    link: articlePreview,
  };
  const publishBackground =
    backgroundMode === "transition" ? (selectedTransitionGradients[0] ?? bg) : bg;
  const postType = articlePreview ? "link" : activePhoto ? "image" : "text";
  const mediaUrls = articlePreview ? [articlePreview.url] : activePhoto ? [activePhoto] : [];
  const canPost = spec.text.trim().length > 0 && !posting && !articleInvalid;
  const pageTitle = PAGE_TITLES[activePage];
  const backgroundSummary =
    backgroundMode === "gradient"
      ? "gradient"
      : backgroundMode === "transition"
        ? selectedGradientPath.label
        : backgroundMode === "photo"
          ? "preloaded photo"
          : "library photo";
  const fontSummary = `${spec.font} · ${spec.size}px`;
  const colorSummary = spec.color;
  const layoutSummary = PLACEMENTS.find((placement) => placement.y === spec.y)?.label ?? "custom";
  const motionSummary = `${spec.entrance} · ${spec.tempo} · ${spec.rhythm}`;
  const previewPaneHeight = "min(70dvh, 576px, calc((100vw - 152px) * 16 / 9))";
  const previewBackground =
    backgroundMode === "transition"
      ? (selectedTransitionGradients[playKey % selectedTransitionGradients.length] ?? bg)
      : bg;
  const previewSlidingBackground =
    backgroundMode === "transition"
      ? getComposerSlidingBackground(selectedTransitionGradients, playKey)
      : null;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 320)}px`;
  }, [spec.text]);

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

  function applyTemplate(template: AnimationTemplate) {
    setBackgroundMode("gradient");
    setBg(template.gradient);
    setSpec((s) => ({
      ...s,
      ...template.spec,
      text: s.text,
      size: suggestSize(s.text, template.spec.size ?? s.size),
    }));
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
    if (articleInvalid) return toast.error("that article link looks off");
    setPosting(true);
    try {
      if (demoMode) {
        addMockPost({
          post_type: postType,
          canvas_html: serializeCanvas(publishSpec),
          media_urls: mediaUrls,
          bg_gradient: publishBackground,
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
          canvas_html: serializeCanvas(publishSpec),
          media_urls: mediaUrls,
          bg_gradient: publishBackground,
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
    <div className="min-h-[100dvh] overflow-y-auto bg-background pb-8 text-foreground">
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
        <section className="sticky top-[72px] z-20 -mx-4 bg-background/95 px-1 pb-4 backdrop-blur">
          <div className="flex items-stretch gap-2 overflow-hidden">
            <button
              type="button"
              onClick={replayPreview}
              className="relative aspect-[9/16] shrink-0 overflow-hidden rounded-[24px] bg-black shadow-[0_24px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
              style={{ height: previewPaneHeight }}
              aria-label="Replay preview"
            >
              {previewSlidingBackground ? (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0"
                  style={{
                    background: previewSlidingBackground.background,
                    width: previewSlidingBackground.width,
                  }}
                  initial={false}
                  animate={{ x: previewSlidingBackground.x }}
                  transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : (
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: previewBackground }}
                />
              )}
              {backgroundMode === "transition" && (
                <motion.span
                  key={`${previewBackground}-sheen`}
                  aria-hidden
                  className="absolute inset-0 opacity-45 mix-blend-screen"
                  style={{
                    background:
                      "linear-gradient(120deg,rgba(255,255,255,0.24),transparent 44%,rgba(255,255,255,0.16))",
                  }}
                  initial={{ x: "-18%", opacity: 0 }}
                  animate={{ x: "0%", opacity: 0.45 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              {activePhoto && (
                <img src={activePhoto} alt="" className="absolute inset-0 size-full object-cover" />
              )}
              {activePhoto && (
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/55" />
              )}
              {spec.text.trim() ? (
                <KineticText
                  spec={spec}
                  playKey={playKey}
                  scaleToCanvas
                  background={backgroundMode === "transition" ? selectedTransitionGradients : bg}
                />
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
              {articlePreview && (
                <span className="absolute left-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white text-black shadow-[0_10px_28px_rgba(0,0,0,0.4)]">
                  <Link2 className="size-4" />
                </span>
              )}
            </button>
            <div className="flex w-[124px] shrink-0 flex-col" style={{ height: previewPaneHeight }}>
              <div className="mb-2 flex items-center justify-between px-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/55">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3" />
                  templates
                </span>
                <span className="text-white/35">{ANIMATION_TEMPLATES.length}</span>
              </div>
              <div className="-mr-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar-hide">
                {ANIMATION_TEMPLATES.map((template) => (
                  <TemplateButton
                    key={template.id}
                    template={template}
                    active={isTemplateActive(template, spec, bg, backgroundMode)}
                    onClick={() => applyTemplate(template)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pt-2">
          {activePage === "write" && (
            <div className="space-y-4">
              <Panel icon={<Type />} title="sentence">
                <textarea
                  ref={textareaRef}
                  value={spec.text}
                  onChange={(event) => updateText(event.target.value)}
                  rows={2}
                  placeholder="write one or two sentences..."
                  className="block w-full resize-none overflow-y-auto rounded-2xl bg-white/7 px-4 py-3 text-base leading-relaxed text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-primary/70"
                />
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((open) => !open)}
                    className="flex items-center gap-1.5 text-left text-muted-foreground transition hover:text-white"
                    aria-expanded={advancedOpen}
                  >
                    <SlidersHorizontal className="size-3.5" />
                    advanced options
                    <ChevronRight
                      className={`size-3 transition ${advancedOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                  <span>{spec.text.length}/220</span>
                </div>

                {advancedOpen && (
                  <div className="mt-3 grid gap-2">
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
                )}

                <div className="mt-3 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => setArticleOpen((open) => !open)}
                    aria-expanded={articleOpen}
                    className={`flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition ${
                      articleOpen || articlePreview
                        ? "bg-white/[0.07] ring-1 ring-white/15"
                        : "bg-transparent hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-white/80">
                      <Link2 className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-white">
                        {articlePreview ? "article link attached" : "attach article link"}
                      </span>
                      <span className="block truncate font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                        {articlePreview
                          ? articlePreview.host
                          : "optional · turns this into a link post"}
                      </span>
                    </span>
                    <ChevronRight
                      className={`size-4 shrink-0 text-muted-foreground transition ${
                        articleOpen ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  {articleOpen && (
                    <div className="mt-2 space-y-2">
                      <input
                        value={articleUrl}
                        onChange={(event) => setArticleUrl(event.target.value)}
                        placeholder="https://example.com/article"
                        inputMode="url"
                        autoComplete="off"
                        className={`w-full rounded-2xl bg-white/7 px-4 py-3 text-sm text-white outline-none ring-1 placeholder:text-white/35 focus:ring-primary/70 ${
                          articleInvalid ? "ring-rose-400/70" : "ring-white/10"
                        }`}
                      />
                      {articleInvalid && (
                        <p className="px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-rose-300/85">
                          link doesn't look valid yet
                        </p>
                      )}
                      {articlePreview && <ArticleClip preview={articlePreview} />}
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {activePage === "background" && (
            <div className="space-y-4">
              <Panel icon={<ImageIcon />} title="background source">
                <div className="grid grid-cols-4 gap-1 rounded-2xl bg-black/25 p-1">
                  {[
                    { id: "gradient", label: "gradient", icon: <Palette className="size-3" /> },
                    { id: "transition", label: "flow", icon: <Sparkles className="size-3" /> },
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

                {backgroundMode === "transition" && (
                  <div className="mt-3 space-y-2">
                    {TRANSITION_GRADIENT_PATHS.map((path) => (
                      <GradientPathButton
                        key={path.id}
                        path={path}
                        active={selectedGradientPath.id === path.id}
                        onClick={() => {
                          setSelectedGradientPath(path);
                          setBg(path.gradients[0] ?? GRADIENTS[0]);
                          replayPreview();
                        }}
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

              <Panel icon={<SlidersHorizontal />} title="speed">
                <div className="flex flex-wrap gap-2">
                  {TEMPOS.map((tempo) => (
                    <Pill
                      key={tempo}
                      active={spec.tempo === tempo}
                      onClick={() => {
                        patch("tempo", tempo);
                        replayPreview();
                      }}
                    >
                      {tempo}
                    </Pill>
                  ))}
                </div>
              </Panel>

              <Panel icon={<Sparkles />} title="rhythm">
                <div className="flex flex-wrap gap-2">
                  {RHYTHMS.map((rhythm) => (
                    <Pill
                      key={rhythm}
                      active={spec.rhythm === rhythm}
                      onClick={() => {
                        patch("rhythm", rhythm);
                        replayPreview();
                      }}
                    >
                      {rhythm}
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

function TemplateButton({
  template,
  active,
  onClick,
}: {
  template: AnimationTemplate;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative grid w-full grid-cols-[40px_minmax(0,1fr)] items-center gap-2 overflow-visible rounded-xl p-1.5 text-left transition ${
        active
          ? "bg-white/[0.10] ring-2 ring-white shadow-[0_4px_14px_-8px_rgba(255,255,255,0.5)]"
          : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07] hover:ring-white/25"
      }`}
    >
      <span className="relative block w-full">
        <span
          className="relative block aspect-square w-full overflow-hidden rounded-lg"
          style={{ background: template.gradient }}
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_25%_0%,rgba(255,255,255,0.28),transparent_60%)]" />
          <span
            className="absolute left-1/2 top-1/2 leading-none"
            style={{
              color: template.spec.color,
              fontFamily: template.spec.font,
              fontWeight: template.spec.weight ?? 900,
              letterSpacing: `${template.spec.letterSpacing ?? -0.02}em`,
              fontSize: 15,
              transform: `translate(-50%, -50%) rotate(${template.spec.rotation ?? 0}deg)`,
              textShadow: "0 1px 6px rgba(0,0,0,0.32)",
            }}
          >
            Aa
          </span>
        </span>
        {active && (
          <span className="absolute -right-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full bg-white text-black shadow-[0_3px_10px_rgba(0,0,0,0.35)] ring-1 ring-black/40">
            <Check className="size-2" strokeWidth={4} />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 block text-[10.5px] font-black leading-[1.1] text-white">
          {template.label}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/55">
          {template.mood}
        </span>
      </span>
    </button>
  );
}

function GradientPathButton({
  path,
  active,
  onClick,
}: {
  path: GradientTransitionPath;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${
        active ? "bg-white text-black" : "bg-white/[0.06] text-white hover:bg-white/[0.10]"
      }`}
    >
      <span className="flex h-12 w-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
        {path.gradients.map((gradient, index) => (
          <span
            key={`${path.id}-${index}`}
            className="min-w-0 flex-1"
            style={{ background: gradient }}
            aria-hidden
          />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">{path.label}</span>
        <span
          className={`mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.14em] ${
            active ? "text-black/55" : "text-white/55"
          }`}
        >
          {path.mood}
        </span>
      </span>
      {active && <Check className="size-4 shrink-0" strokeWidth={3} />}
    </button>
  );
}

function ArticleClip({ preview, className }: { preview: CanvasLinkPreview; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-[#f5f0df] p-3 text-[#17140f] shadow-[0_14px_35px_rgba(0,0,0,0.28)] ring-1 ring-black/10 ${
        className ?? ""
      }`}
      style={{
        clipPath: "polygon(0 0,100% 0,100% 88%,97% 88%,97% 100%,88% 92%,0 92%,0 62%,2% 60%,0 58%)",
      }}
    >
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#000_1px,transparent_1px)] [background-size:100%_7px]" />
      <div className="relative">
        <div className="flex items-center justify-between border-b border-black/30 pb-1 font-serif text-[10px] font-black uppercase tracking-[0.18em]">
          <span>Article clipping</span>
          <Newspaper className="size-3.5" />
        </div>
        <div className="mt-2 grid grid-cols-[1fr_34px] gap-2">
          <div className="min-w-0">
            <p className="line-clamp-2 font-serif text-base font-black leading-[0.95]">
              {preview.title}
            </p>
            <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-black/55">
              {preview.host}
            </p>
          </div>
          <span className="grid size-8 place-items-center rounded-sm border border-black/25 bg-black/10">
            <ExternalLink className="size-4" />
          </span>
        </div>
      </div>
    </div>
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

function isTemplateActive(
  template: AnimationTemplate,
  spec: CanvasSpec,
  bg: string,
  backgroundMode: BackgroundMode,
) {
  return (
    backgroundMode === "gradient" &&
    bg === template.gradient &&
    spec.font === template.spec.font &&
    spec.entrance === template.spec.entrance &&
    spec.loop === template.spec.loop &&
    spec.tempo === template.spec.tempo &&
    spec.rhythm === template.spec.rhythm
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

function normalizeArticleUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function getUrlHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "linked article";
  }
}

function getArticleTitle(text: string) {
  const sentence = text.replace(/\s+/g, " ").trim();
  if (!sentence) return "Linked article";
  return sentence.length > 72 ? `${sentence.slice(0, 69).trim()}...` : sentence;
}

function getComposerSlidingBackground(gradients: readonly string[], shiftPage: number) {
  const colors = getComposerTransitionColors(gradients);
  if (colors.length < 2) return null;

  const segmentCount = Math.max(64, colors.length * 12);
  const stripColors = Array.from(
    { length: segmentCount + 1 },
    (_, index) => colors[index % colors.length],
  );
  const stops = stripColors
    .map((color, index) => `${color} ${((index / segmentCount) * 100).toFixed(3)}%`)
    .join(", ");

  return {
    background: `linear-gradient(100deg, ${stops})`,
    width: `${segmentCount * 100}%`,
    x: `-${shiftPage * (100 / segmentCount)}%`,
  };
}

function getComposerTransitionColors(gradients: readonly string[]) {
  const colors = gradients.reduce<string[]>((items, gradient, index) => {
    const stops = extractGradientColors(gradient);
    if (stops.length < 2) return items;
    if (index === 0) items.push(stops[0]);
    items.push(stops[stops.length - 1]);
    return items;
  }, []);

  if (colors.length < 2) return [];
  return colors[0] === colors[colors.length - 1] ? colors.slice(0, -1) : colors;
}

function extractGradientColors(value: string) {
  return (
    value.match(
      /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)/g,
    ) ?? []
  );
}

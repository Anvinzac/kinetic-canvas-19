import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Link2,
  Move,
  Newspaper,
  Palette,
  Plus,
  Send,
  SlidersHorizontal,
  Sparkles,
  Type,
  Upload,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CanvasStickerLayer } from "@/components/CanvasStickerLayer";
import {
  ENTRANCES,
  FONTS,
  GRADIENTS,
  LOOPS,
  PALETTE,
  RHYTHMS,
  serializeCanvas,
  TEMPOS,
  TRANSITION_GRADIENT_PATHS,
  isUsableCanvasBackground,
  resolveCanvasBackground,
  type CanvasSpec,
  type GradientTransitionPath,
  CANVAS_PATTERN_THEMES,
  getCanvasPatternTheme,
  getPatternBackgroundPosition,
  CANVAS_SCENE_THEMES,
  getCanvasSceneTheme,
  getSceneBackgroundStyle,
} from "@/features/canvas";
import { KineticText } from "@/features/kinetic-text";
import { discoveryKeys } from "@/features/discovery";
import { createPost, socialKeys } from "@/features/social";
import { isDemoSession } from "@/features/session";
import { addMockPost, getMockFeed } from "@/lib/mock-data";
import {
  createEmojiSticker,
  getAccentKeyword,
  getAccentRecommendation,
  type AccentRecommendation,
} from "./lib/accent-suggestions";
import { getArticleTitle, getUrlHost, normalizeArticleUrl } from "./lib/article";
import {
  getComposerPages,
  joinComposerPages,
  MAX_STATUS_CHARS,
} from "./lib/composer-pages";
import { readFileAsDataUrl } from "./lib/read-file";
import { suggestSize } from "./lib/size";
import { getComposerSlidingBackground } from "./lib/sliding-background";
import {
  ANIMATION_TEMPLATES,
  DEFAULT_TRANSITION_PATH,
  isTemplateActive,
  PAGE_TITLES,
  PLACEMENTS,
  PRELOADED_PHOTOS,
  PRELOADED_VIDEOS,
  STATUS_CANVAS,
} from "./lib/templates";
import type { AnimationTemplate, BackgroundMode, StudioPage } from "./types";
import { AccentRecommendationCard } from "./components/AccentRecommendationCard";
import { ArticleClip } from "./components/ArticleClip";
import { ComposerPreviewCanvas } from "./components/ComposerPreviewCanvas";
import { DoneButton } from "./components/DoneButton";
import { GradientPathButton } from "./components/GradientPathButton";
import { getPageBackdropActionIcon, getPageBackdropActionLabel } from "./components/page-backdrop";
import { Panel } from "./components/Panel";
import { Pill } from "./components/Pill";
import { SliderRow } from "./components/SliderRow";
import { StudioLink } from "./components/StudioLink";
import { TemplateButton } from "./components/TemplateButton";

export function CreateStudioPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(createPost);
  const demoMode = isDemoSession();

  const [spec, setSpec] = useState<CanvasSpec>(STATUS_CANVAS);
  const [bg, setBg] = useState<string>(GRADIENTS[0]);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("gradient");
  const [selectedGradientPath, setSelectedGradientPath] =
    useState<GradientTransitionPath>(DEFAULT_TRANSITION_PATH);
  const [selectedSceneId, setSelectedSceneId] = useState("paper-cut-sunrise");
  const [selectedPatternId, setSelectedPatternId] = useState("waves");
  const [selectedPhoto, setSelectedPhoto] = useState(PRELOADED_PHOTOS[0].url);
  const [selectedVideo, setSelectedVideo] = useState(PRELOADED_VIDEOS[0].url);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [articleUrl, setArticleUrl] = useState("");
  const [articleOpen, setArticleOpen] = useState(false);
  const [activePage, setActivePage] = useState<StudioPage>("write");
  const [playKey, setPlayKey] = useState(0);
  const [previewAnimating, setPreviewAnimating] = useState(false);
  const [composerCanvasHeight, setComposerCanvasHeight] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);
  const [accentRecommendation, setAccentRecommendation] = useState<AccentRecommendation | null>(
    null,
  );
  const [accentLoading, setAccentLoading] = useState(false);
  const [dismissedAccentKeyword, setDismissedAccentKeyword] = useState<string | null>(null);
  const [activeTextPage, setActiveTextPage] = useState(0);
  const textareaRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  const composerPages = getComposerPages(spec.text);
  const currentTextPage = composerPages[activeTextPage] ?? composerPages[0] ?? "";
  const publishText = composerPages
    .map((page) => page.trim())
    .filter(Boolean)
    .join("\n");
  const activePhoto =
    backgroundMode === "upload" ? uploadedPhoto : backgroundMode === "photo" ? selectedPhoto : null;
  const activeVideo = backgroundMode === "video" ? selectedVideo : null;
  const normalizedArticleUrl = articleOpen ? normalizeArticleUrl(articleUrl) : "";
  const articlePreview = normalizedArticleUrl
    ? {
        url: normalizedArticleUrl,
        host: getUrlHost(normalizedArticleUrl),
        title: getArticleTitle(publishText),
      }
    : null;
  const articleInvalid = articleOpen && articleUrl.trim().length > 0 && !articlePreview;
  const safeBg = resolveCanvasBackground(bg, "composer");
  const selectedTransitionGradients =
    selectedGradientPath.gradients.filter(isUsableCanvasBackground).length > 0
      ? selectedGradientPath.gradients.filter(isUsableCanvasBackground)
      : [safeBg];
  const backgroundSpec =
    backgroundMode === "transition"
      ? ({
          backgroundStyle: "transition",
          gradientPath: [...selectedTransitionGradients],
          backgroundScene: undefined,
          backgroundPattern: undefined,
        } satisfies Pick<
          CanvasSpec,
          "backgroundStyle" | "gradientPath" | "backgroundScene" | "backgroundPattern"
        >)
      : ({
          backgroundStyle: "static",
          gradientPath: [],
          backgroundScene: backgroundMode === "scene" ? selectedSceneId : undefined,
          backgroundPattern: backgroundMode === "pattern" ? selectedPatternId : undefined,
        } satisfies Pick<
          CanvasSpec,
          "backgroundStyle" | "gradientPath" | "backgroundScene" | "backgroundPattern"
        >);
  const previewSpec: CanvasSpec = { ...spec, text: currentTextPage, ...backgroundSpec };
  const publishSpec: CanvasSpec = {
    ...spec,
    text: publishText,
    ...backgroundSpec,
    link: articlePreview,
  };
  const publishBackground =
    backgroundMode === "transition"
      ? resolveCanvasBackground(selectedTransitionGradients[0], "publish")
      : backgroundMode === "scene"
        ? (getCanvasSceneTheme(selectedSceneId)?.base ?? safeBg)
        : backgroundMode === "pattern"
          ? (getCanvasPatternTheme(selectedPatternId)?.base ?? safeBg)
          : safeBg;
  const postType = articlePreview ? "link" : activeVideo ? "video" : activePhoto ? "image" : "text";
  const mediaUrls = articlePreview
    ? [articlePreview.url]
    : activeVideo
      ? [activeVideo]
      : activePhoto
        ? [activePhoto]
        : [];
  const canPost = publishText.length > 0 && !posting && !articleInvalid;
  const pageTitle = PAGE_TITLES[activePage];
  const backgroundSummary =
    backgroundMode === "gradient"
      ? "gradient"
      : backgroundMode === "transition"
        ? selectedGradientPath.label
        : backgroundMode === "scene"
          ? (getCanvasSceneTheme(selectedSceneId)?.label ?? "scene")
          : backgroundMode === "pattern"
            ? (getCanvasPatternTheme(selectedPatternId)?.label ?? "pattern")
            : backgroundMode === "photo"
              ? "preloaded photo"
              : backgroundMode === "video"
                ? "video"
                : "library photo";
  const fontSummary = `${spec.font} · ${spec.size}px`;
  const colorSummary = spec.color;
  const layoutSummary = PLACEMENTS.find((placement) => placement.y === spec.y)?.label ?? "custom";
  const motionSummary = `${spec.entrance} · ${spec.tempo} · ${spec.rhythm}`;
  const previewPaneHeight = "min(70dvh, 576px)";
  const previewRowHeight = composerCanvasHeight
    ? `${composerCanvasHeight}px`
    : previewPaneHeight;
  const previewBackground =
    backgroundMode === "transition"
      ? resolveCanvasBackground(
          selectedTransitionGradients[playKey % selectedTransitionGradients.length],
          "preview",
        )
      : safeBg;
  const previewSlidingBackground =
    backgroundMode === "transition"
      ? getComposerSlidingBackground(selectedTransitionGradients, playKey)
      : null;
  const previewScene = backgroundMode === "scene" ? getCanvasSceneTheme(selectedSceneId) : null;
  const previewPattern =
    backgroundMode === "pattern" ? getCanvasPatternTheme(selectedPatternId) : null;

  useEffect(() => {
    textareaRefs.current.forEach((el) => {
      if (!el) return;
      el.style.height = "0px";
      el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 180)}px`;
    });
  }, [spec.text]);

  useEffect(() => {
    if (activeTextPage >= composerPages.length) {
      setActiveTextPage(Math.max(0, composerPages.length - 1));
    }
  }, [activeTextPage, composerPages.length]);

  useEffect(() => {
    const keyword = getAccentKeyword(currentTextPage, dismissedAccentKeyword);
    if (!keyword || spec.stickers?.some((sticker) => sticker.word === keyword)) {
      setAccentRecommendation(null);
      setAccentLoading(false);
      return;
    }

    let cancelled = false;
    setAccentLoading(true);
    const timer = window.setTimeout(() => {
      getAccentRecommendation(keyword).then((recommendation) => {
        if (cancelled) return;
        setAccentRecommendation(recommendation);
        setAccentLoading(false);
      });
    }, 420);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentTextPage, dismissedAccentKeyword, spec.stickers]);

  function patch<K extends keyof CanvasSpec>(key: K, value: CanvasSpec[K]) {
    setSpec((s) => ({ ...s, [key]: value }));
  }

  function updateTextPage(pageIndex: number, value: string) {
    const pieces = value.replace(/\r\n?/g, "\n").split("\n");
    const nextPage = pageIndex + Math.max(0, pieces.length - 1);
    const previewPages = [...composerPages];
    previewPages.splice(pageIndex, 1, ...pieces);
    const limitedPreviewPages = getComposerPages(joinComposerPages(previewPages));
    const focusedPage = Math.min(nextPage, limitedPreviewPages.length - 1);

    setSpec((s) => {
      const pages = getComposerPages(s.text);
      pages.splice(pageIndex, 1, ...pieces);
      const limitedText = joinComposerPages(pages);
      const limitedPages = getComposerPages(limitedText);
      const focusedText = limitedPages[Math.min(nextPage, limitedPages.length - 1)] ?? "";
      return { ...s, text: limitedText, size: suggestSize(focusedText, s.size) };
    });

    setActiveTextPage(focusedPage);
    setPreviewAnimating(false);
    setAccentRecommendation(null);
    if (pieces.length > 1) {
      window.setTimeout(() => textareaRefs.current[focusedPage]?.focus(), 0);
    }
  }

  function insertTextPageAfter(pageIndex: number) {
    if (spec.text.length >= MAX_STATUS_CHARS) return;
    const nextPage = pageIndex + 1;
    setSpec((s) => {
      const pages = getComposerPages(s.text);
      pages.splice(nextPage, 0, "");
      return { ...s, text: joinComposerPages(pages) };
    });
    setActiveTextPage(nextPage);
    setPreviewAnimating(false);
    setAccentRecommendation(null);
    window.setTimeout(() => textareaRefs.current[nextPage]?.focus(), 0);
  }

  function removeTextPage(pageIndex: number) {
    setSpec((s) => {
      const pages = getComposerPages(s.text);
      if (pages.length <= 1) return { ...s, text: "" };
      pages.splice(pageIndex, 1);
      return { ...s, text: joinComposerPages(pages) };
    });
    setActiveTextPage((page) => Math.max(0, Math.min(page, composerPages.length - 2)));
    setPreviewAnimating(false);
    setAccentRecommendation(null);
  }

  function selectTextPage(pageIndex: number) {
    setActiveTextPage(pageIndex);
    setPreviewAnimating(false);
    window.setTimeout(() => textareaRefs.current[pageIndex]?.focus(), 0);
  }

  function openPageBackdropEditor(pageIndex: number) {
    setActiveTextPage(pageIndex);
    setPreviewAnimating(false);
    setActivePage("background");
  }

  function acceptEmojiAccent() {
    if (!accentRecommendation) return;
    setSpec((s) => ({
      ...s,
      stickers: [
        ...(s.stickers ?? []).filter((sticker) => sticker.word !== accentRecommendation.keyword),
        createEmojiSticker(
          accentRecommendation.keyword,
          accentRecommendation.emoji,
          s.stickers?.length ?? 0,
        ),
      ],
    }));
    setAccentRecommendation(null);
    setDismissedAccentKeyword(accentRecommendation.keyword);
    setPreviewAnimating(false);
  }

  function rejectAccent() {
    if (!accentRecommendation) return;
    setDismissedAccentKeyword(accentRecommendation.keyword);
    setAccentRecommendation(null);
  }

  function removeAccent(id: string) {
    setSpec((s) => ({
      ...s,
      stickers: (s.stickers ?? []).filter((sticker) => sticker.id !== id),
    }));
    setPreviewAnimating(false);
  }

  function updatePlacement(x: number, y: number) {
    setSpec((s) => ({ ...s, x, y }));
    setPreviewAnimating(false);
  }

  function applyTemplate(template: AnimationTemplate) {
    setBackgroundMode(template.backdrop.mode);
    if (template.backdrop.mode === "gradient") {
      setBg(template.backdrop.gradient);
    }
    if (template.backdrop.mode === "transition") {
      setSelectedGradientPath(template.backdrop.path);
      setBg(template.backdrop.path.gradients[0] ?? GRADIENTS[0]);
    }
    if (template.backdrop.mode === "scene") {
      setSelectedSceneId(template.backdrop.sceneId);
      setBg(getCanvasSceneTheme(template.backdrop.sceneId)?.base ?? GRADIENTS[0]);
    }
    if (template.backdrop.mode === "pattern") {
      setSelectedPatternId(template.backdrop.patternId);
      setBg(getCanvasPatternTheme(template.backdrop.patternId)?.base ?? GRADIENTS[0]);
    }
    if (template.backdrop.mode === "photo") {
      setSelectedPhoto(template.backdrop.url);
    }
    if (template.backdrop.mode === "video") {
      setSelectedVideo(template.backdrop.url);
    }
    setSpec((s) => ({
      ...s,
      ...template.spec,
      text: s.text,
      backgroundScene: template.backdrop.mode === "scene" ? template.backdrop.sceneId : undefined,
      backgroundPattern:
        template.backdrop.mode === "pattern" ? template.backdrop.patternId : undefined,
      size: suggestSize(currentTextPage, template.spec.size ?? s.size),
    }));
    setPreviewAnimating(true);
    setPlayKey((key) => key + 1);
  }

  function replayPreview() {
    setPreviewAnimating(true);
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
    if (!publishText) return toast.error("type something first");
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
        qc.setQueryData(socialKeys.feed("demo"), getMockFeed());
        qc.invalidateQueries({ queryKey: discoveryKeys.discoverRoot });
        qc.invalidateQueries({ queryKey: discoveryKeys.profileRoot });
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
        <section className="sticky top-[calc(env(safe-area-inset-top,0px)+4.75rem)] z-20 -mx-4 bg-background/95 px-4 pb-4 backdrop-blur">
          <div
            className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2"
            style={{ height: previewRowHeight, maxHeight: previewPaneHeight }}
          >
            <ComposerPreviewCanvas
              className="min-w-0 flex-1"
              style={{ height: "100%" }}
              maxHeight={previewPaneHeight}
              onFrameChange={(frame) => setComposerCanvasHeight(frame.height)}
            >
              <button
                type="button"
                onClick={replayPreview}
                className="relative size-full overflow-hidden rounded-[24px] bg-black shadow-[0_24px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
                aria-label="Replay preview"
              >
              {previewScene ? (
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={getSceneBackgroundStyle(previewScene, playKey)}
                />
              ) : previewPattern ? (
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    backgroundColor: previewPattern.base,
                    backgroundImage: previewPattern.image,
                    backgroundSize: previewPattern.size,
                    backgroundRepeat: "repeat",
                    backgroundPosition: getPatternBackgroundPosition(previewPattern, playKey),
                    transition: "background-position 0.95s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
              ) : previewSlidingBackground ? (
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
              {(backgroundMode === "transition" || previewPattern || previewScene) && (
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
              {activeVideo && (
                <video
                  src={activeVideo}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 size-full object-cover"
                />
              )}
              {(activePhoto || activeVideo) && (
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/55" />
              )}
              {currentTextPage.trim() ? (
                <>
                  <KineticText
                    spec={previewSpec}
                    playKey={playKey}
                    scaleToCanvas
                    staticLayout={!previewAnimating}
                    background={
                      backgroundMode === "transition"
                        ? selectedTransitionGradients
                        : previewScene
                          ? previewScene.base
                          : previewPattern
                            ? previewPattern.base
                            : safeBg
                    }
                  />
                  <CanvasStickerLayer
                    stickers={spec.stickers}
                    text={currentTextPage}
                    layout={previewSpec}
                    playKey={playKey}
                    compact
                  />
                </>
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
                {composerPages.length > 1
                  ? `page ${activeTextPage + 1}/${composerPages.length}`
                  : "tap to replay"}
              </span>
              {articlePreview && (
                <span className="absolute left-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white text-black shadow-[0_10px_28px_rgba(0,0,0,0.4)]">
                  <Link2 className="size-4" />
                </span>
              )}
              </button>
            </ComposerPreviewCanvas>
            <div className="flex w-full max-h-40 shrink-0 flex-col sm:h-full sm:max-h-none sm:min-w-[132px] sm:w-[35%]">
              <div className="mb-1.5 flex items-center justify-between px-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/55">
                <span className="flex items-center gap-1">
                  <Sparkles className="size-2.5" />
                  templates
                </span>
                <span className="text-white/35">{ANIMATION_TEMPLATES.length}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-0.5 pt-0.5 scrollbar-hide">
                {ANIMATION_TEMPLATES.map((template) => (
                  <TemplateButton
                    key={template.id}
                    template={template}
                    active={isTemplateActive(
                      template,
                      spec,
                      bg,
                      backgroundMode,
                      selectedGradientPath,
                      selectedSceneId,
                      selectedPatternId,
                      selectedPhoto,
                      selectedVideo,
                    )}
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

              <Panel icon={<Type />} title="sentence">
                <div className="space-y-2">
                  {composerPages.map((pageText, pageIndex) => (
                    <div
                      key={pageIndex}
                      onClick={() => selectTextPage(pageIndex)}
                      className={`rounded-2xl p-2 ring-1 transition ${
                        activeTextPage === pageIndex
                          ? "bg-white/[0.08] ring-primary/70"
                          : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-[0.16em]">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectTextPage(pageIndex);
                          }}
                          className={
                            activeTextPage === pageIndex
                              ? "text-white"
                              : "text-muted-foreground transition hover:text-white"
                          }
                        >
                          page {pageIndex + 1}
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openPageBackdropEditor(pageIndex);
                            }}
                            className="flex h-6 items-center gap-1 rounded-full bg-white/8 px-2 text-[9px] font-bold text-white/70 ring-1 ring-white/10 transition hover:bg-white/12 hover:text-white"
                            aria-label={`${getPageBackdropActionLabel(backgroundMode)} for page ${
                              pageIndex + 1
                            }`}
                          >
                            {getPageBackdropActionIcon(backgroundMode)}
                            {getPageBackdropActionLabel(backgroundMode)}
                          </button>
                          {composerPages.length > 1 && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeTextPage(pageIndex);
                              }}
                              className="grid size-6 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-white"
                              aria-label={`Remove page ${pageIndex + 1}`}
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        ref={(el) => {
                          textareaRefs.current[pageIndex] = el;
                        }}
                        value={pageText}
                        onFocus={() => {
                          setActiveTextPage(pageIndex);
                          setPreviewAnimating(false);
                        }}
                        onChange={(event) => updateTextPage(pageIndex, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          if (!pageText.trim()) return;
                          insertTextPageAfter(pageIndex);
                        }}
                        rows={2}
                        placeholder={
                          pageIndex === 0 ? "write one sentence or argument..." : "next page..."
                        }
                        className="block w-full resize-none overflow-y-auto rounded-xl bg-black/20 px-3 py-2.5 text-base leading-relaxed text-white outline-none placeholder:text-white/35"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => insertTextPageAfter(activeTextPage)}
                  disabled={spec.text.length >= MAX_STATUS_CHARS}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/8 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/10 transition hover:bg-white/12 disabled:opacity-40"
                >
                  <Plus className="size-3.5" />
                  add page
                </button>
                <div className="mt-2 flex items-center justify-end font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span>
                    {spec.text.length}/{MAX_STATUS_CHARS}
                  </span>
                </div>

                <AccentRecommendationCard
                  recommendation={accentRecommendation}
                  loading={accentLoading}
                  stickers={spec.stickers ?? []}
                  onAcceptEmoji={acceptEmojiAccent}
                  onReject={rejectAccent}
                  onRemove={removeAccent}
                />

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
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/25 p-1">
                  {[
                    { id: "gradient", label: "gradient", icon: <Palette className="size-3" /> },
                    { id: "transition", label: "flow", icon: <Sparkles className="size-3" /> },
                    { id: "scene", label: "scene", icon: <Newspaper className="size-3" /> },
                    { id: "pattern", label: "pattern", icon: <Sparkles className="size-3" /> },
                    { id: "photo", label: "photos", icon: <ImageIcon className="size-3" /> },
                    { id: "upload", label: "upload", icon: <Upload className="size-3" /> },
                    { id: "video", label: "video", icon: <Video className="size-3" /> },
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
                        className={`relative aspect-square rounded-2xl bg-white/5 p-[2px] transition ring-2 ${
                          bg === gradient ? "ring-white" : "ring-transparent"
                        }`}
                        aria-label="Choose gradient background"
                      >
                        <span
                          className="block size-full overflow-hidden rounded-[14px]"
                          style={{ background: gradient }}
                          aria-hidden
                        />
                      </button>
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

                {backgroundMode === "scene" && (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {CANVAS_SCENE_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          setSelectedSceneId(theme.id);
                          setBg(theme.base);
                          replayPreview();
                        }}
                        className={`relative min-h-28 overflow-hidden rounded-2xl p-3 text-left ring-2 transition ${
                          selectedSceneId === theme.id ? "ring-white" : "ring-transparent"
                        }`}
                        style={getSceneBackgroundStyle(theme, 0)}
                      >
                        <span className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/45" />
                        <span className="relative block text-sm font-black text-white">
                          {theme.label}
                        </span>
                        <span className="relative mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-white/70">
                          {theme.mood}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {backgroundMode === "pattern" && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {CANVAS_PATTERN_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatternId(theme.id);
                          setBg(theme.base);
                          replayPreview();
                        }}
                        className={`relative min-h-24 overflow-hidden rounded-2xl p-2 text-left ring-2 transition ${
                          selectedPatternId === theme.id ? "ring-white" : "ring-transparent"
                        }`}
                        style={{
                          backgroundColor: theme.base,
                          backgroundImage: theme.image,
                          backgroundSize: theme.size,
                          backgroundRepeat: "repeat",
                        }}
                      >
                        <span className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/45" />
                        <span className="relative block text-xs font-black text-white">
                          {theme.label}
                        </span>
                        <span className="relative mt-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-white/65">
                          {theme.mood}
                        </span>
                      </button>
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

                {backgroundMode === "video" && (
                  <div className="mt-3 grid gap-2">
                    {PRELOADED_VIDEOS.map((video) => (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => {
                          setSelectedVideo(video.url);
                          setBackgroundMode("video");
                        }}
                        className={`relative aspect-[9/16] max-h-64 w-full overflow-hidden rounded-2xl text-left ring-2 transition ${
                          selectedVideo === video.url ? "ring-white" : "ring-transparent"
                        }`}
                      >
                        <video
                          src={video.url}
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="absolute inset-0 size-full object-cover"
                        />
                        <span className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/60" />
                        <span className="absolute bottom-2 left-2 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                          <Video className="size-3.5" />
                          {video.label}
                        </span>
                      </button>
                    ))}
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

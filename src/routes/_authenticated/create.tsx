import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  Plus,
  Send,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Type,
  Upload,
  Video,
  X,
} from "lucide-react";
import { CanvasStickerLayer } from "@/components/CanvasStickerLayer";
import { KineticText } from "@/components/KineticText";
import {
  DEFAULT_CANVAS,
  ENTRANCES,
  FONTS,
  GRADIENTS,
  LOOPS,
  PALETTE,
  RHYTHMS,
  SAFE_CANVAS_BACKGROUND,
  serializeCanvas,
  TEMPOS,
  TRANSITION_GRADIENT_PATHS,
  isUsableCanvasBackground,
  resolveCanvasBackground,
  type CanvasLinkPreview,
  type CanvasSpec,
  type CanvasSticker,
  type GradientTransitionPath,
} from "@/lib/canvas";
import {
  CANVAS_PATTERN_THEMES,
  getCanvasPatternTheme,
  getPatternBackgroundPosition,
} from "@/lib/canvas-patterns";
import {
  CANVAS_SCENE_THEMES,
  getCanvasSceneTheme,
  getSceneBackgroundStyle,
} from "@/lib/canvas-scenes";
import {
  createEmojiSticker,
  getAccentKeyword,
  getAccentRecommendation,
  type AccentRecommendation,
} from "@/lib/accent-suggestions";
import { createPost } from "@/lib/social.functions";
import { isDemoSession } from "@/lib/demo-session";
import { addMockPost, getMockFeed } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create")({
  component: CreatePage,
});

type BackgroundMode =
  | "gradient"
  | "transition"
  | "scene"
  | "pattern"
  | "photo"
  | "upload"
  | "video";
type StudioPage = "write" | "background" | "font" | "color" | "layout" | "motion";
type TemplateBackdrop =
  | { mode: "gradient"; gradient: string }
  | { mode: "transition"; path: GradientTransitionPath }
  | { mode: "scene"; sceneId: string }
  | { mode: "pattern"; patternId: string }
  | { mode: "photo"; url: string }
  | { mode: "video"; url: string };
type AnimationTemplate = {
  id: string;
  label: string;
  mood: string;
  backdrop: TemplateBackdrop;
  spec: Partial<Omit<CanvasSpec, "text">>;
};

const STATUS_CANVAS: CanvasSpec = {
  ...DEFAULT_CANVAS,
  text: "",
  size: 96,
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

const PRELOADED_VIDEOS = [
  {
    id: "flower",
    label: "soft motion",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
];

const PLACEMENTS = [
  { label: "top", x: 50, y: 32 },
  { label: "center", x: 50, y: 50 },
  { label: "low", x: 50, y: 68 },
];

const TEMPLATE_SIDEBAR_WIDTH_PERCENT = 35;
const TEMPLATE_SIDEBAR_MIN_WIDTH_PX = 132;

const ANIMATION_TEMPLATES: AnimationTemplate[] = [
  {
    id: "paper-headline",
    label: "paper headline",
    mood: "scene · editorial",
    backdrop: { mode: "scene", sceneId: "paper-cut-sunrise" },
    spec: {
      font: "Bebas Neue",
      size: 112,
      color: "#ffffff",
      weight: 900,
      letterSpacing: -0.02,
      entrance: "slide",
      loop: "pulse",
      tempo: "steady",
      rhythm: "burst",
      x: 50,
      y: 50,
      rotation: -1,
      backgroundScene: "paper-cut-sunrise",
    },
  },
  {
    id: "rose-verse",
    label: "rose verse",
    mood: "slow · poetic",
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#F8C8DC,#7C3AED)" },
    spec: {
      font: "Playfair Display",
      size: 98,
      color: "#FFF7ED",
      weight: 700,
      letterSpacing: -0.015,
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "poetic",
      x: 50,
      y: 52,
      rotation: -1,
    },
  },
  {
    id: "ink-memo",
    label: "ink memo",
    mood: "scene · quiet print",
    backdrop: { mode: "scene", sceneId: "paper-cut-noir" },
    spec: {
      font: "Playfair Display",
      size: 96,
      color: "#FFF7ED",
      weight: 800,
      letterSpacing: -0.015,
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "poetic",
      x: 50,
      y: 54,
      rotation: 0,
      backgroundScene: "paper-cut-noir",
    },
  },
  {
    id: "pattern-current",
    label: "pattern current",
    mood: "continuous · seamless",
    backdrop: { mode: "pattern", patternId: "waves" },
    spec: {
      font: "Space Grotesk",
      size: 100,
      color: "#ffffff",
      weight: 900,
      letterSpacing: -0.035,
      entrance: "slide",
      loop: "float",
      tempo: "steady",
      rhythm: "smooth",
      x: 50,
      y: 52,
      rotation: 0,
      backgroundPattern: "waves",
    },
  },
  {
    id: "aqua-fold",
    label: "aqua fold",
    mood: "scene · cool cut",
    backdrop: { mode: "scene", sceneId: "paper-cut-aqua" },
    spec: {
      font: "Space Grotesk",
      size: 102,
      color: "#ffffff",
      weight: 900,
      letterSpacing: -0.04,
      entrance: "split",
      loop: "float",
      tempo: "steady",
      rhythm: "stagger",
      x: 50,
      y: 51,
      rotation: 1,
      backgroundScene: "paper-cut-aqua",
    },
  },
  {
    id: "neon-burst",
    label: "neon burst",
    mood: "snappy · burst",
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#FF006E,#8338EC)" },
    spec: {
      font: "Bebas Neue",
      size: 114,
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
    id: "photo-memory",
    label: "photo memory",
    mood: "image · cinematic",
    backdrop: { mode: "photo", url: PRELOADED_PHOTOS[4].url },
    spec: {
      font: "Playfair Display",
      size: 98,
      color: "#FFF7ED",
      weight: 800,
      letterSpacing: -0.015,
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "poetic",
      x: 50,
      y: 56,
      rotation: -1,
    },
  },
  {
    id: "editorial-drift",
    label: "editorial drift",
    mood: "slow · smooth",
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#00B4D8,#FF006E)" },
    spec: {
      font: "Playfair Display",
      size: 100,
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
    id: "video-bloom",
    label: "video bloom",
    mood: "video · living backdrop",
    backdrop: { mode: "video", url: PRELOADED_VIDEOS[0].url },
    spec: {
      font: "Inter",
      size: 96,
      color: "#ffffff",
      weight: 900,
      letterSpacing: -0.035,
      entrance: "fade",
      loop: "pulse",
      tempo: "steady",
      rhythm: "stagger",
      x: 50,
      y: 50,
      rotation: 0,
    },
  },
  {
    id: "mono-sprint",
    label: "mono sprint",
    mood: "snappy · stagger",
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#00B4D8,#FF006E)" },
    spec: {
      font: "JetBrains Mono",
      size: 88,
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
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#3A86FF,#06FFA5)" },
    spec: {
      font: "Inter",
      size: 98,
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
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#FB5607,#FFBE0B)" },
    spec: {
      font: "Space Grotesk",
      size: 108,
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
  gradients: [GRADIENTS[0], GRADIENTS[1], SAFE_CANVAS_BACKGROUND],
};

const MAX_STATUS_CHARS = 220;

function getComposerPages(text: string) {
  const pages = text.replace(/\r\n?/g, "\n").split("\n");
  return pages.length > 0 ? pages : [""];
}

function limitComposerPages(pages: string[]) {
  const limited: string[] = [];
  let used = 0;

  pages.forEach((page, index) => {
    const separatorSize = index === 0 ? 0 : 1;
    const remaining = MAX_STATUS_CHARS - used - separatorSize;
    if (remaining <= 0) return;

    const clipped = page.slice(0, remaining);
    if (index > 0) used += 1;
    used += clipped.length;
    limited.push(clipped);
  });

  return limited.length > 0 ? limited : [""];
}

function joinComposerPages(pages: string[]) {
  return limitComposerPages(pages).join("\n");
}

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
  const templateSidebarWidth = `max(${TEMPLATE_SIDEBAR_MIN_WIDTH_PX}px, min(${TEMPLATE_SIDEBAR_WIDTH_PERCENT}vw, ${TEMPLATE_SIDEBAR_WIDTH_PERCENT}%))`;
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
        <section className="sticky top-[72px] z-20 -mx-4 bg-background/95 px-3 pb-4 backdrop-blur">
          <div
            className="flex min-w-0 items-stretch gap-2"
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
            <div
              className="flex shrink-0 flex-col"
              style={{
                width: templateSidebarWidth,
                height: "100%",
              }}
            >
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

function AccentRecommendationCard({
  recommendation,
  loading,
  stickers,
  onAcceptEmoji,
  onReject,
  onRemove,
}: {
  recommendation: AccentRecommendation | null;
  loading: boolean;
  stickers: CanvasSticker[];
  onAcceptEmoji: () => void;
  onReject: () => void;
  onRemove: (id: string) => void;
}) {
  if (!recommendation && !loading && stickers.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-black/20 p-2 ring-1 ring-white/10">
      <div className="flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <Smile className="size-3.5" />
        smart accents
      </div>

      {loading && !recommendation && (
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/70">
          <Sparkles className="size-3.5 animate-pulse" />
          finding a visual match...
        </div>
      )}

      {recommendation && (
        <div className="rounded-xl bg-white/[0.07] p-2 ring-1 ring-white/10">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                match "{recommendation.keyword}"
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                local emoji suggestion
              </p>
            </div>
            <button
              type="button"
              onClick={onReject}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
              aria-label="Reject accent recommendation"
            >
              <X className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onAcceptEmoji}
            className="flex min-h-20 w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-left text-black transition active:scale-[0.98]"
          >
            <span className="text-4xl leading-none">{recommendation.emoji}</span>
            <span className="min-w-0">
              <span className="block text-xs font-black uppercase">add emoji accent</span>
              <span className="block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-black/55">
                appears beside the matched word
              </span>
            </span>
          </button>
        </div>
      )}

      {stickers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              onClick={() => onRemove(sticker.id)}
              className="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-2 pr-1 text-[11px] font-bold text-white ring-1 ring-white/10 transition hover:bg-white/15"
              aria-label={`Remove ${sticker.word} accent`}
            >
              <span>{sticker.kind === "emoji" ? sticker.emoji : "GIF"}</span>
              <span className="max-w-20 truncate">{sticker.word}</span>
              <span className="grid size-5 place-items-center rounded-full bg-black/25">
                <X className="size-3" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
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
      className={`group relative grid w-full grid-cols-[30px_minmax(0,1fr)] items-center gap-1.5 rounded-lg border-2 p-1 text-left transition ${
        active
          ? "border-white bg-white/[0.10] shadow-[0_4px_14px_-8px_rgba(255,255,255,0.5)]"
          : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07]"
      }`}
    >
      <span className="relative block w-full">
        <TemplateBackdropThumbnail template={template} />
        {active && (
          <span className="absolute right-0 top-0 grid size-3 place-items-center rounded-full bg-white text-black shadow-[0_3px_10px_rgba(0,0,0,0.35)] ring-1 ring-black/40">
            <Check className="size-1.5" strokeWidth={4} />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 block text-[9px] font-black leading-[1.05] text-white">
          {template.label}
        </span>
        <span className="mt-0.5 block line-clamp-2 font-mono text-[6.5px] uppercase leading-tight tracking-[0.12em] text-white/55">
          {template.mood}
        </span>
      </span>
    </button>
  );
}

function TemplateBackdropThumbnail({ template }: { template: AnimationTemplate }) {
  const scene =
    template.backdrop.mode === "scene" ? getCanvasSceneTheme(template.backdrop.sceneId) : null;
  const pattern =
    template.backdrop.mode === "pattern"
      ? getCanvasPatternTheme(template.backdrop.patternId)
      : null;

  return (
    <span
      className="relative block aspect-square w-full overflow-hidden rounded-lg"
      style={getTemplateThumbnailStyle(template, scene, pattern)}
    >
      {template.backdrop.mode === "photo" && (
        <img
          src={template.backdrop.url}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {template.backdrop.mode === "video" && (
        <video
          src={template.backdrop.url}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_25%_0%,rgba(255,255,255,0.28),transparent_60%)]" />
      {(template.backdrop.mode === "photo" || template.backdrop.mode === "video") && (
        <span className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/50" />
      )}
      {template.backdrop.mode === "video" && (
        <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-black/45 text-white">
          <Video className="size-2.5" />
        </span>
      )}
      <span
        className="absolute left-1/2 top-1/2 leading-none"
        style={{
          color: template.spec.color,
          fontFamily: template.spec.font,
          fontWeight: template.spec.weight ?? 900,
          letterSpacing: `${template.spec.letterSpacing ?? -0.02}em`,
          fontSize: 11,
          transform: `translate(-50%, -50%) rotate(${template.spec.rotation ?? 0}deg)`,
          textShadow: "0 1px 6px rgba(0,0,0,0.32)",
        }}
      >
        Aa
      </span>
    </span>
  );
}

function getTemplateThumbnailStyle(
  template: AnimationTemplate,
  scene: ReturnType<typeof getCanvasSceneTheme>,
  pattern: ReturnType<typeof getCanvasPatternTheme>,
): CSSProperties {
  if (template.backdrop.mode === "scene" && scene) {
    return getSceneBackgroundStyle(scene, 0);
  }

  if (template.backdrop.mode === "pattern" && pattern) {
    return {
      backgroundColor: pattern.base,
      backgroundImage: pattern.image,
      backgroundSize: pattern.size,
      backgroundRepeat: "repeat",
    };
  }

  if (template.backdrop.mode === "gradient") {
    return { background: template.backdrop.gradient };
  }

  if (template.backdrop.mode === "transition") {
    return {
      background: template.backdrop.path.gradients[0] ?? SAFE_CANVAS_BACKGROUND,
    };
  }

  return { background: SAFE_CANVAS_BACKGROUND };
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

function getPageBackdropActionLabel(backgroundMode: BackgroundMode) {
  if (backgroundMode === "video") return "change video";
  if (backgroundMode === "photo" || backgroundMode === "upload") return "change image";
  return "background";
}

function getPageBackdropActionIcon(backgroundMode: BackgroundMode) {
  if (backgroundMode === "video") return <Video className="size-3" />;
  if (backgroundMode === "photo" || backgroundMode === "upload") {
    return <ImageIcon className="size-3" />;
  }
  return <Palette className="size-3" />;
}

function isTemplateActive(
  template: AnimationTemplate,
  spec: CanvasSpec,
  bg: string,
  backgroundMode: BackgroundMode,
  selectedGradientPath: GradientTransitionPath,
  selectedSceneId: string,
  selectedPatternId: string,
  selectedPhoto: string,
  selectedVideo: string,
) {
  const motionMatches =
    spec.font === template.spec.font &&
    spec.entrance === template.spec.entrance &&
    spec.loop === template.spec.loop &&
    spec.tempo === template.spec.tempo &&
    spec.rhythm === template.spec.rhythm;
  if (!motionMatches) return false;

  if (template.backdrop.mode === "gradient") {
    return backgroundMode === "gradient" && bg === template.backdrop.gradient;
  }
  if (template.backdrop.mode === "transition") {
    return backgroundMode === "transition" && selectedGradientPath.id === template.backdrop.path.id;
  }
  if (template.backdrop.mode === "scene") {
    return backgroundMode === "scene" && selectedSceneId === template.backdrop.sceneId;
  }
  if (template.backdrop.mode === "pattern") {
    return backgroundMode === "pattern" && selectedPatternId === template.backdrop.patternId;
  }
  if (template.backdrop.mode === "photo") {
    return backgroundMode === "photo" && selectedPhoto === template.backdrop.url;
  }
  return backgroundMode === "video" && selectedVideo === template.backdrop.url;
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
  if (clean.length > 150) return Math.min(current, 72);
  if (clean.length > 90) return Math.min(current, 84);
  if (clean.length > 48) return Math.min(current, 96);
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

const CANVAS_ASPECT_RATIO = 9 / 16;

function ComposerPreviewCanvas({
  className,
  style,
  children,
  maxHeight,
  onFrameChange,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  maxHeight?: string;
  onFrameChange?: (frame: { width: number; height: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      const fitted = fitCanvasFrame(width, height, CANVAS_ASPECT_RATIO);
      setFrame((current) =>
        current?.width === fitted.width && current?.height === fitted.height ? current : fitted,
      );
      onFrameChangeRef.current?.(fitted);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 items-stretch justify-start ${className ?? ""}`}
      style={{ ...style, maxHeight }}
    >
      <div
        className="relative shrink-0"
        style={
          frame
            ? { width: frame.width, height: frame.height }
            : { aspectRatio: "9 / 16", height: "100%", width: "auto", maxWidth: "100%" }
        }
      >
        {children}
      </div>
    </div>
  );
}

function fitCanvasFrame(containerWidth: number, containerHeight: number, ratio: number) {
  const heightAtFullWidth = containerWidth / ratio;
  if (heightAtFullWidth <= containerHeight) {
    return { width: containerWidth, height: heightAtFullWidth };
  }
  return { width: containerHeight * ratio, height: containerHeight };
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
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (index === 0 && first) items.push(first);
    if (last) items.push(last);
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

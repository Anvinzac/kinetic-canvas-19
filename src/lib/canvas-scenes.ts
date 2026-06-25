export type CanvasSceneTheme = {
  id: string;
  label: string;
  mood: string;
  base: string;
  image: string;
  size?: string;
  step: { x: number; y: number };
};

function svgLayer(markup: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}

const sunriseSceneSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 1600' preserveAspectRatio='none'>" +
  "<rect width='900' height='1600' fill='#111318'/>" +
  "<polygon points='0,0 900,0 900,445 0,620' fill='#171B24'/>" +
  "<polygon points='0,615 900,430 900,785 0,970' fill='#243B55'/>" +
  "<polygon points='0,885 900,685 900,1600 0,1600' fill='#10131B'/>" +
  "<polygon points='0,255 640,120 760,238 0,430' fill='#F7C948'/>" +
  "<polygon points='900,360 900,855 356,1600 158,1600' fill='#FF4D8D' opacity='.96'/>" +
  "<polygon points='0,1265 900,980 900,1600 0,1600' fill='#0E1726' opacity='.82'/>" +
  "<path d='M0 614 L900 430 M0 885 L900 685 M0 255 L640 120 M900 360 L356 1600' stroke='rgba(255,255,255,.20)' stroke-width='6'/>" +
  "</svg>";

const noirSceneSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 1600' preserveAspectRatio='none'>" +
  "<rect width='900' height='1600' fill='#0D0E12'/>" +
  "<polygon points='0,0 900,0 900,415 0,585' fill='#181A20'/>" +
  "<polygon points='0,520 900,330 900,640 0,830' fill='#ECE7DC' opacity='.88'/>" +
  "<polygon points='0,860 900,650 900,1600 0,1600' fill='#23242B'/>" +
  "<polygon points='0,1075 900,885 900,1600 0,1600' fill='#101116'/>" +
  "<polygon points='0,140 430,0 620,0 0,385' fill='#F7F2E8' opacity='.72'/>" +
  "<polygon points='900,0 900,390 548,1600 330,1600' fill='#B4BED2' opacity='.18'/>" +
  "<path d='M0 520 L900 330 M0 860 L900 650 M0 1075 L900 885 M548 1600 L900 390' stroke='rgba(255,255,255,.18)' stroke-width='5'/>" +
  "</svg>";

const aquaSceneSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 1600' preserveAspectRatio='none'>" +
  "<rect width='900' height='1600' fill='#071B22'/>" +
  "<polygon points='0,0 900,0 900,505 0,650' fill='#08212A'/>" +
  "<polygon points='0,630 900,475 900,910 0,1085' fill='#123849'/>" +
  "<polygon points='0,960 900,815 900,1600 0,1600' fill='#06171D'/>" +
  "<polygon points='0,1015 900,755 900,1215 0,1465' fill='#38BDF8' opacity='.72'/>" +
  "<polygon points='0,485 750,315 900,470 0,760' fill='#86EFAC' opacity='.62'/>" +
  "<polygon points='900,560 900,1600 430,1600 620,985' fill='#2DD4BF' opacity='.50'/>" +
  "<path d='M0 630 L900 475 M0 960 L900 815 M0 1015 L900 755 M0 485 L750 315 M620 985 L430 1600' stroke='rgba(255,255,255,.16)' stroke-width='6'/>" +
  "</svg>";

export const CANVAS_SCENE_THEMES: readonly CanvasSceneTheme[] = [
  {
    id: "paper-cut-sunrise",
    label: "paper cut",
    mood: "editorial sheets · warm slash",
    base: "#111318",
    image: [
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 7px)",
      svgLayer(sunriseSceneSvg),
    ].join(", "),
    size: "18px 18px, 100% 100%",
    step: { x: -28, y: -16 },
  },
  {
    id: "paper-cut-noir",
    label: "ink cut",
    mood: "monochrome paper · gallery wall",
    base: "#0D0E12",
    image: [
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 8px)",
      svgLayer(noirSceneSvg),
    ].join(", "),
    size: "18px 18px, 100% 100%",
    step: { x: 22, y: -20 },
  },
  {
    id: "paper-cut-aqua",
    label: "aqua cut",
    mood: "cool sheets · cyan fold",
    base: "#071B22",
    image: [
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 9px)",
      svgLayer(aquaSceneSvg),
    ].join(", "),
    size: "18px 18px, 100% 100%",
    step: { x: -18, y: 24 },
  },
];

const THEMES_BY_ID = new Map(CANVAS_SCENE_THEMES.map((theme) => [theme.id, theme]));

export function getCanvasSceneTheme(id: string | null | undefined) {
  if (!id) return null;
  return THEMES_BY_ID.get(id) ?? null;
}

export function getSceneBackgroundStyle(theme: CanvasSceneTheme, shiftPage: number) {
  const x = theme.step.x * shiftPage;
  const y = theme.step.y * shiftPage;
  return {
    backgroundColor: theme.base,
    backgroundImage: theme.image,
    backgroundSize: theme.size,
    // Keep the full-canvas SVG sheet locked to the 9:16 frame. Only the subtle
    // paper grain layer drifts, so the cut edges stay intentionally aligned with
    // the screen edges instead of floating loose in the middle.
    backgroundPosition: `${x}px ${y}px, 0 0`,
    transition: "background-position 1.05s cubic-bezier(0.22,1,0.36,1)",
  };
}

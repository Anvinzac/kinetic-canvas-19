/**
 * Module providing CanvasSceneTheme, CANVAS_SCENE_THEMES, getCanvasSceneTheme, getSceneBackgroundStyle.
 *
 * Exports: CanvasSceneTheme, CANVAS_SCENE_THEMES, getCanvasSceneTheme, getSceneBackgroundStyle
 * Depends on: none (leaf module)
 */
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

// Alpenglow — a national-park-poster dusk: a graded sky from deep violet down
// through a coral horizon, a soft sun disc, scattered stars, and three receding
// mountain ridges (lighter = farther) silhouetted against the glow.
const alpenglowSceneSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 1600' preserveAspectRatio='none'>" +
  "<defs>" +
  "<linearGradient id='asky' x1='0' y1='0' x2='0' y2='1'>" +
  "<stop offset='0' stop-color='#241640'/><stop offset='0.30' stop-color='#5b2a63'/>" +
  "<stop offset='0.44' stop-color='#b34a6a'/><stop offset='0.53' stop-color='#f08a4e'/>" +
  "<stop offset='0.60' stop-color='#c98f56'/><stop offset='0.70' stop-color='#3c2447'/>" +
  "<stop offset='1' stop-color='#130d20'/></linearGradient>" +
  "<radialGradient id='asun' cx='50%' cy='50%' r='50%'>" +
  "<stop offset='0' stop-color='#fff0c4'/><stop offset='0.4' stop-color='#ffd277'/>" +
  "<stop offset='0.7' stop-color='#ff9d54' stop-opacity='0.45'/>" +
  "<stop offset='1' stop-color='#ff9d54' stop-opacity='0'/></radialGradient>" +
  "</defs>" +
  "<rect width='900' height='1600' fill='url(#asky)'/>" +
  "<g fill='#ffffff'>" +
  "<circle cx='120' cy='150' r='2' opacity='0.8'/><circle cx='300' cy='90' r='1.6' opacity='0.7'/>" +
  "<circle cx='700' cy='130' r='2.4' opacity='0.85'/><circle cx='820' cy='250' r='1.8' opacity='0.7'/>" +
  "<circle cx='560' cy='210' r='1.5' opacity='0.6'/><circle cx='220' cy='280' r='1.4' opacity='0.6'/></g>" +
  "<circle cx='450' cy='560' r='300' fill='url(#asun)'/>" +
  "<circle cx='450' cy='560' r='118' fill='#ffd97a'/>" +
  "<polygon points='0,840 150,760 320,820 450,700 600,800 760,730 900,810 900,1600 0,1600' fill='#7a3f6e' opacity='0.92'/>" +
  "<polygon points='0,1000 200,900 410,980 640,880 900,960 900,1600 0,1600' fill='#4a2856'/>" +
  "<polygon points='0,1240 250,1090 520,1210 770,1070 900,1150 900,1600 0,1600' fill='#160f22'/>" +
  "<rect x='0' y='980' width='900' height='90' fill='#f08a4e' opacity='0.10'/>" +
  "</svg>";

// Deco metropolis — a Gatsby-era night: a fan of gilded sunburst rays behind a
// ringed moon, over a stepped Art-Deco skyline silhouette with thin gold edges.
const decoSceneSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 1600' preserveAspectRatio='none'>" +
  "<defs>" +
  "<linearGradient id='dsky' x1='0' y1='0' x2='0' y2='1'>" +
  "<stop offset='0' stop-color='#0a2230'/><stop offset='0.45' stop-color='#103a47'/>" +
  "<stop offset='0.75' stop-color='#0a2230'/><stop offset='1' stop-color='#06141c'/></linearGradient>" +
  "<linearGradient id='dgold' x1='0' y1='0' x2='0' y2='1'>" +
  "<stop offset='0' stop-color='#f6d27a'/><stop offset='1' stop-color='#bb8a32'/></linearGradient>" +
  "<polygon id='dray' points='444,560 412,-160 476,-160'/>" +
  "</defs>" +
  "<rect width='900' height='1600' fill='url(#dsky)'/>" +
  "<g fill='url(#dgold)' opacity='0.22'>" +
  "<use href='#dray' transform='rotate(-80 450 560)'/><use href='#dray' transform='rotate(-64 450 560)'/>" +
  "<use href='#dray' transform='rotate(-48 450 560)'/><use href='#dray' transform='rotate(-32 450 560)'/>" +
  "<use href='#dray' transform='rotate(-16 450 560)'/><use href='#dray' transform='rotate(0 450 560)'/>" +
  "<use href='#dray' transform='rotate(16 450 560)'/><use href='#dray' transform='rotate(32 450 560)'/>" +
  "<use href='#dray' transform='rotate(48 450 560)'/><use href='#dray' transform='rotate(64 450 560)'/>" +
  "<use href='#dray' transform='rotate(80 450 560)'/></g>" +
  "<circle cx='450' cy='560' r='150' fill='#0c2c38'/>" +
  "<circle cx='450' cy='560' r='150' fill='none' stroke='url(#dgold)' stroke-width='3' opacity='0.55'/>" +
  "<circle cx='450' cy='560' r='120' fill='none' stroke='url(#dgold)' stroke-width='1' opacity='0.3'/>" +
  "<polygon fill='#04101a' points='0,1180 0,1600 900,1600 900,1180 840,1180 840,1120 800,1120 800,1180 720,1180 720,1040 690,1000 660,1040 660,1180 560,1180 560,1080 520,1080 520,1180 470,1180 470,980 450,940 430,980 430,1180 380,1180 380,1080 340,1080 340,1180 240,1180 240,1040 210,1000 180,1040 180,1180 100,1180 100,1120 60,1120 60,1180'/>" +
  "<g stroke='url(#dgold)' stroke-width='1.5' opacity='0.5'>" +
  "<line x1='450' y1='940' x2='450' y2='1180'/><line x1='690' y1='1000' x2='690' y2='1180'/>" +
  "<line x1='210' y1='1000' x2='210' y2='1180'/></g>" +
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
  {
    id: "alpenglow",
    label: "alpenglow",
    mood: "fine art · mountain dusk poster",
    base: "#130d20",
    image: [
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 8px)",
      svgLayer(alpenglowSceneSvg),
    ].join(", "),
    size: "20px 20px, 100% 100%",
    step: { x: -24, y: -16 },
  },
  {
    id: "deco",
    label: "deco metropolis",
    mood: "fine art · art-deco skyline",
    base: "#06141c",
    image: [
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 9px)",
      svgLayer(decoSceneSvg),
    ].join(", "),
    size: "20px 20px, 100% 100%",
    step: { x: 20, y: -18 },
  },
];

const THEMES_BY_ID = new Map(CANVAS_SCENE_THEMES.map((theme) => [theme.id, theme]));

/**
 * Look up a scene theme by id from the catalog.
 * @param id - id argument
 * @returns Matching CanvasSceneTheme, or null when missing
 */
export function getCanvasSceneTheme(id: string | null | undefined): CanvasSceneTheme | null {
  if (!id) return null;
  return THEMES_BY_ID.get(id) ?? null;
}

/**
 * Build inline CSS background style for a scene at a page index.
 * @param theme - theme argument
 * @param shiftPage - shiftPage argument
 * @returns Style object with color, image, size, position, and transition
 */
export function getSceneBackgroundStyle(theme: CanvasSceneTheme, shiftPage: number): React.CSSProperties | Record<string, string> {
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

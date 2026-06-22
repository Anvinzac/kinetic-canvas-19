// Seamless *pannable* canvas backgrounds that are NOT colorful gradients.
//
// They share the gradient transition's signature move — the backdrop glides a
// little further every time the post turns a page — but instead of a wide
// scrolling color strip, each theme is a tiling pattern (dots, grids, stripes,
// waves, hexagons…) drifted by translating its `background-position` a fixed
// step per page. Because the pattern repeats infinitely, ANY offset is
// perfectly seamless: there is no strip to run out of and no visible seam, no
// matter how many pages the reader taps through.
//
// Rule of thumb when adding a theme: keep `base` dark enough that white text and
// a bright emphasis color stay readable on top, and make each `step` axis a
// NON-multiple of the corresponding tile size — landing on a whole tile would
// leave the pattern looking identical after the slide (i.e. no visible motion).

export type CanvasPatternTheme = {
  id: string;
  label: string;
  mood: string;
  // Solid fill painted under the pattern; also fed to the text-contrast picker
  // so captions stay legible (see PostCard's `getCanvasTextColor`).
  base: string;
  // One or more comma-separated CSS background-image layers (tiling).
  image: string;
  // Matching background-size; omit for self-tiling repeating-gradient layers.
  size?: string;
  // Pixels the pattern travels per page turn (x, y). Negative drifts up/left.
  step: { x: number; y: number };
  // Optional per-layer base offsets, for multi-layer patterns whose layers must
  // stay in a fixed relationship (e.g. the isometric cube). The pan delta is
  // ADDED to each, so they drift together while keeping their alignment. Length
  // must match the number of `image` layers. Omit for single-offset themes.
  positions?: { x: number; y: number }[];
};

// Wrap raw SVG markup as a tiling background-image. Authoring the geometric
// themes as SVG keeps them a single layer, so the simple single-offset pan
// (below) drives them seamlessly with no per-layer bookkeeping.
function svgLayer(markup: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}

const wavesSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' width='84' height='28' viewBox='0 0 84 28'>" +
  "<path d='M0 14 q 21 -10 42 0 t 42 0' fill='none' stroke='rgba(160,235,255,0.20)' stroke-width='2'/>" +
  "</svg>";

// Hero Patterns honeycomb tile — its filled slivers cross the tile edges so a
// single 28×49 cell repeats into a continuous comb.
const hexSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'>" +
  "<path d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l11 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z' fill='rgba(255,255,255,0.11)'/>" +
  "</svg>";

const chevronSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' width='44' height='22' viewBox='0 0 44 22'>" +
  "<path d='M0 15 L22 4 L44 15' fill='none' stroke='rgba(255,255,255,0.14)' stroke-width='3'/>" +
  "</svg>";

const circuitSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 90 90'>" +
  "<g fill='none' stroke='rgba(130,225,255,0.16)' stroke-width='1.5'>" +
  "<path d='M0 18 H30 V0 M30 18 V44 H62 V90 M62 44 H90 M45 90 V64 H90 M18 90 V72 H0 M45 64 H20 V40 H0 M62 18 V0'/>" +
  "</g>" +
  "<g fill='rgba(130,225,255,0.55)'>" +
  "<circle cx='30' cy='18' r='2.6'/><circle cx='62' cy='44' r='2.6'/>" +
  "<circle cx='45' cy='64' r='2.6'/><circle cx='20' cy='40' r='2.6'/>" +
  "</g></svg>";

export const CANVAS_PATTERN_THEMES: readonly CanvasPatternTheme[] = [
  {
    id: "starfield",
    label: "starfield",
    mood: "cosmic · deep space drift",
    base: "#070b18",
    image: [
      "radial-gradient(150px 150px at 250px 250px, rgba(78,120,220,0.12), transparent 70%)",
      "radial-gradient(110px 110px at 70px 60px, rgba(150,90,210,0.10), transparent 72%)",
      "radial-gradient(2.2px 2.2px at 24px 38px, #ffffff, transparent 60%)",
      "radial-gradient(1.3px 1.3px at 140px 96px, rgba(255,255,255,0.8), transparent 60%)",
      "radial-gradient(2.4px 2.4px at 230px 172px, #d4e6ff, transparent 60%)",
      "radial-gradient(1.3px 1.3px at 96px 232px, rgba(255,255,255,0.75), transparent 60%)",
      "radial-gradient(2.1px 2.1px at 300px 70px, #ffffff, transparent 60%)",
      "radial-gradient(1.1px 1.1px at 52px 150px, rgba(255,255,255,0.6), transparent 60%)",
      "radial-gradient(1.5px 1.5px at 200px 300px, rgba(206,224,255,0.85), transparent 60%)",
      "radial-gradient(1.1px 1.1px at 330px 200px, rgba(255,255,255,0.55), transparent 60%)",
    ].join(", "),
    size: "340px 340px",
    step: { x: -70, y: -18 },
  },
  {
    id: "blueprint",
    label: "blueprint",
    mood: "technical · drafting grid",
    base: "#0a2a55",
    image: [
      "linear-gradient(rgba(173,216,255,0.12) 1px, transparent 1px)",
      "linear-gradient(90deg, rgba(173,216,255,0.12) 1px, transparent 1px)",
      "linear-gradient(rgba(173,216,255,0.34) 1.5px, transparent 1.5px)",
      "linear-gradient(90deg, rgba(173,216,255,0.34) 1.5px, transparent 1.5px)",
      "radial-gradient(2.4px 2.4px at 0 0, rgba(180,224,255,0.55), transparent 60%)",
    ].join(", "),
    size: "32px 32px, 32px 32px, 160px 160px, 160px 160px, 160px 160px",
    step: { x: -44, y: -44 },
  },
  {
    id: "halftone",
    label: "halftone",
    mood: "retro print · duotone dots",
    base: "#171622",
    image: [
      "radial-gradient(circle at center, rgba(255,255,255,0.20) 17%, transparent 18%)",
      "radial-gradient(circle at center, rgba(255,206,140,0.13) 15%, transparent 16%)",
    ].join(", "),
    size: "26px 26px",
    step: { x: -44, y: -22 },
    positions: [
      { x: 0, y: 0 },
      { x: 13, y: 13 },
    ],
  },
  {
    id: "hazard",
    label: "hazard stripes",
    mood: "bold · diagonal motion lines",
    base: "#0f1117",
    image: [
      "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 20px, transparent 20px 40px)",
      "repeating-linear-gradient(135deg, rgba(255,255,255,0.16) 0 3px, transparent 3px 40px)",
      "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 20px)",
    ].join(", "),
    step: { x: -104, y: 0 },
  },
  {
    id: "argyle",
    label: "argyle",
    mood: "geometric · woven diamonds",
    base: "#1c1230",
    image: [
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.11) 0 2px, transparent 2px 46px)",
      "repeating-linear-gradient(-45deg, rgba(255,255,255,0.11) 0 2px, transparent 2px 46px)",
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 23px, transparent 23px 46px)",
      "repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0 23px, transparent 23px 46px)",
    ].join(", "),
    step: { x: -64, y: 0 },
  },
  {
    id: "terrazzo",
    label: "terrazzo",
    mood: "material · speckled stone",
    base: "#26211c",
    image: [
      "radial-gradient(5px 5px at 26px 34px, rgba(255,255,255,0.45), transparent 62%)",
      "radial-gradient(6px 6px at 96px 78px, rgba(255,196,128,0.42), transparent 62%)",
      "radial-gradient(4px 4px at 60px 132px, rgba(128,206,255,0.40), transparent 62%)",
      "radial-gradient(5.5px 5.5px at 138px 44px, rgba(255,255,255,0.38), transparent 62%)",
      "radial-gradient(4px 4px at 34px 104px, rgba(176,255,196,0.40), transparent 62%)",
      "radial-gradient(6px 6px at 120px 138px, rgba(255,150,184,0.40), transparent 62%)",
      "radial-gradient(3px 3px at 150px 96px, rgba(255,255,255,0.30), transparent 62%)",
      "radial-gradient(3.5px 3.5px at 80px 16px, rgba(200,180,255,0.36), transparent 62%)",
      "radial-gradient(4.5px 4.5px at 14px 150px, rgba(255,224,150,0.34), transparent 62%)",
    ].join(", "),
    size: "168px 168px",
    step: { x: -34, y: -74 },
  },
  {
    id: "waves",
    label: "waves",
    mood: "organic · rolling tide",
    base: "#0a2630",
    image: [
      svgLayer(wavesSvg),
      "radial-gradient(180px 120px at 60% 40%, rgba(120,220,235,0.07), transparent 70%)",
    ].join(", "),
    size: "84px 28px, 100% 100%",
    step: { x: -50, y: 0 },
    positions: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
  },
  {
    id: "hexagons",
    label: "honeycomb",
    mood: "geometric · hex mesh",
    base: "#14161e",
    image: svgLayer(hexSvg),
    size: "56px 98px",
    step: { x: -30, y: -16 },
  },
  {
    id: "isometric",
    label: "isometric",
    mood: "dimensional · stacked cubes",
    base: "#1a1626",
    image: [
      "linear-gradient(30deg, #2a2540 12%, transparent 12.5%, transparent 87%, #2a2540 87.5%, #2a2540)",
      "linear-gradient(150deg, #2a2540 12%, transparent 12.5%, transparent 87%, #2a2540 87.5%, #2a2540)",
      "linear-gradient(30deg, #2a2540 12%, transparent 12.5%, transparent 87%, #2a2540 87.5%, #2a2540)",
      "linear-gradient(150deg, #2a2540 12%, transparent 12.5%, transparent 87%, #2a2540 87.5%, #2a2540)",
      "linear-gradient(60deg, #38325a 25%, transparent 25.5%, transparent 75%, #38325a 75%, #38325a)",
      "linear-gradient(60deg, #38325a 25%, transparent 25.5%, transparent 75%, #38325a 75%, #38325a)",
    ].join(", "),
    size: "80px 140px",
    step: { x: -54, y: 0 },
    positions: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 40, y: 70 },
      { x: 40, y: 70 },
      { x: 0, y: 0 },
      { x: 40, y: 70 },
    ],
  },
  {
    id: "chevron",
    label: "chevron",
    mood: "dynamic · marching zigzag",
    base: "#1a1222",
    image: svgLayer(chevronSvg),
    size: "44px 22px",
    step: { x: 0, y: -38 },
  },
  {
    id: "circuit",
    label: "circuit",
    mood: "cyber · traces and nodes",
    base: "#07121b",
    image: svgLayer(circuitSvg),
    size: "90px 90px",
    step: { x: -40, y: 0 },
  },
];

const THEMES_BY_ID = new Map(CANVAS_PATTERN_THEMES.map((theme) => [theme.id, theme]));

export function getCanvasPatternTheme(id: string | null | undefined) {
  if (!id) return null;
  return THEMES_BY_ID.get(id) ?? null;
}

// How far the pattern travels per page turn, as a multiple of each theme's base
// `step`. Bumped so the drift reads clearly as movement rather than a subtle
// nudge. Patterns tile infinitely, so a longer throw stays perfectly seamless.
const PATTERN_PAN_DISTANCE = 3;

// The `background-position` for a given page: the pan delta (step × page), added
// onto each layer's base offset when the theme pins per-layer positions.
export function getPatternBackgroundPosition(theme: CanvasPatternTheme, shiftPage: number) {
  const dx = shiftPage * theme.step.x * PATTERN_PAN_DISTANCE;
  const dy = shiftPage * theme.step.y * PATTERN_PAN_DISTANCE;
  if (!theme.positions) return `${dx}px ${dy}px`;
  return theme.positions.map((p) => `${p.x + dx}px ${p.y + dy}px`).join(", ");
}

/**
 * Perceptual (OKLCH) blending between two backdrop colors.
 *
 * A CSS gradient between two near-opposite hues interpolates in sRGB, which runs
 * straight through the neutral axis: the middle of the card — exactly where the
 * text sits — turns grey. Blending in OKLCH walks around the hue wheel instead, so
 * the midpoint keeps the chroma of the two ends.
 *
 * The blend is emitted as plain hex stops rather than `linear-gradient(in oklch, …)`
 * so it paints identically in every browser and every consumer that reads stops
 * back out of a backdrop with a hex regex keeps working unchanged.
 *
 * Exports: blendOklch, vividGradient, hexToOklch, oklchToHex
 * Depends on: none (leaf module)
 */

export type Oklch = { l: number; c: number; h: number };

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** Chroma below this has no meaningful hue, so the other end's hue is borrowed. */
const ACHROMATIC_CHROMA = 0.02;
/** Intermediate stops per blend; enough that the eye cannot find the facets. */
const DEFAULT_BLEND_STEPS = 5;
/** Below this OKLCH lightness an orange/yellow midpoint reads as brown. */
const DEEP_LIGHTNESS = 0.62;
/** Hue spans at least this wide have a real choice of direction around the wheel. */
const WIDE_HUE_SPAN = 120;
/** OKLCH hue band (orange through olive) that turns to mud at low lightness. */
const MUDDY_HUE_MIN = 35;
const MUDDY_HUE_MAX = 125;

function toLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function fromLinear(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function parseHex(hex: string): [number, number, number] | null {
  const trimmed = hex.trim();
  if (!HEX_COLOR.test(trimmed)) return null;
  const body = trimmed.slice(1);
  const full = body.length === 3 ? body.replace(/(.)/g, "$1$1") : body;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function linearLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Convert a #rgb / #rrggbb color to OKLCH. @returns null for anything that is not hex. @pure true */
export function hexToOklch(hex: string): Oklch | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    l: okL,
    c: Math.hypot(okA, okB),
    h: ((Math.atan2(okB, okA) * 180) / Math.PI + 360) % 360,
  };
}

function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const lRoot = l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = l - 0.0894841775 * a - 1.291485548 * b;
  const lCube = lRoot ** 3;
  const mCube = mRoot ** 3;
  const sCube = sRoot ** 3;
  return [
    4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube,
    -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube,
    -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube,
  ];
}

function inGamut(rgb: readonly number[]): boolean {
  return rgb.every((channel) => channel >= -0.0005 && channel <= 1.0005);
}

/**
 * Convert OKLCH back to hex. A color outside sRGB gives up chroma — never hue or
 * lightness — until it fits, so the blend's lightness ramp stays monotonic.
 * @pure true
 */
export function oklchToHex(color: Oklch): string {
  let rgb = oklchToLinearRgb(color);
  if (!inGamut(rgb)) {
    let low = 0;
    let high = color.c;
    for (let pass = 0; pass < 18; pass += 1) {
      const mid = (low + high) / 2;
      if (inGamut(oklchToLinearRgb({ ...color, c: mid }))) low = mid;
      else high = mid;
    }
    rgb = oklchToLinearRgb({ ...color, c: low });
  }
  return `#${rgb
    .map((channel) =>
      Math.round(fromLinear(channel) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(toLinear) as [number, number, number];
  return linearLuminance(r, g, b);
}

/**
 * Intermediate colors for a perceptual blend between two hex colors, endpoints
 * excluded. Hue travels the shorter way around the wheel — except between two deep
 * colors whose short way would cross brown — and lightness and chroma are
 * interpolated linearly.
 *
 * Every intermediate is held inside the luminance band of the two endpoints. A
 * palette is audited for contrast against its two stored stops only, so a blend
 * that drifted brighter or darker than both would put text on a color nobody
 * measured — clamping here means the audit's worst case is still the worst case.
 * @param from - start color, #rgb or #rrggbb
 * @param to - end color, #rgb or #rrggbb
 * @param steps - how many intermediate colors to return
 * @returns Hex colors strictly between the endpoints; empty when either is not hex
 * @pure true
 */
export function blendOklch(from: string, to: string, steps = DEFAULT_BLEND_STEPS): string[] {
  const start = hexToOklch(from);
  const end = hexToOklch(to);
  if (!start || !end || steps < 1) return [];

  // A grey end has no hue of its own; borrow the other end's so the blend does not
  // swing through an arbitrary color on its way out of the neutral axis.
  const startHue = start.c < ACHROMATIC_CHROMA ? end.h : start.h;
  const endHue = end.c < ACHROMATIC_CHROMA ? start.h : end.h;
  let hueDelta = ((endHue - startHue + 540) % 360) - 180;
  // Two deep colors far apart on the wheel can be joined either way round. The
  // shorter arc sometimes crosses orange/yellow, and a DARK orange or yellow is
  // brown — the blend would trade a grey middle for a muddy one. When that is where
  // the short way leads, take the long way through the cool side instead.
  const midHue = (startHue + hueDelta / 2 + 360) % 360;
  const bothDeep = start.l < DEEP_LIGHTNESS && end.l < DEEP_LIGHTNESS;
  if (
    bothDeep &&
    Math.abs(hueDelta) >= WIDE_HUE_SPAN &&
    midHue >= MUDDY_HUE_MIN &&
    midHue <= MUDDY_HUE_MAX
  ) {
    hueDelta -= Math.sign(hueDelta) * 360;
  }

  const floor = Math.min(relativeLuminance(from), relativeLuminance(to));
  const ceiling = Math.max(relativeLuminance(from), relativeLuminance(to));

  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / (steps + 1);
    const mixed: Oklch = {
      l: start.l + (end.l - start.l) * t,
      c: start.c + (end.c - start.c) * t,
      h: (startHue + hueDelta * t + 360) % 360,
    };
    let hex = oklchToHex(mixed);
    // Nudge lightness until the stop sits inside the audited luminance band.
    for (let pass = 0; pass < 40; pass += 1) {
      const luminance = relativeLuminance(hex);
      if (luminance > ceiling) mixed.l -= 0.004;
      else if (luminance < floor) mixed.l += 0.004;
      else break;
      hex = oklchToHex(mixed);
    }
    return hex;
  });
}

/**
 * Re-express a plain two-stop linear gradient as a perceptual blend. Anything else
 * — a photo layer, a pattern stack, a gradient with more than two stops, non-hex
 * colors — is returned untouched, so this is safe to run over any stored backdrop.
 * @param background - CSS background-image value
 * @returns The same gradient with OKLCH-blended intermediate stops
 * @pure true
 */
export function vividGradient(background: string): string {
  const match =
    /^linear-gradient\(([^,]+),\s*(#[0-9a-fA-F]{3,6})\s*,\s*(#[0-9a-fA-F]{3,6})\s*\)$/.exec(
      background.trim(),
    );
  if (!match) return background;
  const [, angle, from, to] = match;
  const middle = blendOklch(from!, to!);
  if (!middle.length) return background;
  return `linear-gradient(${angle},${[from, ...middle, to].join(",")})`;
}

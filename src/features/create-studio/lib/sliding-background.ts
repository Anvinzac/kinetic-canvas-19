/**
 * @responsibility Build a wide sliding gradient strip for multi-stop transition previews.
 * @pure true
 */
export function getComposerSlidingBackground(gradients: readonly string[], shiftPage: number) {
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

/**
 * @responsibility Collapse gradient CSS strings into ordered stop colors for the slide strip.
 * @pure true
 */
export function getComposerTransitionColors(gradients: readonly string[]) {
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

/**
 * @responsibility Pull color tokens out of a CSS gradient string.
 * @pure true
 */
export function extractGradientColors(value: string) {
  return (
    value.match(
      /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)/g,
    ) ?? []
  );
}

/**
 * UI component: TemplateButton.
 *
 * Exports: TemplateButton
 * Depends on: react, lucide-react, @/features/canvas
 */

import type { CSSProperties, ReactElement} from "react";
import { Check, Video } from "lucide-react";
import {
  SAFE_CANVAS_BACKGROUND,
  getCanvasPatternTheme,
  getCanvasSceneTheme,
  getSceneBackgroundStyle,
} from "@/features/canvas";
import type { AnimationTemplate } from "../types";

/**
 * Render the TemplateButton UI.
 * @param props - Component props
 * @returns Rendered UI
 */
export function TemplateButton({
  template,
  active,
  onClick,
}: {
  template: AnimationTemplate;
  active: boolean;
  onClick: () => void;
}): ReactElement {
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
    template.backdrop.mode === "scene" ? getCanvasSceneTheme(template.backdrop.sceneId): null;
  const pattern =
    template.backdrop.mode === "pattern"
      ? getCanvasPatternTheme(template.backdrop.patternId): null;

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

/**
 * @responsibility Build inline styles for a template thumbnail backdrop.
 * @pure true
 */
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

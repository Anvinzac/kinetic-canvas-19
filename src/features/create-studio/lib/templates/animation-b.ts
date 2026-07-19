/**
 * Animation template catalog (batch B) for create-studio.
 *
 * Exports: ANIMATION_TEMPLATES_B
 * Depends on: create-studio types, templates/media
 */

import type { AnimationTemplate } from "../../types";
import { PRELOADED_PHOTOS } from "./media";
import { PRELOADED_VIDEOS } from "./media";

export const ANIMATION_TEMPLATES_B: AnimationTemplate[] = [
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
  }
];

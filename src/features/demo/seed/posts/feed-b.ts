/**
 * Creator/demo feed posts (batch B) for the mock timeline.
 *
 * Exports: CREATOR_FEED_POSTS_B
 * Depends on: seed profiles MOCK_ME_ID, helpers
 */

import { MOCK_ME_ID } from "../profiles";
import type { MockPost } from "../types";
import { canvas } from "./helpers";

export const CREATOR_FEED_POSTS_B: MockPost[] = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    author_id: "22222222-2222-4222-8222-222222222222",
    post_type: "link",
    canvas_html: canvas({
      text: "The best interfaces explain themselves before the user needs a tooltip.",
      font: "Playfair Display",
      size: 74,
      color: "#17140f",
      entrance: "blur",
      loop: "float",
      link: {
        url: "https://www.nngroup.com/articles/designing-effective-carousels/",
        host: "nngroup.com",
        title: "The best interfaces explain themselves before the user needs a tooltip.",
      },
    }),
    media_urls: ["https://www.nngroup.com/articles/designing-effective-carousels/"],
    bg_gradient: "linear-gradient(135deg,#FFD60A,#FF006E)",
    created_at: "2026-06-16T07:06:00.000Z",
  },
  {
    id: "bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcb3",
    author_id: "22222222-2222-4222-8222-222222222222",
    post_type: "image",
    canvas_html: canvas({
      text: "Make the first frame honest. Let the second frame surprise them. Leave the last frame glowing.",
      font: "Bebas Neue",
      size: 90,
      color: "#ffffff",
      entrance: "slide",
      loop: "float",
      y: 46,
    }),
    media_urls: [
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80",
    ],
    bg_gradient: "linear-gradient(135deg,#00B4D8,#FF006E)",
    created_at: "2026-06-16T06:58:00.000Z",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    author_id: "33333333-3333-4333-8333-333333333333",
    post_type: "text",
    canvas_html: canvas({
      text: "Tiny drafts count. Slow mornings count. The loop is proof you came back.",
      font: "Playfair Display",
      size: 76,
      color: "#ffffff",
      entrance: "blur",
      loop: "float",
      rotation: -2,
      backgroundPattern: "waves",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-16T06:32:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
    author_id: "44444444-4444-4444-8444-444444444444",
    post_type: "slideshow",
    canvas_html: canvas({
      text: "Archive the spark before it cools. Name the version you want to remember.",
      font: "Inter",
      size: 72,
      color: "#ffffff",
      entrance: "fade",
      loop: "pulse",
    }),
    media_urls: [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=80",
    ],
    bg_gradient: "linear-gradient(135deg,#3A86FF,#06FFA5)",
    created_at: "2026-06-16T05:49:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
    author_id: "55555555-5555-4555-8555-555555555555",
    post_type: "video",
    canvas_html: canvas({
      text: "Motion is a shortcut to memory. Give the sentence somewhere to land.",
      font: "JetBrains Mono",
      size: 64,
      color: "#06FFA5",
      entrance: "split",
      loop: "shake",
      y: 55,
    }),
    media_urls: ["https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"],
    bg_gradient: "linear-gradient(135deg,#00B4D8,#FF006E)",
    created_at: "2026-06-15T22:15:00.000Z",
  },
  {
    id: "ffffffff-ffff-4fff-8fff-fffffffffff6",
    author_id: "66666666-6666-4666-8666-666666666666",
    post_type: "text",
    canvas_html: canvas({
      text: "A small pause can make the whole post breathe.",
      font: "Space Grotesk",
      size: 86,
      color: "#ffffff",
      entrance: "fade",
      loop: "none",
      backgroundPattern: "hexagons",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-15T18:40:00.000Z",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    author_id: "22222222-2222-4222-8222-222222222222",
    post_type: "text",
    canvas_html: canvas({
      text: "If the line feels flat, change the entrance before you change the thought.",
      font: "Bebas Neue",
      size: 92,
      color: "#ffffff",
      entrance: "slide",
      loop: "pulse",
      backgroundPattern: "isometric",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-15T12:25:00.000Z",
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    author_id: "33333333-3333-4333-8333-333333333333",
    post_type: "text",
    canvas_html: canvas({
      text: "You can publish the draft and still protect the deeper work.",
      font: "Inter",
      size: 78,
      color: "#ffffff",
      entrance: "scale",
      loop: "float",
    }),
    media_urls: [],
    bg_gradient: "linear-gradient(135deg,#F72585,#7209B7)",
    created_at: "2026-06-14T21:02:00.000Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    author_id: MOCK_ME_ID,
    post_type: "text",
    canvas_html: canvas({
      text: "Test the replay button. Test the comment timing. Test the feeling after the fade.",
      font: "JetBrains Mono",
      size: 62,
      color: "#06FFA5",
      entrance: "blur",
      loop: "pulse",
    }),
    media_urls: [],
    bg_gradient: "linear-gradient(135deg,#00B4D8,#FF006E)",
    created_at: "2026-06-14T14:18:00.000Z",
  },
  {
    id: "12121212-1212-4212-8212-121212121212",
    author_id: "44444444-4444-4444-8444-444444444444",
    post_type: "image",
    canvas_html: canvas({
      text: "A good background should hold the sentence, not steal it.",
      font: "Playfair Display",
      size: 74,
      color: "#ffffff",
      entrance: "fade",
      loop: "float",
    }),
    media_urls: [
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80",
    ],
    bg_gradient: "linear-gradient(135deg,#3A86FF,#8338EC)",
    created_at: "2026-06-14T09:35:00.000Z",
  }
];

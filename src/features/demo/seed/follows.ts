/**
 * Canonical demo follow edges used before local overlays apply.
 *
 * Exports: MOCK_FOLLOWS, follow
 * Depends on: seed MOCK_ME_ID, MockFollow
 */

import { MOCK_ME_ID } from "./profiles";
import type { MockFollow } from "./types";

/** @responsibility Canonical demo follow edges used before local overlays apply. */
export const MOCK_FOLLOWS: MockFollow[] = [
  follow(MOCK_ME_ID, "22222222-2222-4222-8222-222222222222", "2026-06-01T09:00:00.000Z"),
  follow(MOCK_ME_ID, "33333333-3333-4333-8333-333333333333", "2026-06-01T09:05:00.000Z"),
  follow(MOCK_ME_ID, "44444444-4444-4444-8444-444444444444", "2026-06-01T09:10:00.000Z"),
  follow(MOCK_ME_ID, "55555555-5555-4555-8555-555555555555", "2026-06-01T09:15:00.000Z"),
  follow(MOCK_ME_ID, "66666666-6666-4666-8666-666666666666", "2026-06-01T09:20:00.000Z"),
  follow("22222222-2222-4222-8222-222222222222", MOCK_ME_ID, "2026-06-10T16:15:00.000Z"),
  follow("33333333-3333-4333-8333-333333333333", MOCK_ME_ID, "2026-06-12T11:42:00.000Z"),
  follow("44444444-4444-4444-8444-444444444444", MOCK_ME_ID, "2026-06-15T18:19:00.000Z"),
  follow(
    "66666666-6666-4666-8666-666666666666",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-05T13:40:00.000Z",
  ),
  follow(
    "55555555-5555-4555-8555-555555555555",
    "33333333-3333-4333-8333-333333333333",
    "2026-06-07T20:12:00.000Z",
  ),
];

/** @responsibility Build a seed follow edge between two profile ids. */
export function follow(follower_id: string, following_id: string, created_at: string): MockFollow {
  return { follower_id, following_id, created_at };
}

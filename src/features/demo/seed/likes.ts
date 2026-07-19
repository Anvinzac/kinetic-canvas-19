/**
 * Canonical demo like edges used before local overlays apply.
 *
 * Exports: MOCK_LIKES
 * Depends on: seed MOCK_ME_ID, MockLike
 */

import { MOCK_ME_ID } from "./profiles";
import type { MockLike } from "./types";

/** @responsibility Canonical demo like edges used before local overlays apply. */
export const MOCK_LIKES: MockLike[] = [
  like(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-16T07:23:00.000Z",
  ),
  like(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "33333333-3333-4333-8333-333333333333",
    "2026-06-16T07:25:00.000Z",
  ),
  like(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "44444444-4444-4444-8444-444444444444",
    "2026-06-16T07:29:00.000Z",
  ),
  like("19191919-0619-4619-8619-191919191919", MOCK_ME_ID, "2026-06-16T07:20:00.000Z"),
  like(
    "19191919-0619-4619-8619-191919191919",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-16T07:22:00.000Z",
  ),
  like(
    "19191919-0619-4619-8619-191919191919",
    "66666666-6666-4666-8666-666666666666",
    "2026-06-16T07:25:00.000Z",
  ),
  like("dadadada-dada-4ada-8ada-dadadadada05", MOCK_ME_ID, "2026-06-16T07:20:00.000Z"),
  like(
    "dadadada-dada-4ada-8ada-dadadadada05",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-16T07:22:00.000Z",
  ),
  like(
    "dadadada-dada-4ada-8ada-dadadadada05",
    "44444444-4444-4444-8444-444444444444",
    "2026-06-16T07:26:00.000Z",
  ),
  like("bebebebe-bebe-4ebe-8ebe-bebebebebe06", MOCK_ME_ID, "2026-06-16T07:19:00.000Z"),
  like(
    "bebebebe-bebe-4ebe-8ebe-bebebebebe06",
    "66666666-6666-4666-8666-666666666666",
    "2026-06-16T07:23:00.000Z",
  ),
  like("fafafafa-fafa-4afa-8afa-fafafafafa07", MOCK_ME_ID, "2026-06-16T07:17:00.000Z"),
  like(
    "fafafafa-fafa-4afa-8afa-fafafafafa07",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-16T07:20:00.000Z",
  ),
  like("91919191-9191-4919-8919-919191919108", MOCK_ME_ID, "2026-06-16T07:15:00.000Z"),
  like("abababab-abab-4aba-8aba-ababababab01", MOCK_ME_ID, "2026-06-16T07:18:00.000Z"),
  like(
    "abababab-abab-4aba-8aba-ababababab01",
    "33333333-3333-4333-8333-333333333333",
    "2026-06-16T07:21:00.000Z",
  ),
  like("cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02", MOCK_ME_ID, "2026-06-16T07:14:00.000Z"),
  like(
    "efefefef-efef-4efe-8efe-efefefefef03",
    "55555555-5555-4555-8555-555555555555",
    "2026-06-16T07:11:00.000Z",
  ),
  like("acacacac-acac-4aca-8aca-acacacacac04", MOCK_ME_ID, "2026-06-16T07:06:00.000Z"),
  like("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", MOCK_ME_ID, "2026-06-16T07:04:00.000Z"),
  like(
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    "33333333-3333-4333-8333-333333333333",
    "2026-06-16T07:08:00.000Z",
  ),
  like("cccccccc-cccc-4ccc-8ccc-ccccccccccc3", MOCK_ME_ID, "2026-06-16T06:45:00.000Z"),
  like(
    "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    "66666666-6666-4666-8666-666666666666",
    "2026-06-16T06:52:00.000Z",
  ),
  like("dddddddd-dddd-4ddd-8ddd-ddddddddddd4", MOCK_ME_ID, "2026-06-16T06:01:00.000Z"),
  like(
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-15T22:22:00.000Z",
  ),
  like("ffffffff-ffff-4fff-8fff-fffffffffff6", MOCK_ME_ID, "2026-06-15T19:11:00.000Z"),
  like(
    "99999999-9999-4999-8999-999999999999",
    "55555555-5555-4555-8555-555555555555",
    "2026-06-14T14:30:00.000Z",
  ),
  like(
    "99999999-9999-4999-8999-999999999999",
    "66666666-6666-4666-8666-666666666666",
    "2026-06-14T14:37:00.000Z",
  ),
];

function like(post_id: string, user_id: string, created_at: string): MockLike {
  return { post_id, user_id, created_at };
}

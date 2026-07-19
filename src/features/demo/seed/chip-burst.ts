/**
 * Dense flying-chip comment bursts for demo overflow stress-tests.
 *
 * Exports: buildChipBurstComments
 * Depends on: lib/canvas COMMENT_CHIPS, seed MOCK_ME_ID, posts/helpers NOVA_RAE_ID
 */

import { COMMENT_CHIPS } from "@/lib/canvas";
import { NOVA_RAE_ID } from "./posts/helpers";
import { MOCK_ME_ID } from "./profiles";
import type { MockComment } from "./types";

import { comment } from "./comment-helpers";

// Dense flying-chip bursts on the first feed posts (demo overflow stress-test).
const CHIP_BURST_POST_IDS = [
  "9a000001-0001-4001-8001-000000000001",
  "9a000002-0002-4002-8002-000000000002",
  "9a000007-0007-4007-8007-000000000007",
  "dadadada-dada-4ada-8ada-dadadadada05",
  "91919191-9191-4919-8919-919191919108",
] as const;

const CHIP_BURST_USER_IDS = [
  MOCK_ME_ID,
  NOVA_RAE_ID,
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
] as const;

/**
 * buildChipBurstComments helper
 * @returns Computed value
 */
export function buildChipBurstComments(): MockComment[] {
  const burst: MockComment[] = [];
  let sequence = 1;

  for (const postId of CHIP_BURST_POST_IDS) {
    for (let index = 0; index < 26; index += 1) {
      const chip = COMMENT_CHIPS[index % COMMENT_CHIPS.length];
      burst.push(
        comment(
          `b${String(sequence).padStart(7, "0")}-4000-8000-${String(sequence).padStart(12, "0")}`,
          postId,
          CHIP_BURST_USER_IDS[index % CHIP_BURST_USER_IDS.length],
          chip.id,
          `2026-06-22T11:${String(index % 60).padStart(2, "0")}:${String((index * 5) % 60).padStart(2, "0")}.000Z`,
        ),
      );
      sequence += 1;
    }
  }

  return burst;
}

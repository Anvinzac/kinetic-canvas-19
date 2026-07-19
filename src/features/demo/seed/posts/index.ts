/**
 * Demo seed posts barrel — pattern showcase, vocab bot, and creator feed.
 *
 * Exports: MOCK_POSTS
 * Depends on: seed/posts/* post batches
 */

import type { MockPost } from "../types";
import { CREATOR_FEED_POSTS_A } from "./feed-a";
import { CREATOR_FEED_POSTS_B } from "./feed-b";
import { PATTERN_SHOWCASE_POSTS } from "./showcase";
import { VOCAB_BOT_POSTS } from "./vocab";

/** @responsibility Canonical demo posts (pattern showcase, vocab bot, creator feed). */
export const MOCK_POSTS: MockPost[] = [
  ...PATTERN_SHOWCASE_POSTS,
  ...VOCAB_BOT_POSTS,
  ...CREATOR_FEED_POSTS_A,
  ...CREATOR_FEED_POSTS_B,
];

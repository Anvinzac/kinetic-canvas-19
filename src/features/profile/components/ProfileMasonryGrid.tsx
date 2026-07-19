/**
 * Horizontal masonry preview library on the profile identity snap page.
 *
 * Exports: ProfileMasonryGrid
 * Depends on: MasonryCard, mock post shape
 */

import { Fragment, type ReactElement } from "react";
import type { MockPost } from "@/lib/mock-data";
import { MasonryCard } from "./MasonryCard";

type ProfileMasonryGridProps = {
  posts: MockPost[];
};

/**
 * Render tall + stacked-pair masonry groups for profile post previews.
 * @param props.posts - Posts to preview (empty yields null)
 * @returns Horizontal scroll masonry, or null when there are no posts
 */
export function ProfileMasonryGrid({ posts }: ProfileMasonryGridProps): ReactElement | null {
  if (posts.length === 0) return null;

  return (
    <div className="mt-3 flex-1 min-h-0 overflow-hidden">
      <div className="flex h-full gap-1.5 overflow-x-auto scrollbar-hide">
        {Array.from({ length: Math.ceil(posts.length / 3) }, (_, groupIdx) => {
          const tallPost = posts[groupIdx * 3];
          const shortPostA = posts[groupIdx * 3 + 1];
          const shortPostB = posts[groupIdx * 3 + 2];

          return (
            <Fragment key={groupIdx}>
              {tallPost && (
                <MasonryCard post={tallPost} className="h-full aspect-[9/16] shrink-0" />
              )}
              {(shortPostA || shortPostB) && (
                <div className="grid h-full shrink-0 grid-rows-2 gap-1.5 aspect-[9/16]">
                  {shortPostA && <MasonryCard post={shortPostA} className="min-h-0" />}
                  {shortPostB && <MasonryCard post={shortPostB} className="min-h-0" />}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

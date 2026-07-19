/**
 * Profile post type filters and recent/popular/shuffle sort controls.
 *
 * Exports: ProfileFilterBar
 * Depends on: features/profile filters types
 */

import {
  Clapperboard,
  Clock,
  Flame,
  Grid3X3,
  Image as ImageIcon,
  Newspaper,
  Shuffle,
  Type,
  Video,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import type { PostFilter, PostKind, PostSort } from "../lib/filters";

const FILTERS: { id: PostFilter; label: string; icon: ReactNode }[] = [
  { id: "all", label: "all", icon: <Grid3X3 className="size-3.5" /> },
  { id: "text", label: "text", icon: <Type className="size-3.5" /> },
  { id: "image", label: "image", icon: <ImageIcon className="size-3.5" /> },
  { id: "video", label: "video", icon: <Video className="size-3.5" /> },
  { id: "slideshow", label: "slides", icon: <Clapperboard className="size-3.5" /> },
  { id: "link", label: "links", icon: <Newspaper className="size-3.5" /> },
];

type ProfileFilterBarProps = {
  filter: PostFilter;
  sort: PostSort;
  counts: Record<PostKind, number>;
  totalPosts: number;
  onFilterChange: (filter: PostFilter) => void;
  onSortChange: (sort: PostSort) => void;
  onShuffle: () => void;
};

/**
 * Render horizontal filter chips and sort buttons for the profile library.
 * @param props - Active filter/sort, counts, and change handlers
 * @returns Filter + sort control strip
 */
export function ProfileFilterBar({
  filter,
  sort,
  counts,
  totalPosts,
  onFilterChange,
  onSortChange,
  onShuffle,
}: ProfileFilterBarProps): ReactElement {
  return (
    <div className="mt-3 shrink-0">
      <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            onClick={() => onFilterChange(item.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              filter === item.id
                ? "bg-white text-black"
                : "bg-white/5 text-muted-foreground ring-1 ring-white/10 hover:text-foreground"
            }`}
          >
            {item.icon}
            {item.label}
            <span className="font-mono text-[10px] opacity-70">
              {item.id === "all" ? totalPosts : counts[item.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <SortButton
          active={sort === "recent"}
          onClick={() => onSortChange("recent")}
          icon={<Clock className="size-3" />}
          label="recent"
        />
        <SortButton
          active={sort === "popular"}
          onClick={() => onSortChange("popular")}
          icon={<Flame className="size-3" />}
          label="popular"
        />
        <SortButton
          active={sort === "shuffle"}
          onClick={onShuffle}
          icon={<Shuffle className="size-3" />}
          label="shuffle"
        />
      </div>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}): ReactElement {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
        active
          ? "bg-white/15 text-foreground ring-1 ring-white/20"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

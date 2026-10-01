import { createFileRoute } from "@tanstack/react-router";
import { BookmarksPage } from "@/features/vocabulary/components/BookmarksPage";

// Saved words live in this browser's localStorage, so the page must never be
// server-rendered — an SSR pass would emit the empty state for every visitor.
export const Route = createFileRoute("/feed/saved")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Saved words — WordCrawler" },
      {
        name: "description",
        content: "Every vocabulary word you bookmarked, stored on this device only.",
      },
    ],
  }),
  component: BookmarksPage,
});

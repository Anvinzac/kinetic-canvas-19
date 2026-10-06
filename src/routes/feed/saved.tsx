import { createFileRoute } from "@tanstack/react-router";
import { BookmarksPage } from "@/features/vocabulary/components/BookmarksPage";

// Saved words live in this browser's localStorage, so the page must never be
// server-rendered — an SSR pass would emit the empty state for every visitor.
export const Route = createFileRoute("/feed/saved")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Từ vựng của bạn — anh.chayLá" },
      {
        name: "description",
        content: "Những từ vựng bạn đã lưu và yêu thích, giữ ngay trên thiết bị này.",
      },
    ],
  }),
  component: BookmarksPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { BookmarksPage } from "@/features/vocabulary/components/BookmarksPage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { sitePageHead } from "@/features/vocabulary/lib/target-language";

// Saved words live in this browser's localStorage, so the page must never be
// server-rendered — an SSR pass would emit the empty state for every visitor.
export const Route = createFileRoute("/feed/saved")({
  ssr: "data-only",
  loader: async () => ({ locale: await getSiteLocale() }),
  head: ({ loaderData }) => sitePageHead(loaderData?.locale, "Từ vựng của bạn", "Những từ vựng bạn đã lưu và yêu thích, giữ ngay trên thiết bị này."),
  component: BookmarksPage,
});

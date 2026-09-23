import { createFileRoute } from "@tanstack/react-router";
import { VocabularyFeedPage } from "@/features/vocabulary/components/VocabularyFeedPage";

export const Route = createFileRoute("/feed")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "WordCrawler — A little English, endlessly" },
      {
        name: "description",
        content:
          "Discover English vocabulary through Vietnamese clues. A free, endlessly shuffled word feed with no sign-in required.",
      },
    ],
  }),
  component: VocabularyFeedPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { VocabLibraryPage } from "@/features/vocabulary/components/VocabLibraryPage";

// The library is a static discovery surface over mock pack metadata, so it never
// needs SSR — render it client-side like its /feed/saved sibling.
export const Route = createFileRoute("/feed/library")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Thư viện từ vựng — anh.chayLá" },
      {
        name: "description",
        content:
          "Additional vocabulary packs focused on specific fields, needs and proficiency levels.",
      },
    ],
  }),
  component: VocabLibraryPage,
});

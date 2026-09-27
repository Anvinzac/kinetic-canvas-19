import { createFileRoute } from "@tanstack/react-router";
import { VocabularyWordsPage } from "@/features/admin";

export const Route = createFileRoute("/admin/vocabulary")({
  component: VocabularyWordsPage,
});

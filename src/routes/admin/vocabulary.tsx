import { createFileRoute } from "@tanstack/react-router";
import { VocabularyWorkbenchPage } from "@/features/admin";

export const Route = createFileRoute("/admin/vocabulary")({
  component: VocabularyWorkbenchPage,
});

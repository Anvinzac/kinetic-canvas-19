import { createFileRoute } from "@tanstack/react-router";
import { WordingManagerPage } from "@/features/admin";

export const Route = createFileRoute("/admin/wordings")({
  component: WordingManagerPage,
});

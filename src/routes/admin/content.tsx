import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/features/admin";

export const Route = createFileRoute("/admin/content")({
  component: ContentPage,
});

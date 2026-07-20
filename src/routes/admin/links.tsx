import { createFileRoute } from "@tanstack/react-router";
import { LinksPage } from "@/features/admin";

export const Route = createFileRoute("/admin/links")({
  component: LinksPage,
});

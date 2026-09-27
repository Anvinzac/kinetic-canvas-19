import { createFileRoute } from "@tanstack/react-router";
import { TemplateManagerPage } from "@/features/admin";

export const Route = createFileRoute("/admin/templates")({
  component: TemplateManagerPage,
});

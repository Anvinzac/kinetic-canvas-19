import { createFileRoute } from "@tanstack/react-router";
import { LlmSettingsPage } from "@/features/admin";

export const Route = createFileRoute("/admin/model")({
  component: LlmSettingsPage,
});

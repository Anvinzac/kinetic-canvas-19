import { createFileRoute } from "@tanstack/react-router";
import { AmbientMusicPage } from "@/features/admin";

export const Route = createFileRoute("/admin/ambient")({
  component: AmbientMusicPage,
});

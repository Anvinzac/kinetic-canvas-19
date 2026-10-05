import { createFileRoute } from "@tanstack/react-router";
import { PaletteManagerPage } from "@/features/admin";

export const Route = createFileRoute("/admin/palettes")({
  component: PaletteManagerPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/features/settings";

export const Route = createFileRoute("/_authenticated/about")({
  component: AboutPage,
});

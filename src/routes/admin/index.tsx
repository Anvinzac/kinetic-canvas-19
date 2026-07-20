import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/features/admin";

export const Route = createFileRoute("/admin/")({
  component: OverviewPage,
});

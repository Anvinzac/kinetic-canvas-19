import { createFileRoute } from "@tanstack/react-router";
import { WordReportsPage } from "@/features/admin";

export const Route = createFileRoute("/admin/reports")({
  component: WordReportsPage,
});
